"""Operator definitions and per-pile allocation.

Market shares are pinned to the spec:

============   ============   ====
Operator       Share          Piles (out of 100)
============   ============   ====
state_grid     50%            50
teld           25%            25
starcharge     15%            15
nio            10%            10
============   ============   ====
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class OperatorDef:
    """Static metadata for one charging operator."""

    id: str
    name_zh: str
    name_en: str
    market_share: float
    color: str


OPERATORS: tuple[OperatorDef, ...] = (
    OperatorDef(
        id="state_grid",
        name_zh="国家电网",
        name_en="State Grid",
        market_share=0.50,
        color="#2563EB",
    ),
    OperatorDef(
        id="teld",
        name_zh="特来电",
        name_en="TELD",
        market_share=0.25,
        color="#FF6B35",
    ),
    OperatorDef(
        id="starcharge",
        name_zh="星星充电",
        name_en="StarCharge",
        market_share=0.15,
        color="#FFB800",
    ),
    OperatorDef(
        id="nio",
        name_zh="蔚来能源",
        name_en="NIO Power",
        market_share=0.10,
        color="#00D4FF",
    ),
)


def allocate_piles_to_operators(total: int = 100) -> list[str]:
    """Return a list of length ``total`` mapping each pile slot to an operator id.

    The allocation is exact (no Monte Carlo): if a share rounds to an integer,
    that operator gets exactly that many piles.  The result is sorted by
    operator id so callers can pair it with a deterministic geography list.
    """
    counts: list[tuple[str, int]] = []
    assigned = 0
    for op in OPERATORS[:-1]:
        c = round(op.market_share * total)
        counts.append((op.id, c))
        assigned += c
    # Last operator absorbs any rounding residual.
    counts.append((OPERATORS[-1].id, total - assigned))

    out: list[str] = []
    for op_id, c in counts:
        out.extend([op_id] * c)
    return out
