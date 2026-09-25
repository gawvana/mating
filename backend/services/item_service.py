"""Item service encapsulating business rules for shopping items."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.schemas import (
    CreateItemRequest,
    MonthlyStatsResponse,
    ShoppingItemResponse,
    UpdateItemRequest,
)
from backend.repositories.item_repository import ItemRepository
from backend.repositories.user_repository import UserRepository


class ItemService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.item_repo = ItemRepository(session)
        self.user_repo = UserRepository(session)

    async def list_items(self, user_id: str) -> list[ShoppingItemResponse]:
        items = await self.item_repo.list_active(user_id)
        return [ShoppingItemResponse.model_validate(i) for i in items]

    async def create_item(
        self,
        user_id: str,
        data: CreateItemRequest,
    ) -> tuple[ShoppingItemResponse, bool]:
        # Fetch user's default currency if not provided
        currency = data.currency_code
        if not currency:
            user = await self.user_repo.get_by_id(user_id)
            currency = user.currency_code if user else "UZS"

        item, created = await self.item_repo.create_item(
            user_id=user_id,
            name=data.name,
            quantity=data.quantity,
            unit=data.unit,
            category=data.category,
            price=data.price,
            currency_code=currency,
            raw_input_text=data.raw_input_text,
            client_mutation_id=data.client_mutation_id,
        )
        return ShoppingItemResponse.model_validate(item), created

    async def batch_create(
        self,
        user_id: str,
        items_data: list[CreateItemRequest],
    ) -> list[ShoppingItemResponse]:
        results = []
        user = await self.user_repo.get_by_id(user_id)
        default_currency = user.currency_code if user else "UZS"

        for data in items_data:
            currency = data.currency_code or default_currency
            item, _ = await self.item_repo.create_item(
                user_id=user_id,
                name=data.name,
                quantity=data.quantity,
                unit=data.unit,
                category=data.category,
                price=data.price,
                currency_code=currency,
                raw_input_text=data.raw_input_text,
                client_mutation_id=data.client_mutation_id,
            )
            results.append(ShoppingItemResponse.model_validate(item))
        return results

    async def update_item(
        self,
        user_id: str,
        item_id: str,
        data: UpdateItemRequest,
    ) -> ShoppingItemResponse:
        update_fields = data.model_dump(exclude_unset=True, exclude={"version"})
        item = await self.item_repo.update_item(
            user_id=user_id,
            item_id=item_id,
            expected_version=data.version,
            updates=update_fields,
        )
        return ShoppingItemResponse.model_validate(item)

    async def toggle_purchased(
        self,
        user_id: str,
        item_id: str,
        expected_version: int,
    ) -> ShoppingItemResponse:
        item = await self.item_repo.toggle_purchased(
            user_id=user_id,
            item_id=item_id,
            expected_version=expected_version,
        )
        return ShoppingItemResponse.model_validate(item)

    async def soft_delete(self, user_id: str, item_id: str) -> ShoppingItemResponse:
        item = await self.item_repo.soft_delete(user_id, item_id)
        return ShoppingItemResponse.model_validate(item)

    async def restore_item(self, user_id: str, item_id: str) -> ShoppingItemResponse:
        item = await self.item_repo.restore_item(user_id, item_id)
        return ShoppingItemResponse.model_validate(item)

    async def clear_purchased(self, user_id: str) -> int:
        return await self.item_repo.clear_purchased(user_id)

    async def get_monthly_stats(
        self,
        user_id: str,
        year: int | None = None,
        month: int | None = None,
    ) -> MonthlyStatsResponse:
        now = datetime.now(timezone.utc)
        target_year = year or now.year
        target_month = month or now.month

        user = await self.user_repo.get_by_id(user_id)
        currency_code = user.currency_code if user else "UZS"
        monthly_budget = user.monthly_budget if user else None

        stats = await self.item_repo.get_monthly_stats(user_id, target_year, target_month)

        total_spent = stats["total_spent"]
        budget_remaining = None
        budget_usage_percent = None

        if monthly_budget is not None and monthly_budget > 0:
            budget_remaining = round(monthly_budget - total_spent, 2)
            budget_usage_percent = round((total_spent / monthly_budget) * 100, 1)

        return MonthlyStatsResponse(
            year=target_year,
            month=target_month,
            currency_code=currency_code,
            total_spent=total_spent,
            monthly_budget=monthly_budget,
            budget_remaining=budget_remaining,
            budget_usage_percent=budget_usage_percent,
            items_purchased_count=stats["items_purchased_count"],
            active_items_count=stats["active_items_count"],
            categories=stats["categories"],
        )
