"""Item repository for Mating with strict user isolation, idempotency, and optimistic concurrency."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.models import ShoppingItem, utcnow


class OptimisticLockError(Exception):
    """Raised when item version does not match expected version."""
    def __init__(self, item_id: str, current_version: int, expected_version: int):
        super().__init__(
            f"Version conflict on item {item_id}: expected {expected_version}, current {current_version}"
        )
        self.item_id = item_id
        self.current_version = current_version
        self.expected_version = expected_version


class ItemNotFoundError(Exception):
    """Raised when item is not found or not owned by the user."""
    def __init__(self, item_id: str):
        super().__init__(f"Item {item_id} not found")
        self.item_id = item_id


class ItemRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_active(self, user_id: str) -> list[ShoppingItem]:
        """List active items for user (deleted_at is NULL).
        Ordered: unpurchased first, then purchased.
        """
        stmt = (
            select(ShoppingItem)
            .where(
                ShoppingItem.user_id == user_id,
                ShoppingItem.deleted_at.is_(None),
            )
            .order_by(
                ShoppingItem.is_purchased.asc(),
                ShoppingItem.created_at.desc(),
            )
        )
        res = await self.session.execute(stmt)
        return list(res.scalars().all())

    async def get_by_id(
        self,
        user_id: str,
        item_id: str,
        include_deleted: bool = False,
        for_update: bool = False,
    ) -> ShoppingItem | None:
        """Fetch item strictly scoped by user_id and item_id."""
        conditions = [
            ShoppingItem.id == item_id,
            ShoppingItem.user_id == user_id,
        ]
        if not include_deleted:
            conditions.append(ShoppingItem.deleted_at.is_(None))

        stmt = select(ShoppingItem).where(*conditions)
        if for_update:
            stmt = stmt.with_for_update()
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def create_item(
        self,
        user_id: str,
        name: str,
        quantity: float = 1.0,
        unit: str = "шт",
        category: str = "Другое",
        price: float | None = None,
        currency_code: str = "UZS",
        raw_input_text: str | None = None,
        client_mutation_id: str | None = None,
    ) -> tuple[ShoppingItem, bool]:
        """Create a new item with idempotency support.
        Returns (item, is_created). If client_mutation_id already exists for this user,
        returns existing item and False.
        """
        if client_mutation_id:
            # Check for existing item with this mutation ID
            stmt = select(ShoppingItem).where(
                ShoppingItem.user_id == user_id,
                ShoppingItem.client_mutation_id == client_mutation_id,
            )
            res = await self.session.execute(stmt)
            existing = res.scalar_one_or_none()
            if existing:
                return existing, False

        item = ShoppingItem(
            user_id=user_id,
            name=name.strip(),
            quantity=quantity,
            unit=unit.strip(),
            category=category.strip(),
            price=price,
            currency_code=currency_code,
            is_purchased=False,
            raw_input_text=raw_input_text,
            client_mutation_id=client_mutation_id,
            version=1,
            deleted_at=None,
        )
        self.session.add(item)
        try:
            await self.session.commit()
            await self.session.refresh(item)
            return item, True
        except IntegrityError:
            await self.session.rollback()
            if client_mutation_id:
                stmt = select(ShoppingItem).where(
                    ShoppingItem.user_id == user_id,
                    ShoppingItem.client_mutation_id == client_mutation_id,
                )
                res = await self.session.execute(stmt)
                existing = res.scalar_one_or_none()
                if existing:
                    return existing, False
            raise

    async def update_item(
        self,
        user_id: str,
        item_id: str,
        expected_version: int,
        updates: dict[str, Any],
    ) -> ShoppingItem:
        """Update item fields with optimistic concurrency locking."""
        item = await self.get_by_id(user_id, item_id, for_update=True)
        if not item:
            raise ItemNotFoundError(item_id)

        if item.version != expected_version:
            raise OptimisticLockError(item_id, item.version, expected_version)

        for key, val in updates.items():
            if hasattr(item, key) and val is not None:
                setattr(item, key, val)

        item.version += 1
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def toggle_purchased(
        self,
        user_id: str,
        item_id: str,
        expected_version: int,
    ) -> ShoppingItem:
        """Toggle purchased status with optimistic locking and update purchased_at."""
        item = await self.get_by_id(user_id, item_id, for_update=True)
        if not item:
            raise ItemNotFoundError(item_id)

        if item.version != expected_version:
            raise OptimisticLockError(item_id, item.version, expected_version)

        item.is_purchased = not item.is_purchased
        if item.is_purchased:
            item.purchased_at = utcnow()
        else:
            item.purchased_at = None

        item.version += 1
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def soft_delete(self, user_id: str, item_id: str) -> ShoppingItem:
        """Soft delete an item (retains all data for undo & stats)."""
        item = await self.get_by_id(user_id, item_id)
        if not item:
            raise ItemNotFoundError(item_id)

        item.deleted_at = utcnow()
        item.version += 1
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def restore_item(self, user_id: str, item_id: str) -> ShoppingItem:
        """Restore a soft-deleted item (Undo)."""
        item = await self.get_by_id(user_id, item_id, include_deleted=True)
        if not item:
            raise ItemNotFoundError(item_id)

        item.deleted_at = None
        item.version += 1
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def clear_purchased(self, user_id: str) -> int:
        """Soft-delete all currently purchased items.
        Keeps purchased_at so monthly statistics remain accurate!
        """
        now = utcnow()
        stmt = (
            update(ShoppingItem)
            .where(
                ShoppingItem.user_id == user_id,
                ShoppingItem.is_purchased.is_(True),
                ShoppingItem.deleted_at.is_(None),
            )
            .values(deleted_at=now, version=ShoppingItem.version + 1)
        )
        res = await self.session.execute(stmt)
        await self.session.commit()
        return res.rowcount

    async def get_monthly_stats(
        self,
        user_id: str,
        year: int,
        month: int,
    ) -> dict[str, Any]:
        """Compute monthly stats using purchased_at timestamps."""
        start_date = datetime(year, month, 1, 0, 0, 0, tzinfo=timezone.utc)
        if month == 12:
            end_date = datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        else:
            end_date = datetime(year, month + 1, 1, 0, 0, 0, tzinfo=timezone.utc)

        # Purchased items during this month (including soft-deleted)
        stmt = select(ShoppingItem).where(
            ShoppingItem.user_id == user_id,
            ShoppingItem.is_purchased.is_(True),
            ShoppingItem.purchased_at >= start_date,
            ShoppingItem.purchased_at < end_date,
        )
        res = await self.session.execute(stmt)
        purchased_items = list(res.scalars().all())

        # Count active unpurchased items
        active_count_stmt = select(func.count(ShoppingItem.id)).where(
            ShoppingItem.user_id == user_id,
            ShoppingItem.deleted_at.is_(None),
            ShoppingItem.is_purchased.is_(False),
        )
        active_res = await self.session.execute(active_count_stmt)
        active_count = active_res.scalar() or 0

        total_spent = sum((item.price or 0.0) * (item.quantity or 1.0) for item in purchased_items)
        categories_map: dict[str, dict[str, Any]] = {}
        for item in purchased_items:
            cat = item.category or "Другое"
            if cat not in categories_map:
                categories_map[cat] = {"category": cat, "amount": 0.0, "count": 0}
            categories_map[cat]["amount"] += (item.price or 0.0) * (item.quantity or 1.0)
            categories_map[cat]["count"] += 1

        cat_list = []
        for cat, data in sorted(categories_map.items(), key=lambda kv: kv[1]["amount"], reverse=True):
            pct = round((data["amount"] / total_spent * 100), 1) if total_spent > 0 else 0.0
            cat_list.append({
                "category": cat,
                "amount": round(data["amount"], 2),
                "count": data["count"],
                "percentage": pct,
            })

        return {
            "year": year,
            "month": month,
            "total_spent": round(total_spent, 2),
            "items_purchased_count": len(purchased_items),
            "active_items_count": active_count,
            "categories": cat_list,
        }
