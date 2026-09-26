"""Tests for items operations: isolation, idempotency, optimistic locking, and soft delete."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_user_isolation(
    async_client: AsyncClient,
    auth_header_user1: dict[str, str],
    auth_header_user2: dict[str, str],
):
    """Section 11: User A must never access User B's items."""
    # 1. User 1 creates an item
    create_resp = await async_client.post(
        "/api/v1/items",
        json={"name": "Secret Milk", "quantity": 2.0, "unit": "л"},
        headers=auth_header_user1,
    )
    assert create_resp.status_code == 201
    item_user1 = create_resp.json()
    item_id = item_user1["id"]

    # 2. User 2 lists items -> should be empty
    list_user2 = await async_client.get("/api/v1/items", headers=auth_header_user2)
    assert list_user2.status_code == 200
    assert len(list_user2.json()) == 0

    # 3. User 2 tries to update User 1's item -> 404 Not Found
    update_user2 = await async_client.patch(
        f"/api/v1/items/{item_id}",
        json={"name": "Hacked Milk", "version": 1},
        headers=auth_header_user2,
    )
    assert update_user2.status_code == 404
    assert update_user2.json()["error"]["code"] == "ITEM_NOT_FOUND"

    # 4. User 2 tries to toggle User 1's item -> 404 Not Found
    toggle_user2 = await async_client.patch(
        f"/api/v1/items/{item_id}/toggle",
        json={"version": 1},
        headers=auth_header_user2,
    )
    assert toggle_user2.status_code == 404

    # 5. User 2 tries to delete User 1's item -> 404 Not Found
    delete_user2 = await async_client.delete(
        f"/api/v1/items/{item_id}",
        headers=auth_header_user2,
    )
    assert delete_user2.status_code == 404


@pytest.mark.asyncio
async def test_idempotency_with_mutation_id(
    async_client: AsyncClient,
    auth_header_user1: dict[str, str],
):
    """Section 19: Double click / network retry with same client_mutation_id must not create duplicate."""
    mutation_id = "mutation-uuid-12345"

    payload = {
        "name": "Яблоки",
        "quantity": 1.5,
        "unit": "кг",
        "client_mutation_id": mutation_id,
    }

    # First request -> 201 Created
    res1 = await async_client.post("/api/v1/items", json=payload, headers=auth_header_user1)
    assert res1.status_code == 201
    item1 = res1.json()

    # Second request with same mutation_id -> 200 OK, returns identical item
    res2 = await async_client.post("/api/v1/items", json=payload, headers=auth_header_user1)
    assert res2.status_code == 200
    item2 = res2.json()

    assert item1["id"] == item2["id"]
    assert item1["client_mutation_id"] == mutation_id

    # Total items in DB should be exactly 1
    list_res = await async_client.get("/api/v1/items", headers=auth_header_user1)
    assert len(list_res.json()) == 1


@pytest.mark.asyncio
async def test_optimistic_concurrency_locking(
    async_client: AsyncClient,
    auth_header_user1: dict[str, str],
):
    """Section 20: Version mismatch must return 409 Conflict."""
    create_resp = await async_client.post(
        "/api/v1/items",
        json={"name": "Хлеб", "quantity": 1.0, "unit": "шт"},
        headers=auth_header_user1,
    )
    item = create_resp.json()
    item_id = item["id"]
    assert item["version"] == 1

    # First update succeeds with version=1 -> version becomes 2
    update_res1 = await async_client.patch(
        f"/api/v1/items/{item_id}",
        json={"name": "Бородинский хлеб", "version": 1},
        headers=auth_header_user1,
    )
    assert update_res1.status_code == 200
    updated_item = update_res1.json()
    assert updated_item["name"] == "Бородинский хлеб"
    assert updated_item["version"] == 2

    # Concurrent/stale update trying version=1 again -> 409 Conflict!
    stale_update = await async_client.patch(
        f"/api/v1/items/{item_id}",
        json={"name": "Белый хлеб", "version": 1},
        headers=auth_header_user1,
    )
    assert stale_update.status_code == 409
    assert stale_update.json()["error"]["code"] == "VERSION_CONFLICT"

    # Toggle with outdated version -> 409 Conflict
    stale_toggle = await async_client.patch(
        f"/api/v1/items/{item_id}/toggle",
        json={"version": 1},
        headers=auth_header_user1,
    )
    assert stale_toggle.status_code == 409
    assert stale_toggle.json()["error"]["code"] == "VERSION_CONFLICT"

    # Toggle with correct version=2 -> succeeds and increments to 3
    valid_toggle = await async_client.patch(
        f"/api/v1/items/{item_id}/toggle",
        json={"version": 2},
        headers=auth_header_user1,
    )
    assert valid_toggle.status_code == 200
    assert valid_toggle.json()["is_purchased"] is True
    assert valid_toggle.json()["version"] == 3
    assert valid_toggle.json()["purchased_at"] is not None


@pytest.mark.asyncio
async def test_soft_delete_and_undo_restore(
    async_client: AsyncClient,
    auth_header_user1: dict[str, str],
):
    """Section 21: Soft delete enables Undo without data loss."""
    create_resp = await async_client.post(
        "/api/v1/items",
        json={"name": "Картофель", "quantity": 5.0, "unit": "кг", "category": "Овощи и фрукты"},
        headers=auth_header_user1,
    )
    item_id = create_resp.json()["id"]

    # Delete item
    del_res = await async_client.delete(f"/api/v1/items/{item_id}", headers=auth_header_user1)
    assert del_res.status_code == 200
    assert del_res.json()["deleted_at"] is not None

    # Should not appear in active list
    list_res = await async_client.get("/api/v1/items", headers=auth_header_user1)
    assert len(list_res.json()) == 0

    # Restore (Undo)
    restore_res = await async_client.post(f"/api/v1/items/{item_id}/restore", headers=auth_header_user1)
    assert restore_res.status_code == 200
    assert restore_res.json()["deleted_at"] is None
    assert restore_res.json()["name"] == "Картофель"
    assert restore_res.json()["quantity"] == 5.0

    # Reappears in active list
    list_after = await async_client.get("/api/v1/items", headers=auth_header_user1)
    assert len(list_after.json()) == 1


@pytest.mark.asyncio
async def test_clear_purchased(
    async_client: AsyncClient,
    auth_header_user1: dict[str, str],
):
    """Section 22: Clear purchased soft deletes purchased items but keeps active ones."""
    # Create item 1 (unpurchased)
    await async_client.post("/api/v1/items", json={"name": "Чай", "quantity": 1.0}, headers=auth_header_user1)

    # Create item 2 and mark purchased
    item2_res = await async_client.post("/api/v1/items", json={"name": "Кофе", "quantity": 1.0}, headers=auth_header_user1)
    item2_id = item2_res.json()["id"]
    await async_client.patch(f"/api/v1/items/{item2_id}/toggle", json={"version": 1}, headers=auth_header_user1)

    # Clear purchased
    clear_res = await async_client.post("/api/v1/items/clear-purchased", headers=auth_header_user1)
    assert clear_res.status_code == 200
    assert clear_res.json()["cleared_count"] == 1

    # Active items should now only contain item 1 ("Чай")
    remaining = await async_client.get("/api/v1/items", headers=auth_header_user1)
    items = remaining.json()
    assert len(items) == 1
    assert items[0]["name"] == "Чай"
