"""Tests for Telegram Bot webhook authentication and handling."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from backend.core.config import settings


@pytest.mark.asyncio
async def test_bot_webhook_secret_verification(async_client: AsyncClient):
    """Section 16: Verify secret is strictly checked via X-Telegram-Bot-Api-Secret-Token."""
    settings.BOT_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
    settings.WEBHOOK_SECRET = "super-secret-token-123"

    # 1. Missing secret header -> 403 Forbidden
    res1 = await async_client.post("/api/v1/bot/webhook", json={"update_id": 1})
    assert res1.status_code == 403
    assert res1.json()["error"]["code"] == "INVALID_SECRET"

    # 2. Wrong secret header -> 403 Forbidden
    res2 = await async_client.post(
        "/api/v1/bot/webhook",
        json={"update_id": 1},
        headers={"X-Telegram-Bot-Api-Secret-Token": "wrong-secret"},
    )
    assert res2.status_code == 403

    # 3. Correct secret header -> 200 OK (with mocked feed_update to avoid Telegram network call)
    with patch("backend.api.routes.bot.dp.feed_update", new_callable=AsyncMock) as mock_feed:
        res3 = await async_client.post(
            "/api/v1/bot/webhook",
            json={"update_id": 9991},
            headers={"X-Telegram-Bot-Api-Secret-Token": "super-secret-token-123"},
        )
        assert res3.status_code == 200
        assert res3.json()["ok"] is True
        mock_feed.assert_awaited_once()

        # 4. Replay duplicate update_id -> returns ok without feeding to dispatcher again
        res4 = await async_client.post(
            "/api/v1/bot/webhook",
            json={"update_id": 9991},
            headers={"X-Telegram-Bot-Api-Secret-Token": "super-secret-token-123"},
        )
        assert res4.status_code == 200
        assert res4.json().get("replayed") is True
        # feed_update should still only have been awaited once!
        mock_feed.assert_awaited_once()

