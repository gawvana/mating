"""Secure shopping list sharing endpoints with unguessable, revocable snapshot tokens backed by database persistence."""

from __future__ import annotations

import json
import logging
import secrets
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_user
from backend.core.config import settings
from backend.database.engine import get_db
from backend.database.models import SharedSnapshot, User, utcnow
from backend.services.item_service import ItemService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/share", tags=["Share List"])


class SharedItemPayload(BaseModel):
    name: str
    quantity: float
    unit: str
    category: str
    price: float | None = None
    currency_code: str = "UZS"
    is_purchased: bool = False


class CreateShareRequest(BaseModel):
    title: str = "Список покупок"
    items: list[SharedItemPayload] | None = None


class CreateShareResponse(BaseModel):
    token: str
    share_url: str
    item_count: int
    created_at: str


class PublicSnapshotResponse(BaseModel):
    token: str
    title: str
    item_count: int
    created_at: str
    items: list[SharedItemPayload]


@router.post("", response_model=CreateShareResponse)
async def create_share_snapshot(
    body: CreateShareRequest = CreateShareRequest(),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Generate an unguessable, cryptographically secure snapshot token and persist to database."""
    token = secrets.token_urlsafe(16)
    now_dt = utcnow()
    now_str = now_dt.isoformat()

    items_data: list[SharedItemPayload] = []
    if body.items is not None and len(body.items) > 0:
        items_data = body.items
    else:
        service = ItemService(session)
        user_items = await service.list_items(user.id)
        items_data = [
            SharedItemPayload(
                name=i.name,
                quantity=i.quantity,
                unit=i.unit,
                category=i.category,
                price=i.price,
                currency_code=i.currency_code,
                is_purchased=i.is_purchased,
            )
            for i in user_items
        ]

    serialized_payload = json.dumps([it.model_dump() for it in items_data], ensure_ascii=False)
    snapshot = SharedSnapshot(
        token=token,
        user_id=user.id,
        title=body.title.strip() or "Список покупок",
        snapshot_payload=serialized_payload,
        item_count=len(items_data),
        created_at=now_dt,
    )
    session.add(snapshot)
    await session.commit()

    base_url = settings.WEBAPP_URL.rstrip("/") if settings.WEBAPP_URL else "https://mating.vercel.app"
    share_url = f"{base_url}/?share={token}"

    return CreateShareResponse(
        token=token,
        share_url=share_url,
        item_count=len(items_data),
        created_at=now_str,
    )


@router.get("/{token}", response_model=PublicSnapshotResponse)
async def get_shared_snapshot(
    token: str,
    session: AsyncSession = Depends(get_db),
):
    """Retrieve public read-only shared list snapshot without exposing user identity."""
    stmt = select(SharedSnapshot).where(
        SharedSnapshot.token == token,
        SharedSnapshot.revoked_at.is_(None),
    )
    result = await session.execute(stmt)
    snapshot = result.scalar_one_or_none()

    if not snapshot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "SNAPSHOT_NOT_FOUND", "message": "Shared list not found or link has expired"}},
        )

    try:
        raw_items = json.loads(snapshot.snapshot_payload)
    except Exception:
        raw_items = []

    return PublicSnapshotResponse(
        token=token,
        title=snapshot.title,
        item_count=snapshot.item_count,
        created_at=snapshot.created_at.isoformat() if hasattr(snapshot.created_at, "isoformat") else str(snapshot.created_at),
        items=[SharedItemPayload(**item) for item in raw_items],
    )


@router.delete("/{token}")
async def revoke_shared_snapshot(
    token: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Revoke a previously created share token."""
    stmt = select(SharedSnapshot).where(
        SharedSnapshot.token == token,
        SharedSnapshot.revoked_at.is_(None),
    )
    result = await session.execute(stmt)
    snapshot = result.scalar_one_or_none()

    if not snapshot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "SNAPSHOT_NOT_FOUND", "message": "Share link not found"}},
        )

    if snapshot.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Cannot revoke share created by another user"}},
        )

    snapshot.revoked_at = utcnow()
    await session.commit()
    return {"ok": True, "revoked": token}
