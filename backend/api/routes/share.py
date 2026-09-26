"""Secure shopping list sharing endpoints with unguessable, revocable snapshot tokens."""

from __future__ import annotations

import json
import logging
from pathlib import Path
import secrets
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_user
from backend.core.config import settings
from backend.database.engine import get_db
from backend.database.models import User
from backend.services.item_service import ItemService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/share", tags=["Share List"])

DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"
SNAPSHOTS_FILE = DATA_DIR / "shared_snapshots.json"


def _load_snapshots() -> dict[str, dict[str, Any]]:
    try:
        if SNAPSHOTS_FILE.exists():
            with open(SNAPSHOTS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
    except Exception as exc:
        logger.warning("Failed to load shared snapshots from %s: %s", SNAPSHOTS_FILE, exc)
    return {}


def _save_snapshots(data: dict[str, dict[str, Any]]) -> None:
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        temp_file = SNAPSHOTS_FILE.with_suffix(".tmp")
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        temp_file.replace(SNAPSHOTS_FILE)
    except Exception as exc:
        logger.warning("Failed to save shared snapshots to %s: %s", SNAPSHOTS_FILE, exc)


# Snapshot store persisted to disk: token -> snapshot data
# Supports point-in-time read-only snapshots without leaking user credentials
_shared_snapshots: dict[str, dict[str, Any]] = _load_snapshots()


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
    """Generate an unguessable snapshot token for current list."""
    token = secrets.token_urlsafe(16)
    now = datetime.now(timezone.utc).isoformat()

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

    _shared_snapshots[token] = {
        "user_id": user.id,
        "title": body.title.strip() or "Список покупок",
        "created_at": now,
        "items": [it.model_dump() for it in items_data],
    }
    _save_snapshots(_shared_snapshots)

    base_url = settings.WEBAPP_URL.rstrip("/") if settings.WEBAPP_URL else "https://mating.vercel.app"
    share_url = f"{base_url}/?share={token}"

    return CreateShareResponse(
        token=token,
        share_url=share_url,
        item_count=len(items_data),
        created_at=now,
    )


@router.get("/{token}", response_model=PublicSnapshotResponse)
async def get_shared_snapshot(token: str):
    """Retrieve public read-only shared list snapshot without exposing user identity."""
    snapshot = _shared_snapshots.get(token)
    if not snapshot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "SNAPSHOT_NOT_FOUND", "message": "Shared list not found or link has expired"}},
        )

    return PublicSnapshotResponse(
        token=token,
        title=snapshot["title"],
        item_count=len(snapshot["items"]),
        created_at=snapshot["created_at"],
        items=[SharedItemPayload(**item) for item in snapshot["items"]],
    )


@router.delete("/{token}")
async def revoke_shared_snapshot(
    token: str,
    user: User = Depends(get_current_user),
):
    """Revoke a previously created share token."""
    snapshot = _shared_snapshots.get(token)
    if not snapshot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "SNAPSHOT_NOT_FOUND", "message": "Share link not found"}},
        )

    if snapshot["user_id"] != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Cannot revoke share created by another user"}},
        )

    del _shared_snapshots[token]
    _save_snapshots(_shared_snapshots)
    return {"ok": True, "revoked": token}
