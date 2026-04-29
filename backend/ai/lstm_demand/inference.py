"""Inference helpers for the LSTM demand model.

Loads :data:`CHECKPOINT_PATH` once on first call and caches the model in
process memory.  ``predict_pile`` is the high-level entry-point used by
the FastAPI router.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch

from ai.lstm_demand.data_loader import latest_window_for_pile
from ai.lstm_demand.model import DemandLSTM, INPUT_DIM, SEQ_LEN

log = logging.getLogger("ai.lstm_demand.inference")

CHECKPOINT_PATH = Path(__file__).parent / "saved" / "checkpoint.pt"

_model_cache: DemandLSTM | None = None


@dataclass(frozen=True, slots=True)
class DemandPrediction:
    """Predicted occupancy with a Bayesian-style uncertainty band.

    Attributes:
        predicted_occupancy: mean prediction in [0, 1].
        std: 1-sigma uncertainty estimated by MC-dropout-equivalent
            input perturbation (we add Gaussian jitter to the input
            window 30 times and take the std of outputs).
        ci_low: predicted - 1.96·std, clipped to [0, 1].
        ci_high: predicted + 1.96·std, clipped to [0, 1].
        hours_ahead: how many hours into the future this prediction
            covers (1 means "the next hour").
    """

    predicted_occupancy: float
    std: float
    ci_low: float
    ci_high: float
    hours_ahead: int


class ModelNotTrainedError(RuntimeError):
    """Raised when ``saved/checkpoint.pt`` is missing."""


def _load_model() -> DemandLSTM:
    global _model_cache
    if _model_cache is not None:
        return _model_cache
    if not CHECKPOINT_PATH.exists():
        raise ModelNotTrainedError(
            f"LSTM checkpoint not found at {CHECKPOINT_PATH}. "
            "Run `python -m ai.lstm_demand.train` first."
        )
    payload = torch.load(CHECKPOINT_PATH, map_location="cpu", weights_only=False)
    cfg = payload.get("config", {})
    model = DemandLSTM(
        input_dim=cfg.get("input_dim", INPUT_DIM),
        hidden_dim=cfg.get("hidden_dim", 64),
        num_layers=cfg.get("num_layers", 2),
    )
    model.load_state_dict(payload["state_dict"])
    model.eval()
    _model_cache = model
    log.info("loaded LSTM checkpoint")
    return model


def predict_window(window: np.ndarray, n_samples: int = 30) -> DemandPrediction:
    """Score a single (24, 8) window with input-jitter uncertainty.

    We add small Gaussian noise to the *non-categorical* features and
    take the predictive std as the band — cheap, deterministic-ish, and
    enough for the dashboard.
    """
    if window.shape != (SEQ_LEN, INPUT_DIM):
        raise ValueError(
            f"window shape {window.shape} != expected ({SEQ_LEN}, {INPUT_DIM})"
        )
    model = _load_model()
    with torch.no_grad():
        base = torch.from_numpy(window.astype(np.float32)).unsqueeze(0)
        # Continuous features are columns 0..3 and 7; 4..6 are binary flags.
        cont_mask = torch.tensor([1, 1, 1, 1, 0, 0, 0, 1], dtype=torch.float32)
        outs: list[float] = []
        for _ in range(n_samples):
            noise = torch.randn_like(base) * 0.02 * cont_mask
            pred = model(base + noise).item()
            outs.append(float(pred))
    arr = np.asarray(outs)
    mean = float(arr.mean())
    std = float(arr.std())
    return DemandPrediction(
        predicted_occupancy=mean,
        std=std,
        ci_low=max(0.0, mean - 1.96 * std),
        ci_high=min(1.0, mean + 1.96 * std),
        hours_ahead=1,
    )


def predict_pile(pile_id: str, hours_ahead: int = 1) -> DemandPrediction:
    """Convenience wrapper used by the FastAPI router.

    For ``hours_ahead > 1`` we recursively roll the prediction forward
    by feeding the previous mean back into the window.  Beyond ~6 hours
    the noise band widens substantially — we still return it but the
    caller should treat it as indicative.
    """
    window = latest_window_for_pile(pile_id)
    if window is None:
        raise ValueError(f"not enough history for pile {pile_id}")
    pred = predict_window(window)
    if hours_ahead <= 1:
        return pred

    rolling_window = window.copy()
    for h in range(2, hours_ahead + 1):
        rolling_window = np.roll(rolling_window, shift=-1, axis=0)
        # New synthetic step: keep all features but bump occupancy + power
        # to the previous prediction.
        rolling_window[-1, 0] = pred.predicted_occupancy
        rolling_window[-1, 1] = pred.predicted_occupancy
        # Roll the hour encoding by one step.
        prev_h = float(np.arctan2(rolling_window[-2, 2], rolling_window[-2, 3]))
        new_h = prev_h + (2 * np.pi / 24)
        rolling_window[-1, 2] = float(np.sin(new_h))
        rolling_window[-1, 3] = float(np.cos(new_h))
        pred = predict_window(rolling_window)
    return DemandPrediction(
        predicted_occupancy=pred.predicted_occupancy,
        std=pred.std,
        ci_low=pred.ci_low,
        ci_high=pred.ci_high,
        hours_ahead=hours_ahead,
    )
