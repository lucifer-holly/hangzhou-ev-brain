"""Smoke tests for /health and /version."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.fixture
async def client():
    from api.main import create_app

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def test_health_returns_ok(client: AsyncClient) -> None:
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


async def test_version_has_name_and_version(client: AsyncClient) -> None:
    r = await client.get("/version")
    assert r.status_code == 200
    body = r.json()
    assert "name" in body and "version" in body
