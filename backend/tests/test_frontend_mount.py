"""Test that the production static frontend bundle is served properly by FastAPI."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_frontend_static_serving(async_client: AsyncClient):
    response = await async_client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers.get("content-type", "")
    assert "Mating" in response.text
    assert "root" in response.text
