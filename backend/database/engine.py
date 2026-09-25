"""Database engine and session management for Mating."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any
from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from backend.core.config import settings

# Configure engine parameters according to dialect and serverless environment
connect_args: dict[str, Any] = {}
engine_kwargs: dict[str, Any] = {
    "echo": settings.DEBUG,
    "future": True,
    "pool_pre_ping": True,
}

if "postgresql" in settings.DATABASE_URL:
    # Supabase Transaction Pooler (PgBouncer) compatibility:
    # Disable asyncpg prepared statement caching as required by transaction pooling
    connect_args["statement_cache_size"] = 0

    # Enforce SSL for remote Supabase / cloud connections
    if any(k in settings.DATABASE_URL for k in ("supabase", "pooler", "aws", "render", "neon")) or settings.is_production:
        connect_args["ssl"] = "require"

    # Serverless connection pool limits: prevent exhaustion on burst invocations
    engine_kwargs.update(
        pool_size=5,
        max_overflow=2,
        pool_recycle=300,
    )

engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    **engine_kwargs,
)

# Enable foreign keys for SQLite in local development / testing
if settings.DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for providing transactional database sessions."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
