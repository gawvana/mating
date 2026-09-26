"""Tests for monthly statistics calculation and budget tracking."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_monthly_stats_calculation_and_budget(
    async_client: AsyncClient,
    auth_header_user1: dict[str, str],
):
    """Section 22 & 34: Stats uses purchased_at and preserves accuracy after clear_purchased."""
    # 1. Update user settings with monthly budget
    settings_res = await async_client.put(
        "/api/v1/settings",
        json={"monthly_budget": 500000.0, "currency_code": "UZS"},
        headers=auth_header_user1,
    )
    assert settings_res.status_code == 200
    assert settings_res.json()["monthly_budget"] == 500000.0

    # 2. Add Item 1: 50,000 UZS (Dairy) -> purchased
    i1 = await async_client.post(
        "/api/v1/items",
        json={"name": "Сыр", "quantity": 1, "unit": "шт", "category": "Молочные продукты", "price": 50000.0},
        headers=auth_header_user1,
    )
    await async_client.patch(f"/api/v1/items/{i1.json()['id']}/toggle", json={"version": 1}, headers=auth_header_user1)

    # 3. Add Item 2: 100,000 UZS (Meat) -> purchased
    i2 = await async_client.post(
        "/api/v1/items",
        json={"name": "Говядина", "quantity": 1, "unit": "кг", "category": "Мясо и рыба", "price": 100000.0},
        headers=auth_header_user1,
    )
    await async_client.patch(f"/api/v1/items/{i2.json()['id']}/toggle", json={"version": 1}, headers=auth_header_user1)

    # 4. Add Item 3: 20,000 UZS (Bread) -> unpurchased
    await async_client.post(
        "/api/v1/items",
        json={"name": "Хлеб", "quantity": 2, "unit": "шт", "category": "Хлеб и выпечка", "price": 20000.0},
        headers=auth_header_user1,
    )

    # 5. Clear purchased items (soft delete)
    clear_res = await async_client.post("/api/v1/items/clear-purchased", headers=auth_header_user1)
    assert clear_res.status_code == 200
    assert clear_res.json()["cleared_count"] == 2

    # 6. Fetch stats -> must still report 150,000 spent!
    stats_res = await async_client.get("/api/v1/stats/monthly", headers=auth_header_user1)
    assert stats_res.status_code == 200
    data = stats_res.json()

    assert data["total_spent"] == 150000.0
    assert data["monthly_budget"] == 500000.0
    assert data["budget_remaining"] == 350000.0
    assert data["budget_usage_percent"] == 30.0
    assert data["items_purchased_count"] == 2
    assert data["active_items_count"] == 1

    # Verify category breakdown
    categories = {c["category"]: c for c in data["categories"]}
    assert "Мясо и рыба" in categories
    assert categories["Мясо и рыба"]["amount"] == 100000.0
    assert categories["Мясо и рыба"]["percentage"] == 66.7

    assert "Молочные продукты" in categories
    assert categories["Молочные продукты"]["amount"] == 50000.0
    assert categories["Молочные продукты"]["percentage"] == 33.3


@pytest.mark.asyncio
async def test_monthly_stats_quantity_multiplication(
    async_client: AsyncClient,
    auth_header_user1: dict[str, str],
):
    """Section 26: Price calculation MUST strictly compute line_total = quantity * unit_price."""
    # Add Item: 3 packs of butter at 25,000 UZS each -> line_total = 75,000 UZS
    i1 = await async_client.post(
        "/api/v1/items",
        json={"name": "Масло", "quantity": 3.0, "unit": "уп", "category": "Молочные продукты", "price": 25000.0},
        headers=auth_header_user1,
    )
    assert i1.status_code == 201
    await async_client.patch(f"/api/v1/items/{i1.json()['id']}/toggle", json={"version": 1}, headers=auth_header_user1)

    # Fetch stats
    stats_res = await async_client.get("/api/v1/stats/monthly", headers=auth_header_user1)
    assert stats_res.status_code == 200
    data = stats_res.json()

    # The newly purchased item must contribute 3 * 25,000 = 75,000
    dairy = next(c for c in data["categories"] if c["category"] == "Молочные продукты")
    assert dairy["amount"] >= 75000.0
