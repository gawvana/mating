"""User service managing profile and settings."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.schemas import SettingsUpdateRequest, UserResponse
from backend.repositories.user_repository import UserRepository


class UserService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)

    async def get_or_create_user(
        self,
        telegram_id_hash: str,
        username: str | None = None,
        first_name: str | None = None,
        language_code: str = "ru",
    ) -> UserResponse:
        user = await self.user_repo.get_or_create(
            telegram_id_hash=telegram_id_hash,
            username=username,
            first_name=first_name,
            language_code=language_code,
        )
        return UserResponse.model_validate(user)

    async def get_user_by_id(self, user_id: str) -> UserResponse | None:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            return None
        return UserResponse.model_validate(user)

    async def update_settings(
        self,
        user_id: str,
        settings_data: SettingsUpdateRequest,
    ) -> UserResponse:
        user = await self.user_repo.update_settings(
            user_id=user_id,
            language_code=settings_data.language_code,
            currency_code=settings_data.currency_code,
            city=settings_data.city,
            monthly_budget=settings_data.monthly_budget,
        )
        return UserResponse.model_validate(user)
