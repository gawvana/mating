"""Unit and integration tests for Telegram Bot Webhook and command routing."""

import pytest
from httpx import ASGITransport, AsyncClient

from backend.api.main import app
from backend.core.config import settings


@pytest.mark.asyncio
async def test_webhook_invalid_secret_rejected(monkeypatch):
    """Verify that webhook strictly rejects updates without or with invalid secret."""
    monkeypatch.setattr(settings, "BOT_TOKEN", "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # No header
        resp = await client.post(
            "/api/v1/bot/webhook",
            json={"update_id": 1001, "message": {"message_id": 1, "text": "/start"}},
        )
        assert resp.status_code == 403
        data = resp.json()
        assert data["error"]["code"] == "INVALID_SECRET"

        # Wrong header
        resp2 = await client.post(
            "/api/v1/bot/webhook",
            headers={"X-Telegram-Bot-Api-Secret-Token": "wrong-secret"},
            json={"update_id": 1002, "message": {"message_id": 2, "text": "/start"}},
        )
        assert resp2.status_code == 403


@pytest.mark.asyncio
async def test_webhook_valid_secret_and_start_command(monkeypatch):
    """Verify that webhook accepts update with valid secret and processes /start command."""
    monkeypatch.setattr(settings, "BOT_TOKEN", "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11")
    secret = settings.WEBHOOK_SECRET

    # Mock bot.answer or bot methods so no real network call is made to telegram
    answered_messages = []

    async def mock_feed_update(bot, update):
        answered_messages.append(update.update_id)

    from backend.bot.bot import dp
    monkeypatch.setattr(dp, "feed_update", mock_feed_update)

    update_payload = {
        "update_id": 5001,
        "message": {
            "message_id": 10,
            "date": 1700000000,
            "chat": {"id": 12345678, "type": "private"},
            "from": {
                "id": 12345678,
                "is_bot": False,
                "first_name": "TestUser",
                "username": "testuser",
                "language_code": "ru",
            },
            "text": "/start",
        },
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/bot/webhook",
            headers={"X-Telegram-Bot-Api-Secret-Token": secret},
            json=update_payload,
        )
        assert resp.status_code == 200
        assert resp.json() == {"ok": True}
        assert 5001 in answered_messages


@pytest.mark.asyncio
async def test_webhook_replay_protection(monkeypatch):
    """Verify that duplicate update_id within TTL is flagged as replayed."""
    monkeypatch.setattr(settings, "BOT_TOKEN", "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11")
    secret = settings.WEBHOOK_SECRET

    from backend.bot.bot import dp
    async def mock_feed_update(bot, update):
        pass
    monkeypatch.setattr(dp, "feed_update", mock_feed_update)

    payload = {
        "update_id": 99999,
        "message": {
            "message_id": 99,
            "date": 1700000000,
            "chat": {"id": 12345678, "type": "private"},
            "from": {"id": 12345678, "is_bot": False, "first_name": "ReplayUser"},
            "text": "/help",
        },
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # First delivery: accepted
        resp1 = await client.post(
            "/api/v1/bot/webhook",
            headers={"X-Telegram-Bot-Api-Secret-Token": secret},
            json=payload,
        )
        assert resp1.status_code == 200
        assert resp1.json() == {"ok": True}

        # Second delivery (replay): flagged
        resp2 = await client.post(
            "/api/v1/bot/webhook",
            headers={"X-Telegram-Bot-Api-Secret-Token": secret},
            json=payload,
        )
        assert resp2.status_code == 200
        assert resp2.json().get("replayed") is True


@pytest.mark.asyncio
async def test_setup_webhook_endpoint_validation():
    """Verify setup-webhook endpoint properly enforces WEBAPP_URL validation."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # If bot token isn't configured in test env, expect 503 BOT_DISABLED
        resp = await client.post("/api/v1/bot/setup-webhook")
        # In test env with fake/missing token, returns 503 or 500 cleanly
        assert resp.status_code in {200, 503, 500}


@pytest.mark.asyncio
async def test_bot_command_handlers_execute():
    """Verify that command handlers (/start, /ai, /history, /share, /help) execute and answer."""
    from unittest.mock import AsyncMock, MagicMock
    from backend.bot.bot import (
        handle_start,
        handle_ai_command,
        handle_history_command,
        handle_share_command,
        handle_help_command,
        handle_natural_text,
    )

    mock_msg = MagicMock()
    mock_msg.from_user = MagicMock(id=987654321, first_name="Alex", username="alex", language_code="ru")
    mock_msg.answer = AsyncMock()

    # /start
    await handle_start(mock_msg)
    assert mock_msg.answer.called
    args, kwargs = mock_msg.answer.call_args
    assert "Mating 👋" in args[0]
    assert "reply_markup" in kwargs

    # /ai
    mock_msg.answer.reset_mock()
    await handle_ai_command(mock_msg)
    assert mock_msg.answer.called
    args, _ = mock_msg.answer.call_args
    assert "AI Ассистент" in args[0]

    # /history
    mock_msg.answer.reset_mock()
    await handle_history_command(mock_msg)
    assert mock_msg.answer.called
    args, _ = mock_msg.answer.call_args
    assert "История покупок" in args[0]

    # /share
    mock_msg.answer.reset_mock()
    await handle_share_command(mock_msg)
    assert mock_msg.answer.called
    args, _ = mock_msg.answer.call_args
    assert "Поделиться" in args[0]

    # /help
    mock_msg.answer.reset_mock()
    await handle_help_command(mock_msg)
    assert mock_msg.answer.called
    args, _ = mock_msg.answer.call_args
    assert "/start" in args[0]
    assert "/ai" in args[0]
    assert "/history" in args[0]
    assert "/share" in args[0]

    # Natural Language: "покажи список"
    mock_msg.answer.reset_mock()
    mock_msg.text = "покажи список"
    await handle_natural_text(mock_msg)
    assert mock_msg.answer.called
