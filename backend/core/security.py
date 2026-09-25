"""Security and Telegram authentication validation for Mating."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
import urllib.parse
from typing import Any

from backend.core.config import settings


class SecurityError(Exception):
    """Base security error."""
    def __init__(self, message: str, code: str = "UNAUTHORIZED"):
        super().__init__(message)
        self.message = message
        self.code = code


def hash_telegram_id(telegram_id: int | str) -> str:
    """Generate SHA-256 hash of telegram user ID.
    NEVER store plaintext telegram ID in the database.
    """
    return hashlib.sha256(str(telegram_id).encode("utf-8")).hexdigest()


def verify_telegram_init_data(
    init_data_raw: str,
    bot_token: str,
    max_age_seconds: int = 86400,
) -> dict[str, Any]:
    """Validate Telegram Mini App initData according to Telegram guidelines.
    
    1. Parse query string
    2. Extract 'hash'
    3. Generate data-check-string with remaining key=value pairs sorted alphabetically
    4. Compute secret_key = HMAC-SHA256(b"WebAppData", bot_token)
    5. Compute signature = HMAC-SHA256(secret_key, data_check_string)
    6. Validate hash match, auth_date expiry and future timestamps.
    """
    if not init_data_raw:
        raise SecurityError("Missing Telegram initData", code="EMPTY_INIT_DATA")

    try:
        parsed_qsl = urllib.parse.parse_qsl(init_data_raw, keep_blank_values=True)
    except Exception as e:
        raise SecurityError(f"Malformed initData: {e}", code="MALFORMED_INIT_DATA")

    params: dict[str, str] = dict(parsed_qsl)
    received_hash = params.pop("hash", None)
    if not received_hash:
        raise SecurityError("Missing hash in initData", code="MISSING_HASH")

    # Build data_check_string
    items = sorted(params.items(), key=lambda kv: kv[0])
    data_check_string = "\n".join(f"{k}={v}" for k, v in items)

    # Derive secret key: HMAC_SHA256(b"WebAppData", bot_token)
    secret_key = hmac.new(
        key=b"WebAppData",
        msg=bot_token.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).digest()

    calculated_hash = hmac.new(
        key=secret_key,
        msg=data_check_string.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(calculated_hash.lower(), received_hash.lower()):
        raise SecurityError("Invalid HMAC hash signature", code="INVALID_SIGNATURE")

    # Validate auth_date
    auth_date_str = params.get("auth_date")
    if not auth_date_str:
        raise SecurityError("Missing auth_date in initData", code="MISSING_AUTH_DATE")

    try:
        auth_date = int(auth_date_str)
    except ValueError:
        raise SecurityError("Invalid auth_date format", code="INVALID_AUTH_DATE")

    now = int(time.time())
    # Reject timestamps from the future (> 60 seconds tolerance for clock skew)
    if auth_date > now + 60:
        raise SecurityError("auth_date is in the future", code="FUTURE_TIMESTAMP")

    # Reject expired initData (> max_age_seconds, default 24 hours)
    if now - auth_date > max_age_seconds:
        raise SecurityError("initData has expired", code="EXPIRED_INIT_DATA")

    # Parse user payload
    user_str = params.get("user")
    if not user_str:
        raise SecurityError("Missing user payload in initData", code="MISSING_USER")

    try:
        user_data = json.loads(user_str)
    except Exception as e:
        raise SecurityError(f"Invalid user JSON payload: {e}", code="MALFORMED_USER_PAYLOAD")

    if not isinstance(user_data, dict) or "id" not in user_data:
        raise SecurityError("User payload missing required 'id' field", code="INVALID_USER_DATA")

    return {
        "user": user_data,
        "auth_date": auth_date,
        "query_id": params.get("query_id"),
        "raw_params": params,
    }


def authenticate_tma_header(
    auth_header: str | None,
    bot_token: str,
    allow_test_bypass: bool = False,
) -> dict[str, Any]:
    """Parse and authenticate TMA Authorization header:
    Header format: 'tma <initData>' or 'tma-test <json>' (test bypass only when enabled)
    """
    if not auth_header:
        raise SecurityError("Authorization header required", code="UNAUTHORIZED")

    parts = auth_header.strip().split(" ", 1)
    if len(parts) != 2:
        raise SecurityError("Invalid Authorization header format", code="MALFORMED_AUTH_HEADER")

    scheme, token = parts[0], parts[1]

    if scheme.lower() == "tma-test":
        # Strictly forbid test bypass in production!
        if settings.is_production:
            raise SecurityError(
                "Test auth bypass is strictly prohibited in production",
                code="AUTH_BYPASS_FORBIDDEN_IN_PROD",
            )
        if not allow_test_bypass:
            raise SecurityError("Test auth bypass not permitted", code="BYPASS_NOT_PERMITTED")
        try:
            test_data = json.loads(token)
            if isinstance(test_data, (int, str)):
                test_data = {"id": int(test_data), "first_name": "Test User"}
            elif not isinstance(test_data, dict):
                test_data = {"id": 1, "first_name": "Test User"}
            return {
                "user": test_data,
                "auth_date": int(time.time()),
                "is_test": True,
            }
        except Exception:
            raise SecurityError("Malformed test auth payload", code="MALFORMED_TEST_PAYLOAD")

    if scheme.lower() != "tma":
        raise SecurityError(f"Unsupported authorization scheme: {scheme}", code="UNSUPPORTED_SCHEME")

    return verify_telegram_init_data(token, bot_token)
