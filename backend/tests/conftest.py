"""Test configuration and fixtures for Mating backend."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
import urllib.parse
from collections.abc import AsyncGenerator
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.api.dependencies import get_current_user
from backend.api.main import app
from backend.core.config import settings
from backend.core.security import hash_telegram_id
from backend.database.engine import get_db
from backend.database.models import Base, User

TEST_DB_FILE = "./test_mating.db"
TEST_DB_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"

test_engine = create_async_engine(
    TEST_DB_URL,
    echo=False,
    future=True,
)

TestAsyncSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    """Create all tables before each test and drop after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with TestAsyncSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


def create_valid_telegram_init_data(
    user_id: int = 12345678,
    username: str = "testuser",
    first_name: str = "Test",
    bot_token: str = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    auth_date: int | None = None,
) -> str:
    """Generate valid cryptographically signed initData string."""
    if auth_date is None:
        auth_date = int(time.time())

    user_payload = {
        "id": user_id,
        "first_name": first_name,
        "username": username,
        "language_code": "ru",
    }

    params = {
        "auth_date": str(auth_date),
        "query_id": "AAHdF6IQAAAAAN0XohDhrOrc",
        "user": json.dumps(user_payload, separators=(",", ":")),
    }

    items = sorted(params.items(), key=lambda kv: kv[0])
    data_check_string = "\n".join(f"{k}={v}" for k, v in items)

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

    params["hash"] = calculated_hash
    return urllib.parse.urlencode(params)


@pytest_asyncio.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
def auth_header_user1() -> dict[str, str]:
    payload = json.dumps({"id": 11111, "username": "user1", "first_name": "User One"})
    return {"Authorization": f"tma-test {payload}"}


@pytest.fixture
def auth_header_user2() -> dict[str, str]:
    payload = json.dumps({"id": 22222, "username": "user2", "first_name": "User Two"})
    return {"Authorization": f"tma-test {payload}"}
