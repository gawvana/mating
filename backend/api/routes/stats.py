"""Monthly statistics routes."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_user
from backend.api.schemas import MonthlyStatsResponse
from backend.database.engine import get_db
from backend.database.models import User
from backend.services.item_service import ItemService

router = APIRouter(prefix="/api/v1/stats", tags=["Statistics"])


@router.get("/monthly", response_model=MonthlyStatsResponse)
async def get_monthly_stats(
    year: int | None = Query(None, ge=2020, le=2100),
    month: int | None = Query(None, ge=1, le=12),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Retrieve monthly spending and budget analytics."""
    service = ItemService(session)
    return await service.get_monthly_stats(user.id, year=year, month=month)
