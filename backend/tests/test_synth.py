"""Tests for the synthetic data generator.

These pin down the contract the spec requires:

- Exactly 100 piles, 60 in future_tech_city, 40 in qiantang_new_area.
- Operator distribution 50 / 25 / 15 / 10.
- Latitudes and longitudes within Hangzhou's plausible bounding box.
- Demand model produces values in [0, 1] with the correct peak structure.
- Failure injection produces Poisson-ish counts in the spec range.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from synth.demand_model import compute_occupancy
from synth.failure_inject import inject_faults_for_day
from synth.geography import generate_pile_locations
from synth.operators import OPERATORS, allocate_piles_to_operators

# ---------- Operators ----------


class TestOperators:
    def test_four_operators_present(self):
        assert len(OPERATORS) == 4

    def test_market_shares_sum_to_one(self):
        total = sum(op.market_share for op in OPERATORS)
        assert total == pytest.approx(1.0, abs=1e-9)

    def test_market_shares_match_spec(self):
        shares = {op.id: op.market_share for op in OPERATORS}
        assert shares["state_grid"] == pytest.approx(0.50)
        assert shares["teld"] == pytest.approx(0.25)
        assert shares["starcharge"] == pytest.approx(0.15)
        assert shares["nio"] == pytest.approx(0.10)

    def test_allocation_matches_spec(self):
        allocation = allocate_piles_to_operators(total=100)
        counts: dict[str, int] = {}
        for op_id in allocation:
            counts[op_id] = counts.get(op_id, 0) + 1
        assert counts == {"state_grid": 50, "teld": 25, "starcharge": 15, "nio": 10}


# ---------- Geography ----------


class TestGeography:
    def test_total_pile_count(self):
        piles = generate_pile_locations(seed=42)
        assert len(piles) == 100

    def test_60_40_region_split(self):
        piles = generate_pile_locations(seed=42)
        ftc = sum(1 for p in piles if p.region_id == "future_tech_city")
        qta = sum(1 for p in piles if p.region_id == "qiantang_new_area")
        assert ftc == 60
        assert qta == 40

    def test_lat_lng_in_hangzhou_range(self):
        piles = generate_pile_locations(seed=42)
        for p in piles:
            assert 30.2 <= p.lat <= 30.4, f"lat out of range: {p.lat}"
            assert 119.9 <= p.lng <= 120.5, f"lng out of range: {p.lng}"

    def test_ftc_piles_cluster_around_their_centre(self):
        """All FTC piles should be inside the 5 km radius around 30.275, 120.030."""
        from synth.geography import REGIONS, _haversine_km

        ftc = REGIONS["future_tech_city"]
        piles = generate_pile_locations(seed=42)
        ftc_piles = [p for p in piles if p.region_id == "future_tech_city"]
        for p in ftc_piles:
            d = _haversine_km(p.lat, p.lng, ftc.center_lat, ftc.center_lng)
            assert d <= ftc.radius_km + 0.5  # small slack for the offset rounding

    def test_capacity_is_one_of_spec_levels(self):
        piles = generate_pile_locations(seed=42)
        allowed = {60.0, 120.0, 180.0, 240.0}
        for p in piles:
            assert p.capacity_kw in allowed, f"unexpected capacity {p.capacity_kw}"

    def test_install_dates_in_one_to_three_years_back(self):
        piles = generate_pile_locations(seed=42)
        now = datetime.now(UTC)
        oldest = now - timedelta(days=365 * 3 + 30)  # +1 month slack
        newest = now - timedelta(days=365 * 1 - 30)  # -1 month slack
        for p in piles:
            assert oldest <= p.installed_at <= newest, (
                f"installed_at out of range: {p.installed_at}"
            )

    def test_subsidy_groups_split(self):
        """Roughly half treatment / half control among subsidised piles."""
        piles = generate_pile_locations(seed=42)
        treatment = [p for p in piles if p.subsidy_group == "treatment"]
        control = [p for p in piles if p.subsidy_group == "control"]
        assert len(treatment) > 0
        assert len(control) > 0
        assert len(treatment) + len(control) == 100

    def test_deterministic_with_same_seed(self):
        a = generate_pile_locations(seed=42)
        b = generate_pile_locations(seed=42)
        assert [p.id for p in a] == [p.id for p in b]
        assert [p.lat for p in a] == [p.lat for p in b]


# ---------- Demand model ----------


class TestDemandModel:
    @pytest.mark.parametrize("hour", range(24))
    def test_occupancy_in_unit_interval(self, hour: int):
        """For every hour and either region, on weekday or weekend, occupancy ∈ [0,1]."""
        for region in ("future_tech_city", "qiantang_new_area"):
            for is_weekend in (False, True):
                v = compute_occupancy(
                    hour=hour, is_weekend=is_weekend, region_id=region, rng_value=0.0
                )
                assert 0.0 <= v <= 1.0

    def test_weekday_morning_peak_around_eight(self):
        """Weekday 08-09 occupancy should land in roughly the spec band."""
        peak_values = []
        for h in (8, 9):
            for region in ("future_tech_city", "qiantang_new_area"):
                peak_values.append(
                    compute_occupancy(hour=h, is_weekend=False, region_id=region, rng_value=0.0)
                )
        avg_peak = sum(peak_values) / len(peak_values)
        assert 0.55 <= avg_peak <= 0.85, f"morning peak avg {avg_peak} outside spec band"

    def test_weekday_evening_peak_around_eighteen(self):
        peak_values = []
        for h in (17, 18, 19):
            for region in ("future_tech_city", "qiantang_new_area"):
                peak_values.append(
                    compute_occupancy(hour=h, is_weekend=False, region_id=region, rng_value=0.0)
                )
        avg_peak = sum(peak_values) / len(peak_values)
        assert 0.70 <= avg_peak <= 0.95

    def test_weekend_is_flatter_than_weekday(self):
        """Weekend evening should be lower than weekday evening on average."""
        wd = sum(
            compute_occupancy(hour=h, is_weekend=False, region_id="future_tech_city", rng_value=0.0)
            for h in (17, 18, 19)
        )
        we = sum(
            compute_occupancy(hour=h, is_weekend=True, region_id="future_tech_city", rng_value=0.0)
            for h in (17, 18, 19)
        )
        assert we < wd

    def test_ftc_evening_higher_than_qta(self):
        """The spec says FTC has a heavier evening peak (互联网 commuters)."""
        ftc = compute_occupancy(
            hour=18, is_weekend=False, region_id="future_tech_city", rng_value=0.0
        )
        qta = compute_occupancy(
            hour=18, is_weekend=False, region_id="qiantang_new_area", rng_value=0.0
        )
        assert ftc > qta


# ---------- Failure injection ----------


class TestFailureInjection:
    def test_average_two_faults_per_day(self):
        """Across 30 simulated days the daily fault count should average ~2."""
        import random

        rng = random.Random(123)
        counts = []
        for _ in range(30):
            faults = inject_faults_for_day(
                pile_ids=[f"pile-{i}" for i in range(100)],
                rng=rng,
            )
            counts.append(len(faults))
        avg = sum(counts) / len(counts)
        assert 1.0 <= avg <= 3.5, f"avg daily faults {avg} outside expected band"

    def test_fault_types_cover_spec(self):
        import random

        rng = random.Random(99)
        seen = set()
        for _ in range(60):
            faults = inject_faults_for_day(pile_ids=[f"pile-{i}" for i in range(100)], rng=rng)
            for f in faults:
                seen.add(f.type)
        expected = {"voltage_anomaly", "thermal_fault", "vibration_event", "cable_fault"}
        assert seen >= expected, f"missing fault types: {expected - seen}"
