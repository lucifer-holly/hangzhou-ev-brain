"""Grid coordination endpoints — simulate stress + LP curtailment plan."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Annotated

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from scipy.optimize import linprog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api import models
from api.deps import get_session

router = APIRouter(prefix="/api/grid", tags=["grid"])
log = logging.getLogger("api.routers.grid")


class GridStressRequest(BaseModel):
    """Inputs to the LP solver."""

    target_curtailment_mw: float = Field(
        ..., ge=0.1, le=10.0, description="MW to shave off the city load."
    )
    max_per_operator_pct: float = Field(
        default=0.30,
        ge=0.05,
        le=0.60,
        description="Hard cap on the per-operator curtailment fraction.",
    )


class OperatorAllocation(BaseModel):
    operator_id: str
    operator_name: str
    color: str
    pile_count: int
    current_power_kw: float
    curtailment_pct: float = Field(..., ge=0, le=1)
    saved_kw: float = Field(..., ge=0)


class GridStressResponse(BaseModel):
    generated_at: datetime
    current_load_mw: float
    target_curtailment_mw: float
    achieved_curtailment_mw: float
    achieved_pct_of_target: float
    new_load_mw: float
    pricing_discount_pct: float = Field(
        ...,
        description="Suggested off-peak charging discount, 0..1.",
    )
    expected_response_rate: float = Field(..., ge=0, le=1)
    operator_allocations: list[OperatorAllocation]


def _suggest_pricing(stress_ratio: float) -> tuple[float, float]:
    """Map an over-capacity ratio to a discount + expected response rate.

    Higher stress → more aggressive discount, but with diminishing returns
    on the price elasticity (response rate caps near 0.45).
    """
    discount = max(0.05, min(0.40, 0.15 + 0.20 * stress_ratio))
    response = max(0.10, min(0.45, 0.18 + 0.55 * discount))
    return round(discount, 3), round(response, 3)


@router.post(
    "/simulate-stress",
    response_model=GridStressResponse,
    summary="Run LP curtailment plan for a given target MW reduction",
)
async def simulate_stress(
    req: GridStressRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> GridStressResponse:
    """Solve a small LP that allocates curtailment across operators.

    minimise   Σ_i  weight_i · curtailment_pct_i · current_power_i
    subject to Σ_i  curtailment_pct_i · current_power_i  ≥  target_kw
               0  ≤  curtailment_pct_i  ≤  max_per_operator_pct

    Weights derive from market share — we're more reluctant to bother
    incumbents (国网) than smaller operators, modelling political
    realities of grid coordination.
    """
    # Pull operators + sum of current_power per operator.
    op_rows = (
        (await session.execute(select(models.Operator).order_by(models.Operator.id)))
        .scalars()
        .all()
    )
    if not op_rows:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="no operators seeded"
        )

    power_rows = (
        await session.execute(
            select(
                models.Pile.operator_id,
                func.sum(models.Pile.current_power),
                func.count(models.Pile.id),
            ).group_by(models.Pile.operator_id)
        )
    ).all()
    op_power: dict[str, tuple[float, int]] = {
        op_id: (float(power_sum or 0.0), int(n or 0)) for op_id, power_sum, n in power_rows
    }

    operator_ids = [op.id for op in op_rows]
    powers = np.array([op_power.get(oid, (0.0, 0))[0] for oid in operator_ids], dtype=float)
    pile_counts = [op_power.get(oid, (0.0, 0))[1] for oid in operator_ids]

    # Skip operators with zero current power — they can't contribute.
    active_mask = powers > 0
    if active_mask.sum() == 0:
        # No load to shed — return a zero plan.
        empty_alloc = [
            OperatorAllocation(
                operator_id=op.id,
                operator_name=op.name_zh,
                color=op.color,
                pile_count=pile_counts[i],
                current_power_kw=0.0,
                curtailment_pct=0.0,
                saved_kw=0.0,
            )
            for i, op in enumerate(op_rows)
        ]
        return GridStressResponse(
            generated_at=datetime.now(UTC),
            current_load_mw=0.0,
            target_curtailment_mw=req.target_curtailment_mw,
            achieved_curtailment_mw=0.0,
            achieved_pct_of_target=0.0,
            new_load_mw=0.0,
            pricing_discount_pct=0.0,
            expected_response_rate=0.0,
            operator_allocations=empty_alloc,
        )

    # Weights: smaller market share is cheaper to curtail (low weight).
    market_shares = np.array([op.market_share for op in op_rows], dtype=float)
    weights = 0.5 + market_shares  # 0.55..1.5 ish

    # LP variables: curtailment_pct_i ∈ [0, max_pct] for active operators.
    target_kw = req.target_curtailment_mw * 1000.0
    n = len(operator_ids)
    # Objective: minimise weighted savings → equivalently weighted percentages × power.
    c = (weights * powers).tolist()
    # Constraint: sum(pct * power) ≥ target_kw  →  -sum ≤ -target_kw
    A_ub = (-powers).reshape(1, -1).tolist()
    b_ub = [-target_kw]
    bounds = [(0.0, req.max_per_operator_pct) if active_mask[i] else (0.0, 0.0) for i in range(n)]

    res = linprog(c=c, A_ub=A_ub, b_ub=b_ub, bounds=bounds, method="highs")
    if not res.success:
        # Infeasible target — fall back to maxing every operator at the cap.
        log.warning("grid LP infeasible, falling back to capped allocation")
        pcts = np.where(active_mask, req.max_per_operator_pct, 0.0)
    else:
        pcts = np.clip(np.asarray(res.x), 0.0, req.max_per_operator_pct)

    saved = pcts * powers
    achieved_kw = float(saved.sum())
    current_load_kw = float(powers.sum())
    new_load_kw = current_load_kw - achieved_kw

    # Pricing recommendation scales with how stressed we were.
    stress_ratio = min(1.0, target_kw / max(1.0, current_load_kw))
    discount, response = _suggest_pricing(stress_ratio)

    allocations = [
        OperatorAllocation(
            operator_id=op_rows[i].id,
            operator_name=op_rows[i].name_zh,
            color=op_rows[i].color,
            pile_count=pile_counts[i],
            current_power_kw=round(float(powers[i]), 1),
            curtailment_pct=round(float(pcts[i]), 4),
            saved_kw=round(float(saved[i]), 1),
        )
        for i in range(n)
    ]

    return GridStressResponse(
        generated_at=datetime.now(UTC),
        current_load_mw=round(current_load_kw / 1000.0, 3),
        target_curtailment_mw=req.target_curtailment_mw,
        achieved_curtailment_mw=round(achieved_kw / 1000.0, 3),
        achieved_pct_of_target=round(min(1.0, achieved_kw / max(1.0, target_kw)), 4),
        new_load_mw=round(new_load_kw / 1000.0, 3),
        pricing_discount_pct=discount,
        expected_response_rate=response,
        operator_allocations=allocations,
    )
