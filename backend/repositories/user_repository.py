"""User repository for Mating."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.models import User, utcnow


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_telegram_hash(self, telegram_id_hash: str) -> User | None:
        """Fetch user by hashed Telegram ID."""
        stmt = select(User).where(User.telegram_id_hash == telegram_id_hash)
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def get_by_id(self, user_id: str) -> User | None:
        """Fetch user by internal UUID."""
        stmt = select(User).where(User.id == user_id)
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def get_or_create(
        self,
        telegram_id_hash: str,
        username: str | None = None,
        first_name: str | None = None,
        language_code: str = "ru",
    ) -> User:
        """Get existing user or create a new one."""
        user = await self.get_by_telegram_hash(telegram_id_hash)
        if user:
            # Sync any changed profile data
            changed = False
            if username and user.username != username:
                user.username = username
                changed = True
            if first_name and user.first_name != first_name:
                user.first_name = first_name
                changed = True
            if changed:
                user.updated_at = utcnow()
                await self.session.commit()
                await self.session.refresh(user)
            return user

        user = User(
            telegram_id_hash=telegram_id_hash,
            username=username,
            first_name=first_name,
            language_code=language_code if language_code in ("ru", "uz", "en") else "ru",
            currency_code="UZS",
        )
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def update_settings(
        self,
        user_id: str,
        language_code: str | None = None,
        currency_code: str | None = None,
        city: str | None = None,
        monthly_budget: float | None = None,
    ) -> User:
        """Update user preferences."""
        user = await self.get_by_id(user_id)
        if not user:
            raise ValueError(f"User {user_id} not found")

        if language_code is not None:
            user.language_code = language_code
        if currency_code is not None:
            user.currency_code = currency_code
        if city is not None:
            user.city = city
        if monthly_budget is not None:
            user.monthly_budget = monthly_budget

        user.updated_at = utcnow()
        await self.session.commit()
        await self.session.refresh(user)
        return user
