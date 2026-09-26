"""Unit tests for Purchase History and Share List routes."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_history_and_frequent_items(async_client: AsyncClient, auth_header_user1: dict[str, str]):
    """Verify that /api/v1/history returns date groups and frequent items for user."""
    headers = auth_header_user1

    # Create an item and mark purchased
    create_resp = await async_client.post(
        "/api/v1/items",
        headers=headers,
        json={"name": "Молоко", "quantity": 2.0, "unit": "л", "category": "Молочные продукты", "price": 12000.0},
    )
    assert create_resp.status_code in {200, 201}
    item_id = create_resp.json()["id"]

    # Toggle purchased
    toggle_resp = await async_client.patch(
        f"/api/v1/items/{item_id}/toggle",
        headers=headers,
        json={"version": 1},
    )
    assert toggle_resp.status_code == 200
    assert toggle_resp.json()["is_purchased"] is True

    # Query history
    hist_resp = await async_client.get("/api/v1/history", headers=headers)
    assert hist_resp.status_code == 200
    data = hist_resp.json()
    assert "groups" in data
    assert "frequent_items" in data
    assert len(data["groups"]) >= 1
    group = data["groups"][0]
    assert group["label"] == "Сегодня"
    assert group["item_count"] >= 1
    assert any(i["name"] == "Молоко" for i in group["items"])


@pytest.mark.asyncio
async def test_share_snapshot_lifecycle(async_client: AsyncClient, auth_header_user1: dict[str, str]):
    """Verify creating, viewing, and revoking a public read-only shared snapshot."""
    headers = auth_header_user1

    # Create share snapshot
    share_payload = {
        "title": "Список для плова",
        "items": [
            {"name": "Рис", "quantity": 1.0, "unit": "кг", "category": "Бакалея", "price": 20000.0},
            {"name": "Мясо", "quantity": 1.0, "unit": "кг", "category": "Мясо и рыба", "price": 95000.0},
        ],
    }
    create_resp = await async_client.post("/api/v1/share", headers=headers, json=share_payload)
    assert create_resp.status_code == 200
    share_data = create_resp.json()
    share_token = share_data["token"]
    assert len(share_token) >= 16
    assert share_data["item_count"] == 2

    # Public retrieval without auth header
    public_resp = await async_client.get(f"/api/v1/share/{share_token}")
    assert public_resp.status_code == 200
    public_data = public_resp.json()
    assert public_data["title"] == "Список для плова"
    assert len(public_data["items"]) == 2
    assert public_data["items"][0]["name"] == "Рис"
    # Ensure user_id is never leaked in public view
    assert "user_id" not in public_data

    # Revoke share
    del_resp = await async_client.delete(f"/api/v1/share/{share_token}", headers=headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["ok"] is True

    # Retrieval after revocation returns 404
    after_resp = await async_client.get(f"/api/v1/share/{share_token}")
    assert after_resp.status_code == 404
