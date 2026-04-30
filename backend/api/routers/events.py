"""Events stream endpoint (history slice, newest first)."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api import models
from api.deps import get_session
from api.schemas import EventOut

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("", response_model=list[EventOut], summary="List events")
async def list_events(
    session: Annotated[AsyncSession, Depends(get_session)],
    type: str | None = Query(default=None, description="Filter by event type."),
    severity: str | None = Query(default=None, description="Filter by severity."),
    pile_id: str | None = Query(default=None, description="Filter by pile id."),
    since: Annotated[
        datetime | None, Query(description="Only events on/after this UTC ts.")
    ] = None,
    limit: int = Query(default=100, ge=1, le=2000),
) -> list[EventOut]:
    stmt = select(models.Event)
    if type:
        stmt = stmt.where(models.Event.type == type)
    if severity:
        stmt = stmt.where(models.Event.severity == severity)
    if pile_id:
        stmt = stmt.where(models.Event.pile_id == pile_id)
    if since:
        stmt = stmt.where(models.Event.ts >= since.replace(tzinfo=None))
    stmt = stmt.order_by(models.Event.ts.desc()).limit(limit)
    rows = (await session.execute(stmt)).scalars().all()
    return [EventOut.model_validate_orm(r) for r in rows]
