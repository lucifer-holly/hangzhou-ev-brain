"""Operators endpoint."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api import models
from api.deps import get_session
from api.schemas import OperatorOut

router = APIRouter(prefix="/api/operators", tags=["operators"])


@router.get("", response_model=list[OperatorOut], summary="List operators")
async def list_operators(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[OperatorOut]:
    """Return all operators with their pile counts."""
    op_rows = (
        (await session.execute(select(models.Operator).order_by(models.Operator.id)))
        .scalars()
        .all()
    )
    counts = dict(
        (
            await session.execute(
                select(models.Pile.operator_id, func.count(models.Pile.id)).group_by(
                    models.Pile.operator_id
                )
            )
        ).all()
    )
    out: list[OperatorOut] = []
    for op in op_rows:
        out.append(
            OperatorOut(
                id=op.id,
                name_zh=op.name_zh,
                name_en=op.name_en,
                market_share=op.market_share,
                color=op.color,
                pile_count=int(counts.get(op.id, 0)),
            )
        )
    return out
