"""4 AI inference endpoints exposed under ``/api/ai``.

* ``POST /api/ai/predict/demand`` — LSTM demand prediction for a pile.
* ``POST /api/ai/predict/site`` — XGBoost + SHAP site-selection score.
* ``GET  /api/ai/anomaly/{pile_id}`` — autoencoder reconstruction error.
* ``POST /api/ai/yolo/detect`` — YOLOv8 vehicle detection on an uploaded image.

Each handler is thin: it loads the corresponding cached model in
``ai.<module>.inference``, runs a single prediction, and returns a
Pydantic schema.  The trained checkpoints must exist on disk (see
``scripts/train_all_models.sh``) — otherwise we 503 with a clear
message rather than silently 500.
"""

from __future__ import annotations

import logging
import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field

from ai.lstm_demand.inference import (
    ModelNotTrainedError as LstmModelMissing,
    predict_pile as lstm_predict_pile,
)
from ai.site_selection.feature_engineering import SiteFeatures
from ai.site_selection.inference import (
    ModelNotTrainedError as XgbModelMissing,
    predict_site as xgb_predict_site,
)
from ai.anomaly_detection.inference import (
    ModelNotTrainedError as AeModelMissing,
    check_pile as ae_check_pile,
)
from ai.yolo_occupancy.inference import detect_image as yolo_detect_image

router = APIRouter(prefix="/api/ai", tags=["AI"])
log = logging.getLogger("api.routers.ai")


# ---------------------------- request / response models ----------------------------


class DemandRequest(BaseModel):
    pile_id: str = Field(..., description="Pile id (must exist in the DB).")
    hours_ahead: int = Field(default=1, ge=1, le=24, description="Forecast horizon in hours.")


class DemandResponse(BaseModel):
    pile_id: str
    hours_ahead: int
    predicted_occupancy: float = Field(..., ge=0, le=1)
    std: float = Field(..., ge=0)
    ci_low: float = Field(..., ge=0, le=1)
    ci_high: float = Field(..., ge=0, le=1)


class ShapContributionOut(BaseModel):
    feature: str
    value: float
    shap_contribution: float


class SiteResponse(BaseModel):
    predicted_utilization_6m: float = Field(..., ge=0, le=1)
    confidence_interval_95: tuple[float, float]
    shap_top3: list[ShapContributionOut]
    shap_base_value: float


class AnomalyResponse(BaseModel):
    pile_id: str
    is_anomaly: bool
    reconstruction_error: float = Field(..., ge=0)
    threshold: float = Field(..., ge=0)
    margin_ratio: float


class YoloBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float
    class_name: str


class YoloResponse(BaseModel):
    vehicle_count: int
    boxes: list[YoloBox]
    image_width: int
    image_height: int
    inference_ms: float


# ---------------------------- routes ----------------------------


@router.post("/predict/demand", response_model=DemandResponse, summary="LSTM demand prediction")
async def predict_demand(req: DemandRequest) -> DemandResponse:
    try:
        out = lstm_predict_pile(req.pile_id, hours_ahead=req.hours_ahead)
    except LstmModelMissing as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return DemandResponse(
        pile_id=req.pile_id,
        hours_ahead=out.hours_ahead,
        predicted_occupancy=out.predicted_occupancy,
        std=out.std,
        ci_low=out.ci_low,
        ci_high=out.ci_high,
    )


@router.post("/predict/site", response_model=SiteResponse, summary="XGBoost + SHAP site selection")
async def predict_site(features: SiteFeatures) -> SiteResponse:
    try:
        out = xgb_predict_site(features)
    except XgbModelMissing as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return SiteResponse(
        predicted_utilization_6m=out.predicted_utilization_6m,
        confidence_interval_95=out.confidence_interval_95,
        shap_top3=[
            ShapContributionOut(
                feature=c.feature,
                value=c.value,
                shap_contribution=c.shap_contribution,
            )
            for c in out.shap_top3
        ],
        shap_base_value=out.shap_base_value,
    )


@router.get(
    "/anomaly/{pile_id}",
    response_model=AnomalyResponse,
    summary="Autoencoder anomaly check",
)
async def check_anomaly(pile_id: str) -> AnomalyResponse:
    try:
        out = ae_check_pile(pile_id)
    except AeModelMissing as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return AnomalyResponse(
        pile_id=out.pile_id,
        is_anomaly=out.is_anomaly,
        reconstruction_error=out.reconstruction_error,
        threshold=out.threshold,
        margin_ratio=out.margin_ratio,
    )


@router.post("/yolo/detect", response_model=YoloResponse, summary="YOLOv8 occupancy detection")
async def yolo_detect(image: UploadFile = File(..., description="JPEG / PNG image of a parking area.")) -> YoloResponse:
    if image.content_type and not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail=f"unsupported content_type {image.content_type}")
    suffix = Path(image.filename or "upload.jpg").suffix or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(image.file, tmp)
        tmp_path = Path(tmp.name)
    try:
        result = yolo_detect_image(tmp_path)
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:  # pragma: no cover - cleanup best effort
            log.warning("failed to clean up temp upload %s", tmp_path)
    return YoloResponse(
        vehicle_count=result.vehicle_count,
        boxes=[YoloBox(**b.to_dict()) for b in result.boxes],
        image_width=result.image_width,
        image_height=result.image_height,
        inference_ms=result.inference_ms,
    )
