"""Integration tests against /api/piles, /api/operators, /api/regions, /api/events.

These run against an asgi-transport AsyncClient — no real network bind — so
they exercise the full FastAPI dependency tree against a real (small) seeded
SQLite DB.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.fixture
async def client(seeded_db):  # noqa: ARG001  (fixture used for its side-effect)
    from api.main import create_app

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ---------------- /api/piles ----------------


async def test_list_piles_returns_100(client: AsyncClient) -> None:
    r = await client.get("/api/piles")
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, list)
    assert len(body) == 100


async def test_list_piles_have_required_fields(client: AsyncClient) -> None:
    r = await client.get("/api/piles")
    pile = r.json()[0]
    expected = {
        "id",
        "operator_id",
        "region_id",
        "lat",
        "lng",
        "capacity_kw",
        "connector_type",
        "installed_at",
        "subsidy_amount",
        "subsidy_group",
        "current_status",
        "current_voltage",
        "current_current",
        "current_power",
        "current_occupancy",
        "last_seen_at",
    }
    assert expected <= set(pile.keys())


async def test_pile_lat_lng_in_hangzhou_box(client: AsyncClient) -> None:
    r = await client.get("/api/piles")
    for pile in r.json():
        assert 30.2 <= pile["lat"] <= 30.4
        assert 119.9 <= pile["lng"] <= 120.5


async def test_filter_by_region(client: AsyncClient) -> None:
    r = await client.get("/api/piles", params={"region": "future_tech_city"})
    assert r.status_code == 200
    piles = r.json()
    assert len(piles) == 60
    assert all(p["region_id"] == "future_tech_city" for p in piles)


async def test_filter_by_operator(client: AsyncClient) -> None:
    r = await client.get("/api/piles", params={"operator": "state_grid"})
    assert r.status_code == 200
    assert all(p["operator_id"] == "state_grid" for p in r.json())
    assert len(r.json()) == 50


async def test_pile_detail_has_summary(client: AsyncClient) -> None:
    r = await client.get("/api/piles")
    pile_id = r.json()[0]["id"]
    detail = await client.get(f"/api/piles/{pile_id}")
    assert detail.status_code == 200
    body = detail.json()
    assert "summary_24h" in body
    assert {"avg_occupancy", "peak_occupancy", "total_energy_kwh", "fault_count"} <= set(
        body["summary_24h"].keys()
    )


async def test_pile_detail_404(client: AsyncClient) -> None:
    r = await client.get("/api/piles/does-not-exist")
    assert r.status_code == 404


async def test_pile_telemetry_returns_rows(client: AsyncClient) -> None:
    pile_id = (await client.get("/api/piles")).json()[0]["id"]
    r = await client.get(f"/api/piles/{pile_id}/telemetry", params={"limit": 50})
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    assert len(rows) > 0
    assert {"ts", "voltage", "current", "power", "occupancy_rate", "status"} <= set(rows[0].keys())


# ---------------- /api/operators ----------------


async def test_list_operators_returns_four(client: AsyncClient) -> None:
    r = await client.get("/api/operators")
    assert r.status_code == 200
    operators = r.json()
    assert len(operators) == 4
    ids = {o["id"] for o in operators}
    assert ids == {"state_grid", "teld", "starcharge", "nio"}


async def test_operator_pile_counts_match_spec(client: AsyncClient) -> None:
    r = await client.get("/api/operators")
    counts = {o["id"]: o["pile_count"] for o in r.json()}
    assert counts == {"state_grid": 50, "teld": 25, "starcharge": 15, "nio": 10}


# ---------------- /api/regions ----------------


async def test_list_regions_returns_two(client: AsyncClient) -> None:
    r = await client.get("/api/regions")
    assert r.status_code == 200
    regions = r.json()
    assert len(regions) == 2
    ids = {x["id"] for x in regions}
    assert ids == {"future_tech_city", "qiantang_new_area"}


async def test_region_pile_counts_match_60_40(client: AsyncClient) -> None:
    r = await client.get("/api/regions")
    counts = {x["id"]: x["pile_count"] for x in r.json()}
    assert counts == {"future_tech_city": 60, "qiantang_new_area": 40}


# ---------------- /api/events ----------------


async def test_list_events_returns_some(client: AsyncClient) -> None:
    """Even a 1-day seed should produce comm-loss events at ~1%/hour/100 piles ≈ 24."""
    r = await client.get("/api/events", params={"limit": 200})
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    # Tolerant assertion — exact count depends on seed.
    assert len(rows) > 0


async def test_filter_events_by_type(client: AsyncClient) -> None:
    r = await client.get(
        "/api/events", params={"type": "communication_loss", "limit": 50}
    )
    assert r.status_code == 200
    rows = r.json()
    assert all(r_["type"] == "communication_loss" for r_ in rows)


# ---------------- /docs ----------------


async def test_openapi_doc_present(client: AsyncClient) -> None:
    r = await client.get("/openapi.json")
    assert r.status_code == 200
    schema = r.json()
    assert "paths" in schema
    assert "/api/piles" in schema["paths"]
    assert "/api/operators" in schema["paths"]
    assert "/api/events" in schema["paths"]
