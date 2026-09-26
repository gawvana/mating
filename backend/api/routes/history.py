"""Purchase history and recurring item detection routes."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_user
from backend.database.engine import get_db
from backend.database.models import ShoppingItem, User

router = APIRouter(prefix="/api/v1/history", tags=["Purchase History"])

MONTH_NAMES_RU = [
    "", "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
]


class HistoryItem(BaseModel):
    id: str
    name: str
    quantity: float
    unit: str
    category: str
    price: float | None
    currency_code: str
    purchased_at: datetime | None


class HistoryGroup(BaseModel):
    date: str
    label: str
    total_spent: float
    item_count: int
    currency_code: str
    items: list[HistoryItem]


class FrequentItem(BaseModel):
    name: str
    category: str
    count: int
    every_days: int


class HistoryResponse(BaseModel):
    groups: list[HistoryGroup]
    frequent_items: list[FrequentItem]


def format_date_label(dt: datetime, today: datetime) -> str:
    """Format date label into 'Сегодня', 'Вчера', or 'DD месяца'."""
    delta = (today.date() - dt.date()).days
    if delta == 0:
        return "Сегодня"
    if delta == 1:
        return "Вчера"
    m_name = MONTH_NAMES_RU[dt.month] if 1 <= dt.month <= 12 else ""
    return f"{dt.day} {m_name}".strip()


@router.get("", response_model=HistoryResponse)
async def get_purchase_history(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Retrieve date-grouped purchase history and frequent recurring purchases."""
    stmt = (
        select(ShoppingItem)
        .where(
            ShoppingItem.user_id == user.id,
            ShoppingItem.purchased_at.is_not(None),
        )
        .order_by(ShoppingItem.purchased_at.desc())
    )
    res = await session.execute(stmt)
    purchased_items = list(res.scalars().all())

    now = datetime.now(timezone.utc)
    groups_dict: dict[str, list[ShoppingItem]] = defaultdict(list)
    item_purchase_dates: dict[str, list[datetime]] = defaultdict(list)
    item_categories: dict[str, str] = {}

    for it in purchased_items:
        if not it.purchased_at:
            continue
        p_date = it.purchased_at.strftime("%Y-%m-%d")
        groups_dict[p_date].append(it)

        canonical_key = it.name.strip().lower()
        item_purchase_dates[canonical_key].append(it.purchased_at)
        item_categories[canonical_key] = it.category

    # Build date groups
    groups: list[HistoryGroup] = []
    for date_str, items in groups_dict.items():
        sample_dt = items[0].purchased_at or now
        label = format_date_label(sample_dt, now)
        total = sum(i.quantity * (i.price or 0.0) for i in items if i.price is not None)

        group_items = [
            HistoryItem(
                id=i.id,
                name=i.name,
                quantity=i.quantity,
                unit=i.unit,
                category=i.category,
                price=i.price,
                currency_code=i.currency_code,
                purchased_at=i.purchased_at,
            )
            for i in items
        ]

        groups.append(
            HistoryGroup(
                date=date_str,
                label=label,
                total_spent=round(total, 2),
                item_count=len(items),
                currency_code=user.currency_code,
                items=group_items,
            )
        )

    # Sort groups desc by date
    groups.sort(key=lambda g: g.date, reverse=True)

    # Detect frequent recurring purchases
    frequent: list[FrequentItem] = []
    for key, timestamps in item_purchase_dates.items():
        if len(timestamps) >= 2:
            # Sort timestamps asc
            sorted_ts = sorted(timestamps)
            span_days = max(1, (sorted_ts[-1] - sorted_ts[0]).days)
            interval = max(1, round(span_days / (len(sorted_ts) - 1)))
            # Sample name with original casing
            display_name = next(i.name for i in purchased_items if i.name.strip().lower() == key)
            frequent.append(
                FrequentItem(
                    name=display_name,
                    category=item_categories.get(key, "Другое"),
                    count=len(timestamps),
                    every_days=interval,
                )
            )

    frequent.sort(key=lambda x: x.count, reverse=True)

    return HistoryResponse(groups=groups, frequent_items=frequent[:8])
