"""Health check route."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import settings
from backend.database.engine import get_db

router = APIRouter(tags=["Health"])


@router.get("/api/health")
@router.get("/api/v1/health")
async def health_check(
    session: Annotated[AsyncSession, Depends(get_db)] = None,
):
    db_status = "connected"
    if session is not None:
        try:
            await session.execute(text("SELECT 1"))
        except Exception as e:
            db_status = f"unhealthy: {e}"

    return {
        "status": "ok" if db_status == "connected" else "degraded",
        "database": db_status,
        "app": "Mating",
        "env": settings.APP_ENV,
    }

