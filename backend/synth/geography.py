"""Hangzhou pile placement.

The two regions in this project are:

* ``future_tech_city`` — 60 piles around 30.275 °N, 120.030 °E (radius 5 km).
* ``qiantang_new_area`` — 40 piles around 30.300 °N, 120.350 °E (radius 6 km).

Each pile is assigned a deterministic ``id``, geographic coordinates, an
operator (via :mod:`synth.operators`), a capacity tier, an install date,
and a subsidy treatment / control flag.

Determinism: pass ``seed`` to get a reproducible list.
"""

from __future__ import annotations

import math
import random
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from synth.operators import allocate_piles_to_operators


@dataclass(frozen=True, slots=True)
class RegionDef:
    id: str
    name_zh: str
    name_en: str
    center_lat: float
    center_lng: float
    radius_km: float
    description: str


REGIONS: dict[str, RegionDef] = {
    "future_tech_city": RegionDef(
        id="future_tech_city",
        name_zh="未来科技城",
        name_en="Future Tech City",
        center_lat=30.275,
        center_lng=120.030,
        radius_km=5.0,
        description="阿里巴巴 / 网易 / 西溪园区集群，互联网公司潮汐充电高峰显著。",
    ),
    "qiantang_new_area": RegionDef(
        id="qiantang_new_area",
        name_zh="钱塘新区",
        name_en="Qiantang New Area",
        center_lat=30.300,
        center_lng=120.350,
        radius_km=6.0,
        description="新规划制造业 + 大学城，需求曲线相对平缓。",
    ),
}


@dataclass(frozen=True, slots=True)
class PileLocation:
    """One generated pile's static metadata.

    The fields here line up 1-to-1 with :class:`api.models.Pile` columns
    that are set at seed time (live snapshot fields are owned by the
    realtime ticker, not the placement layer).
    """

    id: str
    operator_id: str
    region_id: str
    lat: float
    lng: float
    capacity_kw: float
    connector_type: str
    installed_at: datetime
    subsidy_amount: float
    subsidy_group: str  # "treatment" | "control"


_CAPACITY_TIERS: tuple[float, ...] = (60.0, 120.0, 180.0, 240.0)


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km between two coordinates."""
    r_earth = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r_earth * math.asin(math.sqrt(a))


def _random_point_in_disc(
    rng: random.Random,
    centre_lat: float,
    centre_lng: float,
    radius_km: float,
) -> tuple[float, float]:
    """Sample a point uniformly inside a disc of ``radius_km`` around the centre.

    Uniform-on-disc sampling uses ``r = R · sqrt(u)`` to avoid clustering at
    the centre.  The conversion km → degrees uses the local longitude
    correction ``cos(lat)``.
    """
    u = rng.random()
    r_km = radius_km * math.sqrt(u)
    theta = rng.uniform(0.0, 2 * math.pi)
    # 1 deg lat ≈ 111 km.  1 deg lng ≈ 111 · cos(lat) km.
    dlat = (r_km * math.cos(theta)) / 111.0
    dlng = (r_km * math.sin(theta)) / (111.0 * math.cos(math.radians(centre_lat)))
    return centre_lat + dlat, centre_lng + dlng


def generate_pile_locations(
    seed: int = 42,
    total: int = 100,
    ftc_count: int = 60,
    qta_count: int = 40,
) -> list[PileLocation]:
    """Generate the full pile fleet deterministically.

    Args:
        seed: master RNG seed.
        total: total number of piles.
        ftc_count: piles in Future Tech City.
        qta_count: piles in Qiantang New Area.

    Returns:
        A list of :class:`PileLocation` of length ``total``.
        Order is FTC piles first, then QTA piles.
    """
    if ftc_count + qta_count != total:
        raise ValueError(
            f"region counts {ftc_count}+{qta_count} must sum to total {total}"
        )

    rng = random.Random(seed)
    operators = allocate_piles_to_operators(total)
    rng.shuffle(operators)  # so operators don't cluster by region

    out: list[PileLocation] = []
    now = datetime.now(timezone.utc)
    plan = [
        ("future_tech_city", ftc_count),
        ("qiantang_new_area", qta_count),
    ]

    idx = 0
    for region_id, count in plan:
        region = REGIONS[region_id]
        for _ in range(count):
            lat, lng = _random_point_in_disc(
                rng, region.center_lat, region.center_lng, region.radius_km
            )
            capacity = rng.choice(_CAPACITY_TIERS)
            install_days_ago = rng.randint(365, 365 * 3)
            installed_at = now - timedelta(days=install_days_ago)

            # ~50% of piles received a subsidy; among those split treatment/control 50/50
            # so functions 6 (DID) has a non-trivial sample on both sides.
            has_subsidy = rng.random() < 0.5
            if has_subsidy:
                subsidy_group = "treatment" if rng.random() < 0.5 else "control"
                subsidy_amount = round(rng.uniform(20_000, 100_000), 2)
            else:
                subsidy_group = "control"
                subsidy_amount = 0.0

            pile_id = f"pile-{idx:03d}-{uuid.UUID(int=rng.getrandbits(128)).hex[:8]}"
            out.append(
                PileLocation(
                    id=pile_id,
                    operator_id=operators[idx],
                    region_id=region_id,
                    lat=round(lat, 6),
                    lng=round(lng, 6),
                    capacity_kw=capacity,
                    connector_type="GB/T",
                    installed_at=installed_at,
                    subsidy_amount=subsidy_amount,
                    subsidy_group=subsidy_group,
                )
            )
            idx += 1
    return out
