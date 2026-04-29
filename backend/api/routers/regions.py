"""Regions endpoint."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api import models
from api.deps import get_session
from api.schemas import RegionOut

router = APIRouter(prefix="/api/regions", tags=["regions"])


@router.get("", response_model=list[RegionOut], summary="List regions")
async def list_regions(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[RegionOut]:
    rows = (await session.execute(select(models.Region).order_by(models.Region.id))).scalars().all()
    counts = dict(
        (
            await session.execute(
                select(models.Pile.region_id, func.count(models.Pile.id)).group_by(models.Pile.region_id)
            )
        ).all()
    )
    return [
        RegionOut(
            id=r.id,
            name_zh=r.name_zh,
            name_en=r.name_en,
            center_lat=r.center_lat,
            center_lng=r.center_lng,
            radius_km=r.radius_km,
            description=r.description,
            pile_count=int(counts.get(r.id, 0)),
        )
        for r in rows
    ]
