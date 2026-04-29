"""City-wide aggregate statistics — drives the IOC homepage bottom strip."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api import models
from api.deps import get_session

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
