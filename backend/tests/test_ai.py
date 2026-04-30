"""Smoke tests for the 4 AI inference endpoints + their underlying models.

These tests rely on the *real* trained checkpoints in ``backend/ai/*/saved/``
so they're skipped automatically when those files are missing.  Running
``./scripts/train_all_models.sh`` materializes everything they need.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

_LSTM_CKPT = (
    Path(__file__).resolve().parent.parent / "ai" / "lstm_demand" / "saved" / "checkpoint.pt"
)
_XGB_CKPT = (
    Path(__file__).resolve().parent.parent / "ai" / "site_selection" / "saved" / "model.json"
)
_AE_CKPT = (
    Path(__file__).resolve().parent.parent / "ai" / "anomaly_detection" / "saved" / "autoencoder.pt"
)
_YOLO_SAMPLE = (
    Path(__file__).resolve().parent.parent
    / "ai"
    / "yolo_occupancy"
    / "sample_images"
    / "sample_bus.jpg"
)


@pytest.fixture
async def client(seeded_db: None):
    from api.main import create_app

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.skipif(
    not _LSTM_CKPT.exists(), reason="LSTM checkpoint missing — run train_all_models.sh"
)
async def test_lstm_inference_returns_valid_occupancy(client: AsyncClient) -> None:
    piles = (await client.get("/api/piles")).json()
    assert piles, "no piles in test DB"
    pile_id = piles[0]["id"]
    r = await client.post(
        "/api/ai/predict/demand",
        json={"pile_id": pile_id, "hours_ahead": 1},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert 0.0 <= body["predicted_occupancy"] <= 1.0
    assert 0.0 <= body["ci_low"] <= body["ci_high"] <= 1.0
    assert body["hours_ahead"] == 1


@pytest.mark.skipif(
    not _XGB_CKPT.exists(), reason="XGBoost model missing — run train_all_models.sh"
)
async def test_site_inference_returns_shap_top3(client: AsyncClient) -> None:
    body = {
        "lat": 30.275,
        "lng": 120.030,
        "pop_density_1km": 12000,
        "poi_mall_count": 5,
        "poi_office_count": 25,
        "poi_residential_count": 12,
        "existing_pile_count_1km": 4,
        "avg_utilization_1km": 0.32,
        "road_grade": 3,
        "operator": "state_grid",
    }
    r = await client.post("/api/ai/predict/site", json=body)
    assert r.status_code == 200, r.text
    out = r.json()
    assert 0.0 <= out["predicted_utilization_6m"] <= 1.0
    lo, hi = out["confidence_interval_95"]
    assert 0.0 <= lo <= hi <= 1.0
    assert len(out["shap_top3"]) == 3
    for entry in out["shap_top3"]:
        assert {"feature", "value", "shap_contribution"} <= entry.keys()


@pytest.mark.skipif(not _AE_CKPT.exists(), reason="Autoencoder missing — run train_all_models.sh")
async def test_anomaly_endpoint_returns_score(client: AsyncClient) -> None:
    piles = (await client.get("/api/piles")).json()
    assert piles
    pile_id = piles[0]["id"]
    r = await client.get(f"/api/ai/anomaly/{pile_id}")
    # 200 if the test DB has ≥ 32 hours of telemetry; else 404 (1-day seed
    # may produce only 24 rows).  Either is "endpoint plumbing works".
    assert r.status_code in (200, 404)
    if r.status_code == 200:
        body = r.json()
        assert body["pile_id"] == pile_id
        assert body["reconstruction_error"] >= 0
        assert body["threshold"] > 0


@pytest.mark.skipif(not _YOLO_SAMPLE.exists(), reason="YOLO sample image missing")
async def test_yolo_endpoint_detects_bus(client: AsyncClient) -> None:
    with _YOLO_SAMPLE.open("rb") as fp:
        r = await client.post(
            "/api/ai/yolo/detect",
            files={"image": ("sample_bus.jpg", fp, "image/jpeg")},
        )
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["vehicle_count"] >= 1
    assert out["inference_ms"] > 0
    classes = {b["class_name"] for b in out["boxes"]}
    assert "bus" in classes


@pytest.mark.skipif(not _LSTM_CKPT.exists(), reason="LSTM checkpoint missing")
def test_lstm_inference_function_unit() -> None:
    """Pure-Python smoke: feed a synthetic window through predict_window."""
    import numpy as np

    from ai.lstm_demand.inference import predict_window
    from ai.lstm_demand.model import INPUT_DIM, SEQ_LEN

    window = np.random.RandomState(0).rand(SEQ_LEN, INPUT_DIM).astype(np.float32)
    out = predict_window(window)
    assert 0.0 <= out.predicted_occupancy <= 1.0
