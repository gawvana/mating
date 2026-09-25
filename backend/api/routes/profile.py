"""User profile and settings routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_user
from backend.api.schemas import SettingsUpdateRequest, UserResponse
from backend.database.engine import get_db
from backend.database.models import User
from backend.services.user_service import UserService

router = APIRouter(prefix="/api/v1", tags=["Profile & Settings"])


@router.get("/profile", response_model=UserResponse)
async def get_profile(
    user: User = Depends(get_current_user),
):
    """Retrieve authenticated user profile."""
    return UserResponse.model_validate(user)


@router.put("/settings", response_model=UserResponse)
async def update_settings(
    settings_data: SettingsUpdateRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Update user language, currency, city, and budget preferences."""
    service = UserService(session)
    updated = await service.update_settings(user.id, settings_data)
    return updated
