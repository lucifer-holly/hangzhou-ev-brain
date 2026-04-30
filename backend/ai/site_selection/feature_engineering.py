"""Feature engineering for the XGBoost site-selection model.

The 12-D feature vector matches spec §7.3 / Spawn 4 brief:

    0  lat
    1  lng
    2  pop_density_1km
    3  poi_mall_count
    4  poi_office_count
    5  poi_residential_count
    6  existing_pile_count_1km
    7  avg_utilization_1km            (mean of 30-day avg occupancy of nearby piles)
    8  road_grade                     1=支路 / 2=次干道 / 3=主干道
    9  operator_state_grid            (one-hot, 1 if operator == state_grid)
    10 operator_teld                  (one-hot)
    11 operator_starcharge            (one-hot)

NIO is the implicit "all zeros" reference category in the operator
one-hot.

POI / population counts are *synthesised* from a deterministic geographic
prior — spec is explicit that all data is synthetic, but features need to
be plausible enough to give SHAP a meaningful story.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np
from pydantic import BaseModel, Field

FEATURE_NAMES: tuple[str, ...] = (
    "lat",
    "lng",
    "pop_density_1km",
    "poi_mall_count",
    "poi_office_count",
    "poi_residential_count",
    "existing_pile_count_1km",
    "avg_utilization_1km",
    "road_grade",
    "operator_state_grid",
    "operator_teld",
    "operator_starcharge",
)


# ----------------------------- POI / population priors -----------------------------

_FUTURE_TECH_CENTER = (30.275, 120.030)
_QIANTANG_CENTER = (30.300, 120.350)


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r_earth = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r_earth * math.asin(math.sqrt(a))


def _pop_density_1km(lat: float, lng: float) -> float:
    """Simulated population density (people per km²).

    Higher in Future Tech City than Qiantang New Area, with smooth Gaussian
    falloff away from each region's centre.  Numbers are calibrated so the
    typical FTC value lands ~10 000 and QTA ~5 500.
    """
    d_ftc = _haversine_km(lat, lng, *_FUTURE_TECH_CENTER)
    d_qta = _haversine_km(lat, lng, *_QIANTANG_CENTER)
    ftc = 12000.0 * math.exp(-(d_ftc**2) / (2 * 3.0**2))
    qta = 7000.0 * math.exp(-(d_qta**2) / (2 * 4.0**2))
    return ftc + qta + 800.0  # baseline


def _poi_counts(lat: float, lng: float, region_id: str) -> tuple[int, int, int]:
    """Return (mall, office, residential) counts within ~1 km.

    Future Tech City is office-heavy (Alibaba campus); Qiantang is
    residential-heavy (new manufacturing district + university town).
    """
    d_ftc = _haversine_km(lat, lng, *_FUTURE_TECH_CENTER)
    d_qta = _haversine_km(lat, lng, *_QIANTANG_CENTER)
    if region_id == "future_tech_city":
        office = max(0, int(round(35 * math.exp(-d_ftc / 4.0))))
        mall = max(0, int(round(7 * math.exp(-d_ftc / 5.0))))
        residential = max(0, int(round(12 * math.exp(-d_ftc / 6.0))))
    else:
        office = max(0, int(round(8 * math.exp(-d_qta / 5.0))))
        mall = max(0, int(round(4 * math.exp(-d_qta / 5.0))))
        residential = max(0, int(round(28 * math.exp(-d_qta / 4.0))))
    return mall, office, residential


def _road_grade(lat: float, lng: float) -> int:
    """Pseudo road-grade derived from coordinates.

    Within ~1 km of the region centre we assume a major arterial (3),
    1-3 km gets a sub-arterial (2), and the periphery is residential (1).
    """
    d = min(
        _haversine_km(lat, lng, *_FUTURE_TECH_CENTER),
        _haversine_km(lat, lng, *_QIANTANG_CENTER),
    )
    if d < 1.5:
        return 3
    if d < 3.5:
        return 2
    return 1


def _operator_one_hot(operator_id: str) -> tuple[int, int, int]:
    """Return (state_grid, teld, starcharge); NIO → all zeros."""
    return (
        int(operator_id == "state_grid"),
        int(operator_id == "teld"),
        int(operator_id == "starcharge"),
    )


# ----------------------------- public API -----------------------------


class SiteFeatures(BaseModel):
    """Pydantic input for the API endpoint.

    Used both as the FastAPI request schema and as the source for
    :func:`features_to_vector`.
    """

    lat: float = Field(..., description="Latitude (杭州 ~30.x).")
    lng: float = Field(..., description="Longitude (杭州 ~120.x).")
    pop_density_1km: float = Field(..., ge=0, description="People per km² in 1 km radius.")
    poi_mall_count: int = Field(..., ge=0)
    poi_office_count: int = Field(..., ge=0)
    poi_residential_count: int = Field(..., ge=0)
    existing_pile_count_1km: int = Field(..., ge=0)
    avg_utilization_1km: float = Field(..., ge=0, le=1)
    road_grade: int = Field(..., ge=1, le=3, description="1=支路 / 2=次干道 / 3=主干道")
    operator: str = Field(
        default="state_grid",
        description="Operator slug — one of state_grid/teld/starcharge/nio.",
    )

    def to_vector(self) -> np.ndarray:
        ohe = _operator_one_hot(self.operator)
        return np.asarray(
            [
                self.lat,
                self.lng,
                self.pop_density_1km,
                self.poi_mall_count,
                self.poi_office_count,
                self.poi_residential_count,
                self.existing_pile_count_1km,
                self.avg_utilization_1km,
                self.road_grade,
                ohe[0],
                ohe[1],
                ohe[2],
            ],
            dtype=np.float32,
        )


@dataclass(frozen=True, slots=True)
class _RealPile:
    pile_id: str
    operator_id: str
    region_id: str
    lat: float
    lng: float
    avg_occupancy_30d: float


def _load_real_piles_with_avg_occupancy() -> list[_RealPile]:
    """Pull the 100 real piles with 30-day average occupancy as label."""
    from sqlalchemy import func, select  # local import: keep heavy DB imports lazy

    from api import models
    from api.database import SyncSession

    with SyncSession() as session:
        rows = session.execute(
            select(
                models.Pile.id,
                models.Pile.operator_id,
                models.Pile.region_id,
                models.Pile.lat,
                models.Pile.lng,
                func.avg(models.Telemetry.occupancy_rate),
            )
            .join(models.Telemetry, models.Telemetry.pile_id == models.Pile.id)
            .group_by(models.Pile.id)
        ).all()
    out: list[_RealPile] = []
    for r in rows:
        avg = float(r[5] or 0.0)
        out.append(_RealPile(r[0], r[1], r[2], r[3], r[4], avg))
    return out


def pile_to_features(
    pile: _RealPile,
    others: Sequence[_RealPile],
    radius_km: float = 1.0,
) -> np.ndarray:
    """Compute the 12-D feature vector for a real (or candidate) pile."""
    pop = _pop_density_1km(pile.lat, pile.lng)
    mall, office, res = _poi_counts(pile.lat, pile.lng, pile.region_id)

    nearby = [
        o
        for o in others
        if o.pile_id != pile.pile_id
        and _haversine_km(pile.lat, pile.lng, o.lat, o.lng) <= radius_km
    ]
    pile_count_1km = len(nearby)
    if nearby:
        avg_util_1km = float(np.mean([o.avg_occupancy_30d for o in nearby]))
    else:
        avg_util_1km = 0.0

    grade = _road_grade(pile.lat, pile.lng)
    ohe = _operator_one_hot(pile.operator_id)
    return np.asarray(
        [
            pile.lat,
            pile.lng,
            pop,
            mall,
            office,
            res,
            pile_count_1km,
            avg_util_1km,
            grade,
            ohe[0],
            ohe[1],
            ohe[2],
        ],
        dtype=np.float32,
    )


def synthesize_utilization_label(x: np.ndarray, rng: np.random.Generator | None = None) -> float:
    """Synthetic ground-truth 6-month utilization for the site-selection task.

    The synth/demand_model used for telemetry is *time-of-day driven* — every
    pile in the same region ends up with nearly identical 30-day averages,
    which gives XGBoost no signal to learn (R² ~0).  For the *site-selection*
    task we instead define a richer ground-truth label as a function of the
    geographic features the model is supposed to reason about:

        utilization ≈ f(POI office count, population density, road grade,
                        operator brand, neighbor saturation penalty)

    The shape is calibrated so values land in [0.15, 0.85] with a healthy
    spread, mimicking the sort of "you will pull more cars near offices and
    big roads" intuition we want SHAP to surface in the demo.
    """
    pop_density = float(x[2])
    mall = float(x[3])
    office = float(x[4])
    residential = float(x[5])
    pile_count = float(x[6])
    avg_neighbor_util = float(x[7])
    road_grade = float(x[8])
    op_state_grid = float(x[9])
    op_teld = float(x[10])
    op_starcharge = float(x[11])

    score = (
        0.30
        + 0.018 * office
        + 0.012 * mall
        + 0.005 * residential
        + 0.000020 * pop_density
        + 0.04 * road_grade
        - 0.025 * pile_count
        + 0.25 * avg_neighbor_util
        - 0.04 * op_state_grid
        + 0.02 * op_teld
        + 0.01 * op_starcharge
    )
    if rng is not None:
        score += float(rng.standard_normal()) * 0.025
    return float(np.clip(score, 0.05, 0.98))


def build_training_set(noise_replicas: int = 5, seed: int = 42) -> tuple[np.ndarray, np.ndarray]:
    """Return (X, y) for XGBoost training.

    Each of the ~100 real piles becomes ~6 rows: the original feature vector
    plus ``noise_replicas`` Gaussian-jittered variants (continuous columns
    only).  Labels come from :func:`synthesize_utilization_label` so the
    target has variance that *correlates with the features*, which is what
    XGBoost needs to learn anything beyond the global mean.
    """
    rng = np.random.default_rng(seed)
    real = _load_real_piles_with_avg_occupancy()
    if not real:
        raise RuntimeError("No piles found in DB.  Run `python -m db.seed` first.")

    base_X = np.stack([pile_to_features(p, real) for p in real])
    base_y = np.asarray(
        [synthesize_utilization_label(x, rng) for x in base_X],
        dtype=np.float32,
    )

    Xs = [base_X]
    ys = [base_y]
    cont_mask = np.array([1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0], dtype=np.float32)
    sigma_per_col = np.array(
        [0.0005, 0.0005, 600.0, 1.0, 1.0, 1.0, 1.0, 0.05, 0, 0, 0, 0],
        dtype=np.float32,
    )
    for _ in range(noise_replicas):
        noise = rng.standard_normal(base_X.shape).astype(np.float32) * sigma_per_col * cont_mask
        X_aug = base_X + noise
        X_aug[:, 2] = np.clip(X_aug[:, 2], 0.0, None)
        X_aug[:, 3:7] = np.clip(X_aug[:, 3:7], 0.0, None)
        X_aug[:, 7] = np.clip(X_aug[:, 7], 0.0, 1.0)
        y_aug = np.asarray(
            [synthesize_utilization_label(x, rng) for x in X_aug],
            dtype=np.float32,
        )
        Xs.append(X_aug)
        ys.append(y_aug)

    return np.concatenate(Xs, axis=0), np.concatenate(ys, axis=0)
