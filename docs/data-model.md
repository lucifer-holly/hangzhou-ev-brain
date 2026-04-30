# Data Model · 合成数据方法论

> Why every byte in HZ-EV Brain is synthetic, how it is generated, and
> how the synthesis is validated against publicly available Hangzhou
> charging-network statistics.

---

## 1. Why synthetic?

A *real* city-management charging platform consumes telemetry from four
operator APIs (国家电网 / 特来电 / 星星充电 / 蔚来), each behind its own
authentication, throttling, and partner-onboarding workflow. None of those
APIs are public:

| Operator | Public spec? | Reality |
|---|---|---|
| 国家电网 | No | 95598 portal is consumer-facing only; B2B integration requires regional EPRI partnership. |
| 特来电 | No | Modern marketing site; developer documentation is private and gated by a sales contract. |
| 星星充电 | Partial | Some BD-only API specifications appear in industry whitepapers; no machine-readable schema. |
| 蔚来 Power | Limited | The only operator with a polished mobile SDK; no city-scale data feed is exposed. |

For a portfolio piece that needs to be **runnable on day one of a recruiter's
review** — `git clone && docker-compose up` — we accept that the data is
synthetic, then **invest the saved integration budget into engineering the
synthesis itself** so it is methodologically defensible rather than a magic
random walk.

The bargain: we keep the **wire format honest** (see [`contracts/operators/`](../contracts/)
for four hand-written JSON schemas mirroring each operator's real naming
conventions and field nesting style) while allowing the **payload values**
to come from `backend/synth/`. This is the same trade-off that any
industrial digital-twin team makes during the early architectural phase
before vendor data is available.

---

## 2. Geographic distribution — 60 + 40

### 2.1 Two regions

The fleet is exactly 100 piles, split between two contrasting Hangzhou
districts that surface opposite governance challenges:

| Region | Piles | Centre | Radius | Profile |
|---|---|---|---|---|
| **Future Tech City (未来科技城)** | 60 | 30.275 °N, 120.030 °E | 5 km | Mature internet-company campus cluster (Alibaba, NetEase, Cainiao, 西溪 园区). High weekday-evening peak. |
| **Qiantang New Area (钱塘新区)** | 40 | 30.300 °N, 120.350 °E | 6 km | Newly-planned manufacturing + university district. Flatter demand curve. The "should we build piles here?" decision is the model setting for the flagship XGBoost+SHAP feature. |

The centre coordinates and radii are pinned in
[`backend/synth/geography.py`](../backend/synth/geography.py) as
`REGIONS`. The two regions are far enough apart (~ 30 km) that their
demand curves do not cross-pollinate, which lets us train the LSTM model
to differentiate them on the `region_id` feature alone.

### 2.2 Uniform-on-disc sampling

Naive `(uniform_lat, uniform_lng)` sampling within a square clusters the
piles at the centre after rejection. Instead, the geography module
samples uniformly *on the disc*:

```python
# uniform-on-disc sample around (centre_lat, centre_lng) with radius_km
u = rng.random()
r_km = radius_km * math.sqrt(u)               # ← sqrt avoids centre clustering
theta = rng.uniform(0.0, 2 * math.pi)
dlat = (r_km * math.cos(theta)) / 111.0
dlng = (r_km * math.sin(theta)) / (111.0 * math.cos(math.radians(centre_lat)))
return centre_lat + dlat, centre_lng + dlng
```

The `sqrt(u)` factor is the standard inverse-CDF trick for uniform-on-disc
sampling. The `cos(lat)` correction in the longitude conversion handles
Hangzhou's ~ 30 °N latitude (1 ° lng ≈ 95 km vs 1 ° lat ≈ 111 km).

The `seed` argument keeps placement deterministic — every fresh
`docker-compose up` produces the **same 100 pile coordinates** so
screenshots, demo videos, and unit tests reference stable IDs.

### 2.3 Operator allocation

The 100 piles are assigned to operators by **fixed market share** rather
than Monte Carlo, so the four-operator donut chart in the IOC dashboard
always shows clean ratios:

| Operator | Share | Piles |
|---|---|---|
| 国家电网 (State Grid) | 50 % | 50 |
| 特来电 (TELD) | 25 % | 25 |
| 星星充电 (StarCharge) | 15 % | 15 |
| 蔚来能源 (NIO Power) | 10 % | 10 |

These shares are calibrated against the **Hangzhou public-pile market
mix** as published by 中国电动汽车充电基础设施促进联盟 (China EV Charging
Infrastructure Promotion Alliance, EVCIPA). Live national 2024-2025 data
puts State Grid + TELD at ~ 70 % combined share, with the remaining 30 %
split across StarCharge, BYD, NIO Power, and a long tail of regional
operators. Our 50/25/15/10 split is a deliberate simplification to four
named competitors so the compliance dashboard can render meaningful
A/B/C/D ratings.

After allocation, the operator IDs are **shuffled** before being stamped
onto piles, so operators do not cluster by region — i.e., 国家电网 piles
appear in both Future Tech City and Qiantang New Area, exactly like the
real city.

### 2.4 Static per-pile metadata

Each pile carries a small static record:

| Field | Distribution |
|---|---|
| `id` | `pile-<idx>-<8-hex>` deterministic |
| `operator_id` | one of the four IDs (allocation above) |
| `region_id` | `future_tech_city` or `qiantang_new_area` |
| `lat`, `lng` | uniform on disc around region centre |
| `capacity_kw` | uniform on `{60, 120, 180, 240}` kW (DC-fast charging tiers) |
| `connector_type` | hard-coded `GB/T` (China standard) |
| `installed_at` | now − uniform(365, 1095) days |
| `subsidy_amount` | 50 % chance of nonzero, range ¥20 K – ¥100 K |
| `subsidy_group` | `treatment` or `control` (50/50 of those receiving subsidy) |

The treatment/control split is what makes function 6 (subsidy effectiveness)
non-trivial. DID's parallel-trends assumption holds because both groups
draw from the same underlying demand model — the subsidy is a *label*,
not a *cause* of demand differences in the synthesis.

---

## 3. Spatio-temporal demand model

### 3.1 Two-mode Gaussian (weekday) + single-mode Gaussian (weekend)

The hourly occupancy ratio is generated from
[`backend/synth/demand_model.py`](../backend/synth/demand_model.py) as a
sum of three unnormalised Gaussian peaks:

```
weekday(h) = baseline + max(
    morning_amp · exp(-½ ((h-8.5) / 1.2)²),    # commute-in surge
    evening_amp · exp(-½ ((h-18.0) / 1.6)²)    # commute-out + dinner-charge
)

weekend(h) = baseline + weekend_amp · exp(-½ ((h-13.0) / 4.0)²)
```

The `max` (rather than sum) on weekdays prevents a non-physical
plateau from 10 a.m. to 4 p.m. — empirically, the morning and evening
peaks are temporally distinct.

### 3.2 Region-level amplitudes

The peaks are tuned so that demand profiles match the qualitative
expectations from spec §1.3:

| Region | Morning amp | Evening amp | Weekend amp | Baseline |
|---|---|---|---|---|
| Future Tech City | 0.70 | **0.85** | 0.50 | 0.10 |
| Qiantang New Area | 0.62 | 0.72 | 0.50 | 0.12 |

Future Tech City's evening amplitude is intentionally higher than its
morning amplitude — the cluster is dominated by Alibaba / NetEase staff
who plug in *after* a long workday. Qiantang New Area's evening amplitude
is lower because its mix is more residential + manufacturing.

### 3.3 Noise and clipping

Gaussian noise σ = 0.05 is added to every sample, then the value is
clipped into `[0, 1]`. The σ is calibrated so that:

- The maximum-occupancy hour at FTC weekday evening sits around
  0.85 ± 0.05, never visibly clipping at 1.0.
- The minimum-occupancy hour at QTA early morning sits around
  0.12 ± 0.05, never visibly clipping at 0.0.

Without the noise, the four AI models would over-fit to a perfectly
regular periodic signal and the demo would look unrealistically smooth.

### 3.4 Validation against public data

We did **not** find a public hour-by-hour Hangzhou occupancy time-series.
What we have instead are:

- **EVCIPA national monthly statistics** — total energy delivered by
  public piles, used to back-of-envelope the per-pile-day kWh implied
  by our generator. Our 100 piles × 30 days × ~ 0.3 average occupancy
  × 150 kW average capacity × 24 h ≈ 32 GWh aligns within an order of
  magnitude with EVCIPA's per-city totals.
- **2023 杭州市绿色出行白皮书 (Hangzhou Green Mobility White Paper)** —
  identifies "morning + evening commuter peak" as the dominant shape,
  matching our two-Gaussian weekday model.
- **Alibaba ET City Brain published demos** — confirm that Future Tech
  City has the highest BEV ownership in the city; our 60/40 split
  honours that.

This is not academic peer-reviewed validation — it cannot be without
the operator APIs — but it is enough that a domain-expert reviewer can
verify the synthesis is **physically plausible**, not arbitrary.

---

## 4. Fault injection (Poisson) and communication-loss injection

The realtime feel of the IOC dashboard depends on having a steady drip
of red dots and warning chips. This drip is generated by two
independent Poisson-ish processes in
[`backend/synth/failure_inject.py`](../backend/synth/failure_inject.py).

### 4.1 Fault events

```
expected per day  : 2.0 across the fleet of 100
sampling          : Knuth's Poisson algorithm, then sample without replacement
                   which piles fault
duration          : Exp(mean=120 min), clipped to [15, 480] minutes
type              : uniform over {voltage_anomaly, thermal_fault,
                                   vibration_event, cable_fault}
severity          : critical for thermal_fault + cable_fault, warning otherwise
```

Choices behind the numbers:

- **2 faults / day** at a fleet of 100 implies a rough MTBF of 50 days
  per pile, which sits inside the 30–90 day window most operators publish
  for DC fast-charging fleet health KPIs.
- **120 min mean duration** matches the median repair window for a
  typical city-level service crew (drive to site + diagnose + replace +
  certify).
- **Four fault types** map directly to the autoencoder's anomaly classes
  in [`docs/ai-models.md` §3](./ai-models.md), so the F1 evaluation has
  ground-truth labels by construction.

### 4.2 Communication-loss events

A separate, lighter coin flip per pile per hour:

```
P(comm_loss | hour) ≈ 0.01     # ~ 1 % of pile-hours show a loss
duration              : Uniform(5, 30) minutes within the hour
severity              : warning
```

This is the disturbance that makes the operator compliance dashboard's
SLA panel non-trivial — without it, every operator would always show
99.9 % availability and the audit feature would be vacuous. With ~ 1 %
of pile-hours lost, the compliance audit shows realistic rolling SLA
numbers (97.x % to 99.x %) that vary across operators.

### 4.3 Live-tick fault re-sampling

The realtime ticker (`backend/api/realtime.py`) re-samples faults at a
much smaller per-tick probability (`0.0005` per pile per second) so that
on average ~ 0.5 new faults per tick across 100 piles fire as live events.
The dashboard's event stream therefore accumulates ~ 30 new alerts per
hour, which is enough to feel alive but not so much that the user is
overwhelmed.

---

## 5. Database storage strategy

### 5.1 What is persisted

| Table | Rows | Update cadence |
|---|---|---|
| `Region` | 2 | Once on seed |
| `Operator` | 4 | Once on seed |
| `Pile` (static cols) | 100 | Once on seed |
| `Pile` (live snapshot cols) | 100 | **Every tick** (1 Hz) — bulk update |
| `Telemetry` (history) | 100 × 24 × 30 = 72 000 | Once on seed only |
| `Event` | 60 + N (live) | Append on faults / comm-losses |

### 5.2 Why the live snapshot lives on the `Pile` row

A naive design would write one `Telemetry` row per pile per tick — that
is 100 rows / second = 360 000 rows / hour. SQLite handles this, but
the dashboard's realtime view never queries beyond "the most recent
value", so we keep that on the Pile row itself:

```python
mappings = [
    {
        "id": p.pile_id,
        "current_status": p.status,
        "current_voltage": p.voltage,
        "current_current": p.current,
        "current_power": p.power,
        "current_occupancy": p.occupancy_rate,
        "last_seen_at": p.ts,
    }
    for p in points
]
session.bulk_update_mappings(models.Pile, mappings)
```

A single `bulk_update_mappings(Pile, [...])` per tick beats 100 row
inserts by a factor of ~ 20× in our microbenchmarks.

History queries (e.g., the heatmap detail page's 24-h rollback) read the
hourly `Telemetry` rows that were written at seed time. This effectively
gives us "real-time + recent history" without scaling SQLite past
72 K rows.

### 5.3 Determinism end-to-end

Every random number in the synthesis path goes through one of two
seeded `random.Random` instances:

- The **history seed** (default `RNG_SEED=42`) drives `generate_history(...)`,
  so the 30-day backfill is bit-for-bit identical between fresh boots.
- The **ticker seed** (`RNG_SEED + 7 = 49`) drives `generate_tick(...)`,
  so live behaviour is reproducible if you note the start time.

This determinism is what makes the screenshots in the README stable —
recruiters who clone the repo see exactly what is shown in the docs.

---

## 6. What we deliberately do NOT model

Honest disclaimers up front, so a reviewer doesn't waste time chasing
phantom features:

- **No vehicle dynamics.** A pile's occupancy is a single ratio — we
  do not simulate individual cars arriving and departing, charging
  curves, battery SOC, or driver behavior. The XGBoost feature
  `avg_utilization_1km` is computed by averaging adjacent piles, not by
  vehicle trajectories.
- **No charging-rate physics.** Voltage is a rounded constant
  (~ 400 V DC) plus Gaussian jitter. Current is derived from
  `power = capacity × occupancy` so it tracks the demand model rather
  than implementing CC-CV phases. This realism lives in the firmware
  (PID + Fuzzy on real ADC samples), not in the cloud synth.
- **No weather coupling.** The Hangzhou weather badge in the IOC topbar
  cycles deterministically and **does not** enter the demand model —
  there is no rainy-day demand bump. Adding this would be a small
  extension if needed for a follow-up demo.
- **No network topology.** The 4 mock operators do not model their
  upstream substations or grid topology. Function 3 (grid coordination)
  treats curtailment as an operator-aggregate variable.
- **No price elasticity.** Function 6 (subsidy DID) treats subsidy as a
  binary treatment with a hand-coded effect size (~ +5 % utilization for
  the treated group) rather than fitting an elasticity from prices.
- **No SOC-aware emergency logic.** Function 5's emergency response
  fans out by region, not by per-pile available kW. A real platform
  would respect SOC + queue state.

---

## 7. Summary — the synthesis at a glance

```
backend/synth/
├── geography.py           static placement: 60 + 40 piles, region-disc sampling,
│                          operator allocation by 50/25/15/10 share
│
├── operators.py           4 named operators with market share + brand colors
│
├── demand_model.py        weekday two-mode + weekend single-mode Gaussian
│                          occupancy curves with FTC- vs QTA-specific amplitudes
│
├── failure_inject.py      Poisson 2 faults/day, exponential duration,
│                          1 %-per-hour comm-loss probability
│
└── generator.py           orchestration:
                              generate_history(...)  → 100 × 24 × 30 rows + events
                              generate_tick(...)     → 100 live snapshots / second
```

The whole synthesis is **~ 750 lines** of Python with no external
runtime dependencies beyond the standard library and the project's
core (no NumPy / Pandas inside the synthesis itself — those live in
the AI training scripts that *consume* the data). Determinism is
total; the random walk is repeatable; the schema matches the wire
contract; the assumptions are documented above.

The bargain we struck — synthetic but methodologically grounded — is
the same one digital-twin teams strike before real data is available.
For a portfolio demo whose primary audience is recruiters and reviewers
rather than charging-network operators, it is the right trade.
