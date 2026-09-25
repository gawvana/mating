"""API Dependencies for authentication and services."""

from __future__ import annotations

from typing import Annotated
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import settings
from backend.core.security import (
    SecurityError,
    authenticate_tma_header,
    hash_telegram_id,
)
from backend.database.engine import get_db
from backend.database.models import User
from backend.repositories.user_repository import UserRepository


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    session: Annotated[AsyncSession, Depends(get_db)] = None,
) -> User:
    """Extract and validate Telegram Mini App authentication header.
    Returns authenticated user model instance.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "UNAUTHORIZED", "message": "Missing Authorization header"}},
        )

    # Allow test bypass only in development or test environment
    allow_bypass = settings.APP_ENV in ("development", "test")

    try:
        auth_payload = authenticate_tma_header(
            authorization,
            bot_token=settings.BOT_TOKEN,
            allow_test_bypass=allow_bypass,
        )
    except SecurityError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": e.code, "message": e.message}},
        )

    tg_user = auth_payload["user"]
    if isinstance(tg_user, dict):
        tg_id = tg_user.get("id")
        username = tg_user.get("username")
        first_name = tg_user.get("first_name")
        lang = tg_user.get("language_code", "ru")
    else:
        tg_id = int(tg_user)
        username = None
        first_name = "User"
        lang = "ru"

    if not tg_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "INVALID_TELEGRAM_ID", "message": "User payload missing id"}},
        )

    # Compute SHA-256 hash of telegram ID (NEVER store plaintext)
    tg_id_hash = hash_telegram_id(tg_id)

    user_repo = UserRepository(session)
    user = await user_repo.get_or_create(
        telegram_id_hash=tg_id_hash,
        username=username,
        first_name=first_name,
        language_code=lang,
    )

    return user
