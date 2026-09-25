"""Health check route."""

from fastapi import APIRouter
from backend.core.config import settings

router = APIRouter(tags=["Health"])


@router.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "app": "Mating",
        "env": settings.APP_ENV,
    }
