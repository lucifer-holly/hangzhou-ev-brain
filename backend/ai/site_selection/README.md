# `site_selection/` — XGBoost + SHAP ⭐ (flagship)

The interpretable site-selection regressor used by the City Console's
"在这建 N 根桩，6 个月后利用率多少？" feature.

## What it does

Given a 12-D feature vector for a candidate location it returns:

* a 6-month expected utilization in [0, 1]
* a 95 % confidence band (calibrated σ from training residuals)
* the **top-3 SHAP contributions** — that's the demo's wow moment.

```
input vector (12 D)
  ├── lat / lng                                       (geographic anchor)
  ├── pop_density_1km                                 (synthetic prior)
  ├── poi_{mall, office, residential}_count           (synthetic POI)
  ├── existing_pile_count_1km                         (real, from DB)
  ├── avg_utilization_1km                             (real, 30-day avg)
  ├── road_grade   1=支路 / 2=次干道 / 3=主干道       (lat/lng-derived)
  └── operator one-hot {state_grid, teld, starcharge} (NIO is the reference)
```

See [`feature_engineering.py`](./feature_engineering.py) for the full
prior — population density falls off with Gaussian distance from each
region centre, POI counts are weighted by region (offices in
未来科技城, residential in 钱塘新区).

## Why a synthetic label?

The seeded telemetry is generated from a *time-of-day-driven* demand
model, so 30-day-averaged occupancy is virtually constant across piles
in the same region (std ≈ 0.003).  XGBoost can't learn anything from a
constant label, so we synthesise a richer ground-truth label with
[`synthesize_utilization_label`](./feature_engineering.py) — a hand-coded
linear-ish function of the same features the model is supposed to
reason about.  This is a deliberate *demo* trick: the model is honestly
recovering a known function, and SHAP correctly attributes the
contribution back to office count, road grade, etc.

## Reproducing

```bash
python -m ai.site_selection.train
python -m ai.site_selection.evaluate
```

Artefacts in `saved/`:
* `model.json` — XGBoost native dump.
* `shap_explainer.pkl` — `shap.TreeExplainer` (joblib-pickled).
* `predicted_vs_actual.png` — test-set scatter.

## Numbers

* Training matrix: 600 rows × 12 features (100 piles × 6 jittered replicas).
* Test R² ≈ 0.94 on the 20 % held-out rows (target > 0.85).
* MAE ≈ 0.030.
