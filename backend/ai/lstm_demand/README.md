# `lstm_demand/` — Hourly demand prediction (LSTM)

Predicts the next-hour occupancy ratio (∈ [0, 1]) for a single pile from
its past 24 hours of telemetry plus its neighborhood signal.

## Architecture (spec §7.2)

```
input  : (batch, 24, 8)        past 24 hours × 8 features
LSTM   : hidden=64, layers=2
FC     : 64 → ReLU(32) → 1 → Sigmoid
output : scalar in [0, 1]
```

The 8 features are listed at the top of [`model.py`](./model.py).
Feature 7 (`neighbor_avg_occupancy`) couples each pile's prediction to
the live state of its 5 km neighbors — that's what makes the LSTM
useful in the live IOC dashboard.

## Reproducing

```bash
python -m ai.lstm_demand.train       # ~2 min on CPU
python -m ai.lstm_demand.evaluate
```

Artefacts:
* `saved/checkpoint.pt` — `state_dict`, config, train/val loss history.
* `saved/training_loss.png` — train + val MSE curves.

## Inference (FastAPI)

`POST /api/ai/predict/demand` calls
[`inference.predict_pile`](./inference.py).  The endpoint accepts
`hours_ahead` ≥ 1 and rolls the prediction forward by feeding back the
previous mean — the std of 30 input-jittered passes is used as the
1-σ uncertainty band.

## Numbers

* Training set: ~48 720 windows (70 % time-split of 100 piles × 30 days).
* Test MAE on the latest 15 % of windows: ~0.043 (target < 0.08).
* MAPE (computed only on hours with occupancy > 0.05) ≈ 18 %.
