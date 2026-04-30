"""Top-level synthesis: 30-day history + 1 Hz live ticks.

The two public callables are:

* :func:`generate_history` — produce hourly telemetry rows for ``history_days``
  for every pile, plus a list of fault and communication-loss events.
* :func:`generate_tick` — produce a single live snapshot per pile (used by
  the APScheduler job that fires every ``realtime_tick_seconds``).
"""

from __future__ import annotations

import math
import random
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from synth.demand_model import compute_occupancy
from synth.failure_inject import (
    inject_faults_for_day,
    sample_comm_losses,
)
from synth.geography import PileLocation


@dataclass(frozen=True, slots=True)
class TelemetryPoint:
    pile_id: str
    ts: datetime
    voltage: float
    current: float
    power: float
    occupancy_rate: float
    energy_delivered_kwh: float
    status: str


@dataclass(frozen=True, slots=True)
class GeneratedEvent:
    pile_id: str
    ts: datetime
    type: str
    severity: str
    message: str
    duration_minutes: float
    resolved: bool


@dataclass(slots=True)
class HistoryBundle:
    telemetry: list[TelemetryPoint] = field(default_factory=list)
    events: list[GeneratedEvent] = field(default_factory=list)


# ----------------------------- core helpers -----------------------------


def _is_weekend(ts: datetime) -> bool:
    return ts.weekday() >= 5  # Saturday(5) / Sunday(6)


def _status_from_occupancy(occupancy: float, in_fault: bool, comm_lost: bool) -> str:
    if comm_lost:
        return "offline"
    if in_fault:
        return "fault"
    if occupancy > 0.85:
        return "occupied"
    if occupancy > 0.20:
        return "charging"
    return "idle"


def _telemetry_from_state(
    pile: PileLocation,
    ts: datetime,
    occupancy: float,
    rng: random.Random,
    in_fault: bool,
    comm_lost: bool,
) -> TelemetryPoint:
    """Translate (occupancy, fault, comm) into electrical readings."""
    nominal_v = 400.0  # kept simple — single-phase DC fast-charging nominal
    if comm_lost:
        return TelemetryPoint(
            pile_id=pile.id,
            ts=ts,
            voltage=0.0,
            current=0.0,
            power=0.0,
            occupancy_rate=0.0,
            energy_delivered_kwh=0.0,
            status="offline",
        )
    voltage_jitter = rng.gauss(0, 2.0)
    voltage = max(0.0, nominal_v + voltage_jitter) if not in_fault else 0.0

    # Power is occupancy-weighted slice of the rated capacity.
    power_kw = pile.capacity_kw * occupancy
    if in_fault:
        power_kw *= 0.0
    current = (power_kw * 1000.0) / max(voltage, 1.0)
    energy = power_kw * 1.0  # 1-hour window

    return TelemetryPoint(
        pile_id=pile.id,
        ts=ts,
        voltage=round(voltage, 2),
        current=round(current, 2),
        power=round(power_kw, 2),
        occupancy_rate=round(occupancy, 4),
        energy_delivered_kwh=round(energy, 3),
        status=_status_from_occupancy(occupancy, in_fault, comm_lost),
    )


# ----------------------------- history generation -----------------------------


def generate_history(
    piles: list[PileLocation],
    history_days: int = 30,
    seed: int = 42,
    end: datetime | None = None,
) -> HistoryBundle:
    """Walk back ``history_days`` from ``end`` (default = now UTC) hour by hour.

    For every (pile, hour) combination produce one :class:`TelemetryPoint`.
    Events for faults and comm-losses are appended separately.
    """
    rng = random.Random(seed)
    end = (end or datetime.now(UTC)).replace(minute=0, second=0, microsecond=0)
    start = end - timedelta(days=history_days)

    bundle = HistoryBundle()
    pile_ids = [p.id for p in piles]

    # Pre-sample faults for each day so we can flag the affected piles in their
    # telemetry as "fault" and write the matching event row.
    fault_windows: dict[str, list[tuple[datetime, datetime, GeneratedEvent]]] = {
        p.id: [] for p in piles
    }
    for day_idx in range(history_days):
        day_start = start + timedelta(days=day_idx)
        faults = inject_faults_for_day(pile_ids, rng=rng)
        for fault in faults:
            offset_h = rng.uniform(0, 22)
            f_start = day_start + timedelta(hours=offset_h)
            f_end = f_start + timedelta(minutes=fault.duration_minutes)
            ev = GeneratedEvent(
                pile_id=fault.pile_id,
                ts=f_start,
                type=fault.type,
                severity=fault.severity,
                message=fault.message,
                duration_minutes=fault.duration_minutes,
                resolved=True,
            )
            fault_windows[fault.pile_id].append((f_start, f_end, ev))
            bundle.events.append(ev)

    # Walk hours.
    cur = start
    while cur < end:
        is_we = _is_weekend(cur)
        for pile in piles:
            base_occ = compute_occupancy(
                hour=cur.hour,
                is_weekend=is_we,
                region_id=pile.region_id,
                rng_value=rng.gauss(0, 0.05),
            )

            # Comm-loss probability per hour.
            comm_loss = sample_comm_losses(pile.id, cur, rng)
            comm_lost = comm_loss is not None
            if comm_loss is not None:
                bundle.events.append(
                    GeneratedEvent(
                        pile_id=pile.id,
                        ts=comm_loss.start,
                        type="communication_loss",
                        severity="warning",
                        message=f"通信断开 {comm_loss.duration_minutes:.1f} 分钟",
                        duration_minutes=comm_loss.duration_minutes,
                        resolved=True,
                    )
                )

            # In-fault flag for this hour.
            in_fault = any(start_t <= cur < end_t for start_t, end_t, _ in fault_windows[pile.id])

            bundle.telemetry.append(
                _telemetry_from_state(pile, cur, base_occ, rng, in_fault, comm_lost)
            )
        cur += timedelta(hours=1)

    return bundle


# ----------------------------- live tick generation -----------------------------


@dataclass(slots=True)
class TickerState:
    """Mutable state carried between ticks."""

    rng: random.Random
    fault_until: dict[str, datetime] = field(default_factory=dict)
    last_occupancy: dict[str, float] = field(default_factory=dict)
    cumulative_kwh: dict[str, float] = field(default_factory=dict)


def make_ticker_state(seed: int = 1337) -> TickerState:
    return TickerState(rng=random.Random(seed))


def generate_tick(
    piles: Iterable[PileLocation],
    state: TickerState,
    now: datetime | None = None,
    fault_per_minute_prob: float = 0.0005,
) -> tuple[list[TelemetryPoint], list[GeneratedEvent]]:
    """Generate one snapshot per pile + any fault start/end events.

    Args:
        piles: the pile fleet.
        state: live ticker state — mutated in place.
        now: timestamp to stamp on the points (default = utcnow).
        fault_per_minute_prob: per-pile, per-tick chance of starting a fault.
    """
    now = now or datetime.now(UTC)
    is_we = _is_weekend(now)
    points: list[TelemetryPoint] = []
    events: list[GeneratedEvent] = []
    rng = state.rng

    for pile in piles:
        # Smooth occupancy with EMA + tiny gaussian jitter so the dashboard wiggles.
        target = compute_occupancy(
            hour=now.hour, is_weekend=is_we, region_id=pile.region_id, rng_value=rng.gauss(0, 0.03)
        )
        prev = state.last_occupancy.get(pile.id, target)
        ema = 0.7 * prev + 0.3 * target
        state.last_occupancy[pile.id] = ema

        # Fault windows.
        fault_until = state.fault_until.get(pile.id)
        in_fault = fault_until is not None and now < fault_until
        if not in_fault and rng.random() < fault_per_minute_prob:
            duration_min = max(15.0, min(240.0, rng.expovariate(1.0 / 60.0)))
            ftype = rng.choice(
                ("voltage_anomaly", "thermal_fault", "vibration_event", "cable_fault")
            )
            fault_until = now + timedelta(minutes=duration_min)
            state.fault_until[pile.id] = fault_until
            in_fault = True
            events.append(
                GeneratedEvent(
                    pile_id=pile.id,
                    ts=now,
                    type=ftype,
                    severity="critical" if ftype in ("thermal_fault", "cable_fault") else "warning",
                    message=f"实时告警：{ftype}",
                    duration_minutes=duration_min,
                    resolved=False,
                )
            )

        # Comm loss as a lighter coin flip.
        comm_lost = rng.random() < 0.001

        point = _telemetry_from_state(pile, now, ema, rng, in_fault, comm_lost)
        # Track cumulative energy across ticks.
        delta_kwh = point.power * (1.0 / 3600.0)  # 1-second window in hours
        state.cumulative_kwh[pile.id] = state.cumulative_kwh.get(pile.id, 0.0) + delta_kwh
        points.append(point)

    return points, events


def total_history_row_count(pile_count: int, history_days: int) -> int:
    """Helper used by tests — total telemetry rows = piles · 24 · days."""
    return pile_count * 24 * history_days


def hourly_grid(start: datetime, days: int) -> list[datetime]:
    """Return all hour-aligned timestamps in ``[start, start+days)``."""
    out = []
    cur = start.replace(minute=0, second=0, microsecond=0)
    end = cur + timedelta(days=days)
    while cur < end:
        out.append(cur)
        cur += timedelta(hours=1)
    return out


def _radians(d: float) -> float:  # kept here so tests don't accidentally import math
    return d * math.pi / 180.0
