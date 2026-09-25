"""Tests for AI parsing pipeline, sanitization, and structured item extraction."""

import pytest
from httpx import AsyncClient

from backend.services.ai_service import sanitize_input


def test_sanitize_input():
    assert sanitize_input("   молоко   2л\n,   хлеб   ") == "молоко 2л , хлеб"
    long_text = "а" * 600
    sanitized = sanitize_input(long_text)
    assert len(sanitized) == 500


@pytest.mark.asyncio
async def test_ai_parse_endpoint_main_use_case(
    async_client: AsyncClient,
    auth_header_user1: dict[str, str],
):
    """Section 2: Main use case: 'молоко 2л, картошка 3кг, хлеб, яйца 10шт'."""
    raw_text = "молоко 2л, картошка 3кг, хлеб, яйца 10шт"
    res = await async_client.post(
        "/api/v1/ai/parse",
        json={"text": raw_text},
        headers=auth_header_user1,
    )
    assert res.status_code == 200
    data = res.json()
    items = data["items"]
    assert len(items) == 4

    names = [i["name"].lower() for i in items]
    assert any("молок" in n for n in names)
    assert any("картош" in n or "картоф" in n for n in names)
    assert any("хлеб" in n for n in names)
    assert any("яйц" in n for n in names)

    # Section 25: No fake prices! If price not specified, estimated_price must be None
    for item in items:
        assert item["estimated_price"] is None
        assert 0.0 <= item["confidence"] <= 1.0
        assert item["quantity"] > 0
        assert item["unit"] != ""


@pytest.mark.asyncio
async def test_ai_parse_with_explicit_price(
    async_client: AsyncClient,
    auth_header_user1: dict[str, str],
):
    """Section 25: Price is extracted when explicitly mentioned, otherwise null."""
    res = await async_client.post(
        "/api/v1/ai/parse",
        json={"text": "масло 15000 сум, сыр 300г"},
        headers=auth_header_user1,
    )
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 2

    butter = next(i for i in items if "масло" in i["name"].lower())
    assert butter["estimated_price"] == 15000.0

    cheese = next(i for i in items if "сыр" in i["name"].lower())
    assert cheese["estimated_price"] is None
