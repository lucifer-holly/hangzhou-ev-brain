"""City-wide aggregate statistics — drives the IOC homepage bottom strip."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api import models
from api.deps import get_session

log = logging.getLogger("api.routers.stats")

router = APIRouter(prefix="/api/stats", tags=["stats"])


class HourlyOccupancy(BaseModel):
    hour: int = Field(..., ge=0, le=23, description="Hour of day, 0-23 in UTC.")
    avg_occupancy: float = Field(..., ge=0, le=1)
    sample_count: int = Field(..., ge=0)


class Utilization24hResponse(BaseModel):
    generated_at: datetime
    hourly: list[HourlyOccupancy]


@router.get(
    "/utilization-24h",
    response_model=Utilization24hResponse,
    summary="Citywide hourly utilization for the last 24 hours",
)
async def utilization_24h(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Utilization24hResponse:
    """Return 24 hourly buckets of average occupancy across all piles.

    Used by the IOC homepage bottom-strip line chart. Each bucket is an
    hour-of-day (0-23 UTC); the value is the mean occupancy across all
    telemetry rows in the last 24h that fell into that hour.
    """
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    stmt = (
        select(
            func.strftime("%H", models.Telemetry.ts).label("hour"),
            func.avg(models.Telemetry.occupancy_rate).label("avg_occ"),
            func.count(models.Telemetry.id).label("n"),
        )
        .where(models.Telemetry.ts >= since.replace(tzinfo=None))
        .group_by("hour")
        .order_by("hour")
    )
    rows = (await session.execute(stmt)).all()
    by_hour = {int(r.hour): (float(r.avg_occ or 0.0), int(r.n or 0)) for r in rows}
    hourly = [
        HourlyOccupancy(
            hour=h,
            avg_occupancy=by_hour.get(h, (0.0, 0))[0],
            sample_count=by_hour.get(h, (0.0, 0))[1],
        )
        for h in range(24)
    ]
    return Utilization24hResponse(
        generated_at=datetime.now(timezone.utc),
        hourly=hourly,
    )


class FaultTypeBucket(BaseModel):
    type: str
    count: int = Field(..., ge=0)
    severity_breakdown: dict[str, int]


class FaultTypesResponse(BaseModel):
    generated_at: datetime
    window_hours: int
    total: int
    buckets: list[FaultTypeBucket]


@router.get(
    "/fault-types",
    response_model=FaultTypesResponse,
    summary="Fault-type distribution over a recent window",
)
async def fault_types(
    session: Annotated[AsyncSession, Depends(get_session)],
    hours: int = Query(default=24, ge=1, le=168),
) -> FaultTypesResponse:
    """Return event counts grouped by type (fault categories only).

    Charging start/end and communication-loss are excluded; we want the
    "what's actually breaking" view for the bottom-strip donut chart.
    """
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    excluded = {"charging_start", "charging_end"}
    stmt = (
        select(
            models.Event.type,
            models.Event.severity,
            func.count(models.Event.id),
        )
        .where(
            models.Event.ts >= since.replace(tzinfo=None),
            ~models.Event.type.in_(excluded),
        )
        .group_by(models.Event.type, models.Event.severity)
    )
    rows = (await session.execute(stmt)).all()
    by_type: dict[str, dict[str, int]] = {}
    for ev_type, severity, n in rows:
        by_type.setdefault(ev_type, {})[severity] = int(n)
    buckets = [
        FaultTypeBucket(
            type=t,
            count=sum(sev_map.values()),
            severity_breakdown=sev_map,
        )
        for t, sev_map in sorted(by_type.items(), key=lambda kv: -sum(kv[1].values()))
    ]
    total = sum(b.count for b in buckets)
    return FaultTypesResponse(
        generated_at=datetime.now(timezone.utc),
        window_hours=hours,
        total=total,
        buckets=buckets,
    )


# ---------------------------- batch demand prediction ----------------------------


class PilePrediction(BaseModel):
    pile_id: str
    predicted_occupancy: float = Field(..., ge=0, le=1)
    std: float = Field(..., ge=0)
    ci_low: float = Field(..., ge=0, le=1)
    ci_high: float = Field(..., ge=0, le=1)


class PredictedUtilizationResponse(BaseModel):
    generated_at: datetime
    hours_ahead: int
    pile_count: int
    average_predicted_occupancy: float = Field(..., ge=0, le=1)
    average_confidence: float = Field(
        ..., ge=0, le=1,
        description="Average half-CI-width across piles, 1 = perfectly tight, 0 = wide.",
    )
    predictions: list[PilePrediction]


@router.get(
    "/predicted-utilization",
    response_model=PredictedUtilizationResponse,
    summary="One-shot LSTM forecast across every pile",
)
async def predicted_utilization(hours_ahead: int = Query(default=1, ge=1, le=6)) -> PredictedUtilizationResponse:
    """Return the next-hour predicted occupancy for every pile.

    Loads the 30-day telemetry DataFrame ONCE and predicts the whole
    population in a single batched LSTM forward pass — drastically
    faster than calling ``/api/ai/predict/demand`` 100 times.
    Result cached in-process for 60 s.
    """
    try:
        from ai.lstm_demand.batch import predict_all_piles
    except ImportError as exc:  # pragma: no cover
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    try:
        preds = predict_all_piles()
    except Exception as exc:
        log.exception("batch LSTM failed")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    if not preds:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="no piles with enough history yet")

    avg_occ = sum(p.predicted_occupancy for p in preds) / len(preds)
    half_ci = sum((p.ci_high - p.ci_low) / 2 for p in preds) / len(preds)
    confidence = max(0.0, min(1.0, 1.0 - half_ci * 4))  # rough mapping; small bands → high confidence
    return PredictedUtilizationResponse(
        generated_at=datetime.now(timezone.utc),
        hours_ahead=hours_ahead,
        pile_count=len(preds),
        average_predicted_occupancy=avg_occ,
        average_confidence=confidence,
        predictions=[
            PilePrediction(
                pile_id=p.pile_id,
                predicted_occupancy=p.predicted_occupancy,
                std=p.std,
                ci_low=p.ci_low,
                ci_high=p.ci_high,
            )
            for p in preds
        ],
    )
