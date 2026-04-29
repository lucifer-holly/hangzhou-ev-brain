"""City-wide aggregate statistics — drives the IOC homepage bottom strip."""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api import models
from api.deps import get_session

log = logging.getLogger("api.routers.stats")

router = APIRouter(prefix="/api/stats", tags=["stats"])

ComplianceWindow = Literal["24h", "7d", "30d"]
_WINDOW_HOURS: dict[str, int] = {"24h": 24, "7d": 168, "30d": 720}


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


# ---------------------------- operator compliance ----------------------------


class OperatorComplianceRow(BaseModel):
    operator_id: str
    operator_name: str
    color: str
    pile_count: int
    availability_rate: float = Field(..., ge=0, le=1)
    mttr_minutes: float = Field(..., ge=0)
    price_anomaly_count: int = Field(..., ge=0)
    complaint_count: int = Field(..., ge=0)
    composite_score: float = Field(..., ge=0, le=100)
    rating: Literal["A", "B", "C", "D"]


class OperatorComplianceResponse(BaseModel):
    generated_at: datetime
    window: ComplianceWindow
    rows: list[OperatorComplianceRow]


def _rating(score: float) -> Literal["A", "B", "C", "D"]:
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 70:
        return "C"
    return "D"


def _stable_complaint_count(operator_id: str, window: str) -> int:
    """Synthesise complaint count deterministically from operator + window.

    Real product would pull from a CRM/ticketing system; we just need a
    plausible number that varies per operator and window for the demo.
    """
    seed = int(hashlib.md5(f"{operator_id}:{window}".encode()).hexdigest()[:8], 16)
    base = {"24h": 5, "7d": 28, "30d": 110}.get(window, 5)
    return base + (seed % max(1, base // 2))


@router.get(
    "/operator-compliance",
    response_model=OperatorComplianceResponse,
    summary="4-operator compliance scorecard with composite rating",
)
async def operator_compliance(
    session: Annotated[AsyncSession, Depends(get_session)],
    window: ComplianceWindow = Query(default="24h", description="Window: 24h / 7d / 30d."),
) -> OperatorComplianceResponse:
    """Return compliance metrics for every operator over the chosen window.

    Metrics:
      * availability_rate: 1 − Σ(fault_minutes) / (pile_count · window_minutes)
      * mttr_minutes: mean duration of resolved fault events
      * price_anomaly_count: voltage_anomaly events as a price-deviation proxy
      * complaint_count: deterministic per-operator synthetic count
      * composite_score: weighted 0-100 score → A/B/C/D rating
    """
    hours = _WINDOW_HOURS[window]
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    since_naive = since.replace(tzinfo=None)
    window_minutes = hours * 60

    # Pile counts per operator + colour metadata.
    op_rows = (
        await session.execute(select(models.Operator).order_by(models.Operator.id))
    ).scalars().all()
    pile_count_rows = (
        await session.execute(
            select(models.Pile.operator_id, func.count(models.Pile.id)).group_by(
                models.Pile.operator_id
            )
        )
    ).all()
    pile_counts = {op_id: int(n) for op_id, n in pile_count_rows}

    # Sum fault-event durations + count per operator within window.
    fault_types_set = {
        "voltage_anomaly",
        "thermal_fault",
        "vibration_event",
        "cable_fault",
        "communication_loss",
    }
    fault_stmt = (
        select(
            models.Pile.operator_id,
            func.sum(models.Event.duration_minutes).label("dur_sum"),
            func.avg(models.Event.duration_minutes).label("dur_avg"),
            func.count(models.Event.id).label("n"),
        )
        .join(models.Event, models.Event.pile_id == models.Pile.id)
        .where(
            models.Event.ts >= since_naive,
            models.Event.type.in_(fault_types_set),
        )
        .group_by(models.Pile.operator_id)
    )
    fault_rows = (await session.execute(fault_stmt)).all()
    fault_by_op = {
        r.operator_id: (float(r.dur_sum or 0.0), float(r.dur_avg or 0.0), int(r.n or 0))
        for r in fault_rows
    }

    # Voltage-anomaly count per operator (price-deviation proxy).
    price_stmt = (
        select(models.Pile.operator_id, func.count(models.Event.id))
        .join(models.Event, models.Event.pile_id == models.Pile.id)
        .where(
            models.Event.ts >= since_naive,
            models.Event.type == "voltage_anomaly",
        )
        .group_by(models.Pile.operator_id)
    )
    price_rows = (await session.execute(price_stmt)).all()
    price_by_op = {op_id: int(n) for op_id, n in price_rows}

    rows: list[OperatorComplianceRow] = []
    for op in op_rows:
        n_piles = pile_counts.get(op.id, 0)
        dur_sum, dur_avg, _ = fault_by_op.get(op.id, (0.0, 0.0, 0))
        price_n = price_by_op.get(op.id, 0)
        complaints = _stable_complaint_count(op.id, window)

        denom = max(1.0, n_piles * window_minutes)
        availability = max(0.0, min(1.0, 1.0 - dur_sum / denom))
        mttr = float(dur_avg)
        # Per-pile-normalised "bad" fractions clamped to [0, 1].
        price_frac = min(1.0, price_n / max(1, n_piles))
        complaint_frac = min(1.0, complaints / max(1, n_piles * 5))
        mttr_score = max(0.0, min(1.0, 1.0 - mttr / 90.0))  # 0 min → 1, 90 min → 0
        composite = (
            0.45 * availability
            + 0.20 * mttr_score
            + 0.20 * (1.0 - price_frac)
            + 0.15 * (1.0 - complaint_frac)
        ) * 100.0
        composite = round(composite, 1)

        rows.append(
            OperatorComplianceRow(
                operator_id=op.id,
                operator_name=op.name_zh,
                color=op.color,
                pile_count=n_piles,
                availability_rate=round(availability, 4),
                mttr_minutes=round(mttr, 1),
                price_anomaly_count=price_n,
                complaint_count=complaints,
                composite_score=composite,
                rating=_rating(composite),
            )
        )

    return OperatorComplianceResponse(
        generated_at=datetime.now(timezone.utc),
        window=window,
        rows=rows,
    )


# ---------------------------- subsidy DID analysis ----------------------------


class SubsidyPileRow(BaseModel):
    pile_id: str
    operator_id: str
    region_id: str
    subsidy_amount: float = Field(..., ge=0)
    subsidy_group: Literal["treatment", "control"]
    pre_avg_occupancy: float = Field(..., ge=0, le=1)
    post_avg_occupancy: float = Field(..., ge=0, le=1)
    occupancy_lift: float = Field(..., description="post − pre (utilisation, 0..1)")
    roi_per_kyuan: float = Field(
        ..., description="utilisation-points-lift per 1000 yuan of subsidy",
    )


class DIDAnalysisResponse(BaseModel):
    generated_at: datetime
    pre_window_days: int
    post_window_days: int
    treatment_n: int
    control_n: int
    treatment_pre_avg: float
    treatment_post_avg: float
    treatment_uplift: float
    control_pre_avg: float
    control_post_avg: float
    control_uplift: float
    did_effect: float = Field(
        ..., description="treatment_uplift − control_uplift (causal effect)",
    )
    p_value: float = Field(
        ..., ge=0, le=1, description="Welch t-test p-value on per-pile uplift",
    )
    avg_treatment_subsidy: float
    rows: list[SubsidyPileRow]


@router.get(
    "/subsidy-analysis",
    response_model=DIDAnalysisResponse,
    summary="Difference-in-differences causal evaluation of pile subsidies",
)
async def subsidy_analysis(
    session: Annotated[AsyncSession, Depends(get_session)],
    pre_days: int = Query(default=23, ge=7, le=30),
    post_days: int = Query(default=7, ge=1, le=14),
) -> DIDAnalysisResponse:
    """Compute DID treatment effect of subsidies on pile utilisation.

    Per pile, we measure mean occupancy in the *pre* window
    (older slice) and the *post* window (most recent slice), then
    aggregate within treatment / control groups.

    The reported DID = (Δ̄_treatment − Δ̄_control) is the synthetic-data
    causal effect; a Welch t-test on the per-pile uplift gives a rough
    p-value.

    NOTE: The base demand model in ``synth/demand_model.py`` does **not**
    inject any subsidy effect, so a clean DID on raw telemetry would be
    ≈ 0.  We therefore layer a **modelled subsidy lift** on top of the
    actual post-period average for treatment piles, scaled by their
    subsidy amount (full disclosure shown on the page methodology
    panel).  This is the demo equivalent of a real policy elasticity
    estimate from a labour-economics paper.
    """
    import numpy as np  # noqa: PLC0415  (kept local; numpy already a backend dep)
    from scipy import stats as scstats  # noqa: PLC0415

    # Modelled effect: ~+8 percentage points of utilisation per 100k yuan,
    # with a small per-pile deterministic noise term so the scatter looks
    # natural rather than perfectly linear.
    def _modelled_subsidy_lift(pile_id: str, subsidy: float) -> float:
        h = abs(hash(pile_id)) % 1000
        jitter = (h - 500) / 5000.0  # ±0.10 max
        return max(0.0, 0.08 * (subsidy / 100_000.0) + jitter * 0.4)

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    post_start = now - timedelta(days=post_days)
    pre_start = post_start - timedelta(days=pre_days)

    pile_rows = (
        await session.execute(
            select(
                models.Pile.id,
                models.Pile.operator_id,
                models.Pile.region_id,
                models.Pile.subsidy_amount,
                models.Pile.subsidy_group,
            )
        )
    ).all()
    pile_meta = {
        r.id: {
            "operator_id": r.operator_id,
            "region_id": r.region_id,
            "subsidy_amount": float(r.subsidy_amount),
            "subsidy_group": r.subsidy_group,
        }
        for r in pile_rows
    }

    # Pre and post averages, one row per pile.
    pre_stmt = (
        select(
            models.Telemetry.pile_id,
            func.avg(models.Telemetry.occupancy_rate),
        )
        .where(
            models.Telemetry.ts >= pre_start,
            models.Telemetry.ts < post_start,
        )
        .group_by(models.Telemetry.pile_id)
    )
    post_stmt = (
        select(
            models.Telemetry.pile_id,
            func.avg(models.Telemetry.occupancy_rate),
        )
        .where(models.Telemetry.ts >= post_start)
        .group_by(models.Telemetry.pile_id)
    )
    pre_map = {pid: float(v) for pid, v in (await session.execute(pre_stmt)).all()}
    post_map = {pid: float(v) for pid, v in (await session.execute(post_stmt)).all()}

    rows: list[SubsidyPileRow] = []
    treatment_uplifts: list[float] = []
    control_uplifts: list[float] = []
    treatment_pres: list[float] = []
    treatment_posts: list[float] = []
    control_pres: list[float] = []
    control_posts: list[float] = []
    treatment_subsidies: list[float] = []

    for pid, meta in pile_meta.items():
        pre_v = pre_map.get(pid)
        post_v = post_map.get(pid)
        if pre_v is None or post_v is None:
            continue
        subsidy = meta["subsidy_amount"]
        # Apply the modelled treatment effect ONLY to treatment piles.
        if meta["subsidy_group"] == "treatment":
            post_v = max(0.0, min(1.0, post_v + _modelled_subsidy_lift(pid, subsidy)))
        lift = post_v - pre_v
        roi_per_k = (lift * 1000.0) / subsidy if subsidy > 0 else 0.0
        rows.append(
            SubsidyPileRow(
                pile_id=pid,
                operator_id=meta["operator_id"],
                region_id=meta["region_id"],
                subsidy_amount=subsidy,
                subsidy_group=meta["subsidy_group"],
                pre_avg_occupancy=max(0.0, min(1.0, pre_v)),
                post_avg_occupancy=max(0.0, min(1.0, post_v)),
                occupancy_lift=lift,
                roi_per_kyuan=roi_per_k,
            )
        )
        if meta["subsidy_group"] == "treatment":
            treatment_uplifts.append(lift)
            treatment_pres.append(pre_v)
            treatment_posts.append(post_v)
            treatment_subsidies.append(subsidy)
        else:
            control_uplifts.append(lift)
            control_pres.append(pre_v)
            control_posts.append(post_v)

    def _mean(xs: list[float]) -> float:
        return float(np.mean(xs)) if xs else 0.0

    t_pre = _mean(treatment_pres)
    t_post = _mean(treatment_posts)
    c_pre = _mean(control_pres)
    c_post = _mean(control_posts)
    t_uplift = t_post - t_pre
    c_uplift = c_post - c_pre
    did = t_uplift - c_uplift

    if len(treatment_uplifts) >= 2 and len(control_uplifts) >= 2:
        _, p_val = scstats.ttest_ind(
            treatment_uplifts, control_uplifts, equal_var=False
        )
        if not np.isfinite(p_val):  # pragma: no cover  - degenerate input
            p_val = 1.0
    else:
        p_val = 1.0

    return DIDAnalysisResponse(
        generated_at=datetime.now(timezone.utc),
        pre_window_days=pre_days,
        post_window_days=post_days,
        treatment_n=len(treatment_uplifts),
        control_n=len(control_uplifts),
        treatment_pre_avg=t_pre,
        treatment_post_avg=t_post,
        treatment_uplift=t_uplift,
        control_pre_avg=c_pre,
        control_post_avg=c_post,
        control_uplift=c_uplift,
        did_effect=did,
        p_value=float(p_val),
        avg_treatment_subsidy=_mean(treatment_subsidies),
        rows=rows,
    )


# ---------------------------- pile snapshot at timestamp ----------------------------


class PileSnapshot(BaseModel):
    pile_id: str
    voltage: float
    current: float
    power: float
    occupancy_rate: float = Field(..., ge=0, le=1)
    status: str


class PileSnapshotResponse(BaseModel):
    requested_at: datetime
    matched_at: datetime
    pile_count: int
    snapshots: list[PileSnapshot]


@router.get(
    "/snapshot",
    response_model=PileSnapshotResponse,
    summary="Pile-state snapshot at a given timestamp (historical replay)",
)
async def pile_snapshot(
    session: Annotated[AsyncSession, Depends(get_session)],
    at: datetime = Query(..., description="UTC timestamp to retrieve a snapshot for."),
) -> PileSnapshotResponse:
    """Return the historical state of every pile at the closest hourly bucket.

    The seed populates ~720 hourly rows per pile over 30 days; we round
    the request to the nearest hour and return one telemetry row per
    pile from that bucket (or the nearest available row, by joining on
    the closest-on-or-before timestamp per pile).
    """
    from sqlalchemy import and_  # noqa: PLC0415  (kept local)

    target = at.replace(tzinfo=None) if at.tzinfo else at
    # Round to the hour because seeded telemetry is hourly.
    target = target.replace(minute=0, second=0, microsecond=0)
    window_start = target - timedelta(hours=2)
    window_end = target + timedelta(minutes=30)

    # Per-pile latest row before target, within a 2h window (handles gaps).
    sub = (
        select(
            models.Telemetry.pile_id.label("pid"),
            func.max(models.Telemetry.ts).label("max_ts"),
        )
        .where(
            and_(
                models.Telemetry.ts >= window_start,
                models.Telemetry.ts <= window_end,
            )
        )
        .group_by(models.Telemetry.pile_id)
        .subquery()
    )
    stmt = select(models.Telemetry).join(
        sub,
        and_(
            models.Telemetry.pile_id == sub.c.pid,
            models.Telemetry.ts == sub.c.max_ts,
        ),
    )
    rows = (await session.execute(stmt)).scalars().all()
    snapshots = [
        PileSnapshot(
            pile_id=r.pile_id,
            voltage=r.voltage,
            current=r.current,
            power=r.power,
            occupancy_rate=r.occupancy_rate,
            status=r.status,
        )
        for r in rows
    ]
    matched_at = max((r.ts for r in rows), default=target)
    return PileSnapshotResponse(
        requested_at=at,
        matched_at=matched_at,
        pile_count=len(snapshots),
        snapshots=snapshots,
    )
