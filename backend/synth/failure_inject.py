"""Fault and communication-loss injection.

Two channels of disruption:

1. **Faults** (Poisson-ish): on average 2 piles experience a fault per day
   across the fleet of 100.  Fault types are drawn uniformly from
   ``voltage_anomaly`` / ``thermal_fault`` / ``vibration_event`` / ``cable_fault``.
   Duration is exponentially distributed with mean 2 hours.

2. **Communication loss**: each pile, every hour, has ≈1 % chance to drop
   off-line for 5–30 minutes.  This is what makes the operator compliance
   dashboard's SLA panel non-trivial.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import datetime, timedelta

_FAULT_TYPES: tuple[str, ...] = (
    "voltage_anomaly",
    "thermal_fault",
    "vibration_event",
    "cable_fault",
)


@dataclass(frozen=True, slots=True)
class FaultEvent:
    pile_id: str
    type: str
    severity: str
    duration_minutes: float
    message: str


@dataclass(frozen=True, slots=True)
class CommLossEvent:
    pile_id: str
    start: datetime
    duration_minutes: float


def inject_faults_for_day(
    pile_ids: list[str],
    rng: random.Random,
    expected_per_day: float = 2.0,
) -> list[FaultEvent]:
    """Sample a Poisson-ish list of faults for a single day.

    A simple sampling strategy is used: draw a Poisson count via the rejection
    method based on ``random.gauss`` (since :mod:`random` lacks a Poisson),
    floored at 0.  Then draw without replacement which piles fault.
    """
    # Lightweight Poisson sampler (Knuth's algorithm).
    L = pow(2.71828182845904523536, -expected_per_day)
    k = 0
    p = 1.0
    while True:
        k += 1
        p *= rng.random()
        if p <= L:
            break
    count = k - 1

    if count <= 0 or not pile_ids:
        return []

    chosen = rng.sample(pile_ids, k=min(count, len(pile_ids)))
    out: list[FaultEvent] = []
    for pid in chosen:
        ftype = rng.choice(_FAULT_TYPES)
        # Exponential duration with mean 120 min, clipped 15..480.
        dur = max(15.0, min(480.0, rng.expovariate(1.0 / 120.0)))
        severity = "critical" if ftype in ("thermal_fault", "cable_fault") else "warning"
        out.append(
            FaultEvent(
                pile_id=pid,
                type=ftype,
                severity=severity,
                duration_minutes=round(dur, 1),
                message=_fault_message(ftype),
            )
        )
    return out


def _fault_message(ftype: str) -> str:
    return {
        "voltage_anomaly": "电压突变，疑似接触不良",
        "thermal_fault": "桩内温度异常上升，散热故障告警",
        "vibration_event": "加速度异常，疑似撞击 / 撬桩",
        "cable_fault": "电缆侧异常，已暂停充电回路",
    }.get(ftype, "未知告警")


def sample_comm_losses(
    pile_id: str,
    hour_start: datetime,
    rng: random.Random,
    p_drop: float = 0.01,
) -> CommLossEvent | None:
    """At a given hour boundary, decide whether the pile drops comms."""
    if rng.random() >= p_drop:
        return None
    duration_min = rng.uniform(5.0, 30.0)
    offset_min = rng.uniform(0.0, 60.0 - duration_min)
    return CommLossEvent(
        pile_id=pile_id,
        start=hour_start + timedelta(minutes=offset_min),
        duration_minutes=round(duration_min, 1),
    )
