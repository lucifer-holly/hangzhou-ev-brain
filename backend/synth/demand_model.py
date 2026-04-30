"""Time-of-day / region occupancy curves.

The user-facing contract:

* Weekday:
    - Morning peak 08-09 h, occupancy ≈ 0.70
    - Evening peak 17-19 h, occupancy ≈ 0.85
* Weekend:
    - Flatter curve, mid-day plateau ≈ 0.50
* Future Tech City has a heavier evening peak (互联网公司晚高峰).
* Qiantang New Area has a flatter, more uniform curve.
* All values clipped to [0, 1] with optional Gaussian noise σ=0.05.

The output is a deterministic value when ``rng_value=0.0``, which makes
the demand contract easy to test.
"""

from __future__ import annotations

import math


def _gaussian(x: float, mu: float, sigma: float) -> float:
    """Unnormalised Gaussian — peak = 1 at ``x = mu``."""
    return math.exp(-0.5 * ((x - mu) / sigma) ** 2)


_WEEKDAY_MORNING_MU = 8.5
_WEEKDAY_MORNING_SIGMA = 1.2
_WEEKDAY_EVENING_MU = 18.0
_WEEKDAY_EVENING_SIGMA = 1.6

_WEEKEND_MIDDAY_MU = 13.0
_WEEKEND_MIDDAY_SIGMA = 4.0


def compute_occupancy(
    hour: int,
    is_weekend: bool,
    region_id: str,
    rng_value: float = 0.0,
) -> float:
    """Return the synthetic occupancy in ``[0, 1]`` for the given context.

    Args:
        hour: integer hour-of-day in ``[0, 23]``.
        is_weekend: True for Saturday / Sunday.
        region_id: ``"future_tech_city"`` | ``"qiantang_new_area"``.
        rng_value: Gaussian noise sample to add (σ=0.05).  Pass 0 in tests
            to get the deterministic centre-line.
    """
    if not 0 <= hour <= 23:
        raise ValueError(f"hour out of range: {hour}")

    # Region weights tuned so:
    #   FTC weekday evening avg @ h=18 ≈ 0.85, morning @ h=8 ≈ 0.70
    #   QTA weekday evening avg @ h=18 ≈ 0.72, morning @ h=8 ≈ 0.62
    #   weekend midday avg ≈ 0.50, with a small floor
    if region_id == "future_tech_city":
        morning_amp = 0.70
        evening_amp = 0.85
        weekend_amp = 0.50
        baseline = 0.10
    elif region_id == "qiantang_new_area":
        morning_amp = 0.62
        evening_amp = 0.72
        weekend_amp = 0.50
        baseline = 0.12
    else:
        raise ValueError(f"unknown region_id: {region_id}")

    if is_weekend:
        value = baseline + weekend_amp * _gaussian(hour, _WEEKEND_MIDDAY_MU, _WEEKEND_MIDDAY_SIGMA)
    else:
        morning = morning_amp * _gaussian(hour, _WEEKDAY_MORNING_MU, _WEEKDAY_MORNING_SIGMA)
        evening = evening_amp * _gaussian(hour, _WEEKDAY_EVENING_MU, _WEEKDAY_EVENING_SIGMA)
        value = baseline + max(morning, evening)

    value += rng_value  # caller-supplied Gaussian noise, σ=0.05 typically
    return max(0.0, min(1.0, value))
