"""Pile listing + detail + telemetry endpoints."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api import models
from api.deps import get_session
from api.schemas import (
    PileDetail,
    PileOut,
    PileSummary24h,
    TelemetryPoint,
)

router = APIRouter(prefix="/api/piles", tags=["piles"])


@router.get("", response_model=list[PileOut], summary="List piles")
async def list_piles(
    session: Annotated[AsyncSession, Depends(get_session)],
    region: str | None = Query(default=None, description="Filter by region id."),
    operator: str | None = Query(default=None, description="Filter by operator id."),
    status: str | None = Query(default=None, description="Filter by current_status."),
) -> list[PileOut]:
    """Return all piles, with optional region / operator / status filters."""
    stmt = select(models.Pile)
    if region:
        stmt = stmt.where(models.Pile.region_id == region)
    if operator:
        stmt = stmt.where(models.Pile.operator_id == operator)
    if status:
        stmt = stmt.where(models.Pile.current_status == status)
    stmt = stmt.order_by(models.Pile.id)
    result = await session.execute(stmt)
    return [PileOut.model_validate(p) for p in result.scalars().all()]


@router.get("/{pile_id}", response_model=PileDetail, summary="Pile detail")
async def get_pile(
    pile_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PileDetail:
    """Return a single pile with its 24-hour rolling summary."""
    pile = await session.get(models.Pile, pile_id)
    if pile is None:
        raise HTTPException(status_code=404, detail=f"pile {pile_id} not found")

    since = datetime.now(UTC) - timedelta(hours=24)
    summary_stmt = select(
        func.avg(models.Telemetry.occupancy_rate),
        func.max(models.Telemetry.occupancy_rate),
        func.sum(models.Telemetry.energy_delivered_kwh),
        func.count(models.Telemetry.id),
    ).where(
        and_(
            models.Telemetry.pile_id == pile_id,
            models.Telemetry.ts >= since.replace(tzinfo=None),
        )
    )
    avg_occ, peak_occ, total_kwh, sample_n = (await session.execute(summary_stmt)).one()

    fault_stmt = select(func.count(models.Event.id)).where(
        and_(
            models.Event.pile_id == pile_id,
            models.Event.ts >= since.replace(tzinfo=None),
            models.Event.type != "communication_loss",
        )
    )
    fault_count = (await session.execute(fault_stmt)).scalar_one()

    summary = PileSummary24h(
        avg_occupancy=float(avg_occ or 0.0),
        peak_occupancy=float(peak_occ or 0.0),
        total_energy_kwh=float(total_kwh or 0.0),
        fault_count=int(fault_count or 0),
        sample_count=int(sample_n or 0),
    )
    return PileDetail(**PileOut.model_validate(pile).model_dump(), summary_24h=summary)


@router.get(
    "/{pile_id}/telemetry",
    response_model=list[TelemetryPoint],
    summary="Pile telemetry (history)",
)
async def get_telemetry(
    pile_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    from_: Annotated[datetime | None, Query(alias="from")] = None,
    to: Annotated[datetime | None, Query()] = None,
    limit: int = Query(default=500, ge=1, le=10_000),
) -> list[TelemetryPoint]:
    """Return historical telemetry for a single pile, newest first."""
    if (await session.get(models.Pile, pile_id)) is None:
        raise HTTPException(status_code=404, detail=f"pile {pile_id} not found")

    stmt = select(models.Telemetry).where(models.Telemetry.pile_id == pile_id)
    if from_:
        stmt = stmt.where(models.Telemetry.ts >= from_.replace(tzinfo=None))
    if to:
        stmt = stmt.where(models.Telemetry.ts <= to.replace(tzinfo=None))
    stmt = stmt.order_by(models.Telemetry.ts.desc()).limit(limit)
    rows = (await session.execute(stmt)).scalars().all()
    return [TelemetryPoint.model_validate(r) for r in rows]
