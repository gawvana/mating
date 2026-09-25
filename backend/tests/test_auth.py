"""Tests for Telegram initData authentication and security verification."""

import json
import time
import pytest
from httpx import AsyncClient

from backend.core.config import settings
from backend.core.security import (
    SecurityError,
    authenticate_tma_header,
    hash_telegram_id,
    verify_telegram_init_data,
)
from backend.tests.conftest import create_valid_telegram_init_data


BOT_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"


def test_hash_telegram_id_deterministic_and_hidden():
    """Verify that telegram IDs are hashed with SHA-256 and cannot be plaintext."""
    tg_id = 987654321
    hashed = hash_telegram_id(tg_id)
    assert len(hashed) == 64
    assert str(tg_id) not in hashed
    assert hash_telegram_id(tg_id) == hashed


def test_valid_init_data_verification():
    """Verify cryptographically valid initData succeeds."""
    init_data = create_valid_telegram_init_data(
        user_id=424242,
        username="mating_user",
        bot_token=BOT_TOKEN,
    )
    result = verify_telegram_init_data(init_data, bot_token=BOT_TOKEN)
    assert result["user"]["id"] == 424242
    assert result["user"]["username"] == "mating_user"


def test_tampered_hash_rejection():
    """Verify modified data with invalid hash is rejected."""
    init_data = create_valid_telegram_init_data(user_id=424242, bot_token=BOT_TOKEN)
    tampered = init_data.replace("424242", "999999")
    with pytest.raises(SecurityError) as exc_info:
        verify_telegram_init_data(tampered, bot_token=BOT_TOKEN)
    assert exc_info.value.code == "INVALID_SIGNATURE"


def test_expired_auth_date_rejection():
    """Verify initData older than 24 hours is rejected."""
    old_time = int(time.time()) - 100000  # older than 86400s
    init_data = create_valid_telegram_init_data(
        user_id=424242,
        bot_token=BOT_TOKEN,
        auth_date=old_time,
    )
    with pytest.raises(SecurityError) as exc_info:
        verify_telegram_init_data(init_data, bot_token=BOT_TOKEN)
    assert exc_info.value.code == "EXPIRED_INIT_DATA"


def test_future_timestamp_rejection():
    """Verify initData with timestamps from future is rejected."""
    future_time = int(time.time()) + 300  # 5 minutes into the future
    init_data = create_valid_telegram_init_data(
        user_id=424242,
        bot_token=BOT_TOKEN,
        auth_date=future_time,
    )
    with pytest.raises(SecurityError) as exc_info:
        verify_telegram_init_data(init_data, bot_token=BOT_TOKEN)
    assert exc_info.value.code == "FUTURE_TIMESTAMP"


def test_test_auth_bypass_forbidden_in_production():
    """Section 13: Prove that test auth bypass is strictly blocked in production."""
    original_env = settings.APP_ENV
    try:
        settings.APP_ENV = "production"
        test_payload = json.dumps({"id": 12345, "username": "hacker"})
        header = f"tma-test {test_payload}"

        with pytest.raises(SecurityError) as exc_info:
            authenticate_tma_header(header, bot_token=BOT_TOKEN, allow_test_bypass=True)

        assert exc_info.value.code == "AUTH_BYPASS_FORBIDDEN_IN_PROD"
    finally:
        settings.APP_ENV = original_env


@pytest.mark.asyncio
async def test_auth_header_integration_with_api(async_client: AsyncClient):
    """Verify endpoint rejects missing or invalid auth header with standardized 401 JSON."""
    # 1. Missing header
    res1 = await async_client.get("/api/v1/profile")
    assert res1.status_code == 401
    assert res1.json()["error"]["code"] == "UNAUTHORIZED"

    # 2. Invalid header format
    res2 = await async_client.get("/api/v1/profile", headers={"Authorization": "Bearer token123"})
    assert res2.status_code == 401
    assert res2.json()["error"]["code"] == "UNSUPPORTED_SCHEME"

    # 3. Valid test bypass in test environment
    user_payload = json.dumps({"id": 777, "username": "lucky7", "first_name": "Lucky"})
    res3 = await async_client.get(
        "/api/v1/profile",
        headers={"Authorization": f"tma-test {user_payload}"},
    )
    assert res3.status_code == 200
    assert res3.json()["username"] == "lucky7"
