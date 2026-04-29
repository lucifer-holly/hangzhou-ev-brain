"""Batch LSTM forecasting helper.

The single-pile :func:`ai.lstm_demand.inference.predict_pile` reloads the
entire 30-day telemetry DataFrame on every call (see
:func:`ai.lstm_demand.data_loader.latest_window_for_pile`). For the IOC
homepage we need predictions across all 100 piles, so doing that 100×
takes minutes.

This module loads the DataFrame and neighbor map ONCE per request, then
slices a window per pile and reuses the cached PyTorch model. A short
in-process TTL cache keeps repeated dashboard refreshes cheap.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass

import numpy as np
import torch

from ai.lstm_demand.data_loader import (
    _NEIGHBOR_RADIUS_KM,
    _augment_features,
    _build_neighbor_map,
    _load_pile_meta,
    _load_telemetry_df,
)
from ai.lstm_demand.inference import _load_model
from ai.lstm_demand.model import INPUT_DIM, SEQ_LEN

log = logging.getLogger("ai.lstm_demand.batch")


@dataclass(frozen=True, slots=True)
class BatchPrediction:
    pile_id: str
    predicted_occupancy: float
    std: float
    ci_low: float
    ci_high: float


_FEATURE_COLS = [
    "occupancy_rate",
    "power_normalized",
    "hour_sin",
    "hour_cos",
    "is_weekend",
    "is_holiday",
    "region_one_hot",
    "neighbor_avg_occupancy",
]

# Module-level TTL cache. The DataFrame is large (~72k rows) but mostly
# static between dashboard refreshes — a 60s TTL hides the cost without
# making the dashboard staler than the realtime ticker.
_WINDOW_CACHE: dict[str, np.ndarray] = {}
_WINDOW_CACHE_TS: float = 0.0
_WINDOW_TTL_SEC = 60.0


def _get_windows() -> dict[str, np.ndarray]:
    """Return the latest (24, 8) window for every pile, cached for 60s."""
    global _WINDOW_CACHE_TS
    now = time.time()
    if _WINDOW_CACHE and (now - _WINDOW_CACHE_TS) < _WINDOW_TTL_SEC:
        return _WINDOW_CACHE

    meta = _load_pile_meta()
    if not meta:
        _WINDOW_CACHE.clear()
        _WINDOW_CACHE_TS = now
        return _WINDOW_CACHE

    neighbors = _build_neighbor_map(meta, _NEIGHBOR_RADIUS_KM)
    df = _load_telemetry_df()
    df = _augment_features(df, neighbors)

    fresh: dict[str, np.ndarray] = {}
    for m in meta:
        pile_df = df[df["pile_id"] == m.pile_id].sort_values("ts")
        if len(pile_df) < SEQ_LEN:
            continue
        win = pile_df[_FEATURE_COLS].to_numpy(dtype=np.float32)[-SEQ_LEN:]
        if win.shape != (SEQ_LEN, INPUT_DIM):
            continue
        fresh[m.pile_id] = win

    _WINDOW_CACHE.clear()
    _WINDOW_CACHE.update(fresh)
    _WINDOW_CACHE_TS = now
    log.info("batch window cache rebuilt: %d piles", len(fresh))
    return _WINDOW_CACHE


def predict_all_piles(n_samples: int = 8) -> list[BatchPrediction]:
    """One-shot LSTM forecast across every pile that has enough history.

    Uses fewer MC-dropout samples (8 vs 30) because at 100 piles the
    extra precision rarely changes the rendered halo color, and the
    speedup is ~4×.
    """
    windows = _get_windows()
    if not windows:
        return []

    model = _load_model()
    cont_mask = torch.tensor([1, 1, 1, 1, 0, 0, 0, 1], dtype=torch.float32)

    out: list[BatchPrediction] = []
    with torch.no_grad():
        # Stack into (N, 24, 8) — one big tensor.
        ids = list(windows.keys())
        stack = torch.from_numpy(
            np.stack([windows[pid] for pid in ids], axis=0).astype(np.float32)
        )
        n = stack.shape[0]
        outs = np.zeros((n_samples, n), dtype=np.float32)
        for s in range(n_samples):
            noise = torch.randn_like(stack) * 0.02 * cont_mask
            preds = model(stack + noise).reshape(-1).numpy()
            outs[s] = preds
        means = outs.mean(axis=0)
        stds = outs.std(axis=0)
        for i, pid in enumerate(ids):
            mean = float(means[i])
            std = float(stds[i])
            out.append(
                BatchPrediction(
                    pile_id=pid,
                    predicted_occupancy=mean,
                    std=std,
                    ci_low=max(0.0, mean - 1.96 * std),
                    ci_high=min(1.0, mean + 1.96 * std),
                )
            )
    return out
