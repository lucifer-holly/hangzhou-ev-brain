"""Evaluate the LSTM demand model on the held-out test split."""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
import torch

from ai.lstm_demand.data_loader import build_dataset
from ai.lstm_demand.inference import _load_model

log = logging.getLogger("ai.lstm_demand.evaluate")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@dataclass(frozen=True, slots=True)
class LstmMetrics:
    mae: float
    rmse: float
    mape: float
    n_samples: int


def evaluate() -> LstmMetrics:
    bundle = build_dataset()
    model = _load_model()
    x = torch.from_numpy(bundle.x_test)
    y = bundle.y_test
    with torch.no_grad():
        pred = model(x).squeeze(1).cpu().numpy()
    err = pred - y
    mae = float(np.abs(err).mean())
    rmse = float(np.sqrt(np.mean(err**2)))
    # MAPE only on samples where the truth isn't tiny — avoids div-by-zero
    # for nighttime idle hours where occupancy is near 0.
    mask = y > 0.05
    if mask.any():
        mape = float(np.abs(err[mask] / y[mask]).mean())
    else:
        mape = float("nan")
    return LstmMetrics(mae=mae, rmse=rmse, mape=mape, n_samples=int(len(y)))


if __name__ == "__main__":
    m = evaluate()
    log.info("LSTM test metrics: MAE=%.4f RMSE=%.4f MAPE=%.4f n=%d", m.mae, m.rmse, m.mape, m.n_samples)
    print(f"MAE: {m.mae:.4f}")
    print(f"RMSE: {m.rmse:.4f}")
    print(f"MAPE: {m.mape:.4f}")
