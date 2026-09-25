"""Telegram Bot Webhook endpoints."""

from __future__ import annotations

import logging
from typing import Annotated, Any
from fastapi import APIRouter, Header, HTTPException, Request, status
from aiogram.types import Update

from backend.api.schemas import WebhookSetupResponse
from backend.bot.bot import dp, get_bot, setup_bot_commands_and_menu
from backend.core.config import settings

logger = logging.getLogger("mating.webhook")
router = APIRouter(prefix="/api/v1/bot", tags=["Telegram Bot Webhook"])


@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: Annotated[str | None, Header()] = None,
):
    """Receive webhook updates from Telegram.
    Strictly validates X-Telegram-Bot-Api-Secret-Token header.
    """
    bot = get_bot()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": {"code": "BOT_DISABLED", "message": "Bot token not configured"}},
        )

    # Validate secret token header
    if settings.WEBHOOK_SECRET and x_telegram_bot_api_secret_token != settings.WEBHOOK_SECRET:
        logger.warning("Invalid webhook secret token received")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "INVALID_SECRET", "message": "Invalid webhook secret token"}},
        )

    try:
        data = await request.json()
        update = Update.model_validate(data, context={"bot": bot})
        await dp.feed_update(bot, update)
    except Exception as e:
        logger.error("Error processing update: %s", e)

    return {"ok": True}


@router.post("/setup-webhook", response_model=WebhookSetupResponse)
async def setup_webhook():
    """Register webhook with Telegram Bot API."""
    bot = get_bot()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": {"code": "BOT_DISABLED", "message": "BOT_TOKEN not configured"}},
        )

    if not settings.WEBAPP_URL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "MISSING_WEBAPP_URL", "message": "WEBAPP_URL is required to set webhook"}},
        )

    webhook_url = f"{settings.WEBAPP_URL.rstrip('/')}/api/v1/bot/webhook"
    try:
        res = await bot.set_webhook(
            url=webhook_url,
            secret_token=settings.WEBHOOK_SECRET,
            drop_pending_updates=True,
        )
        await setup_bot_commands_and_menu(bot)
        return WebhookSetupResponse(
            ok=res,
            description=f"Webhook configured to {webhook_url} and Telegram bot commands/menu registered",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": "SETUP_FAILED", "message": str(e)}},
        )
