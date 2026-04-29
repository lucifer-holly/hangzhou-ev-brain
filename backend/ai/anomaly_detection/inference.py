"""Inference helpers for the autoencoder."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch

from ai.anomaly_detection.data_loader import latest_window_for_pile
from ai.anomaly_detection.model import (
    AE_INPUT_DIM,
    AE_LATENT_DIM,
    NUM_CHANNELS,
    PileAutoencoder,
    SEQ_LEN,
)

log = logging.getLogger("ai.anomaly_detection.inference")

CHECKPOINT_PATH = Path(__file__).parent / "saved" / "autoencoder.pt"

_model_cache: PileAutoencoder | None = None
_threshold_cache: float | None = None


class ModelNotTrainedError(RuntimeError):
    """Raised when ``saved/autoencoder.pt`` is missing."""


@dataclass(frozen=True, slots=True)
class AnomalyScore:
    pile_id: str
    is_anomaly: bool
    reconstruction_error: float
    threshold: float
    margin_ratio: float  # error / threshold; >1 means above the line


def _load() -> tuple[PileAutoencoder, float]:
    global _model_cache, _threshold_cache
    if _model_cache is not None and _threshold_cache is not None:
        return _model_cache, _threshold_cache
    if not CHECKPOINT_PATH.exists():
        raise ModelNotTrainedError(
            f"Autoencoder checkpoint not found at {CHECKPOINT_PATH}. "
            "Run `python -m ai.anomaly_detection.train` first."
        )
    payload = torch.load(CHECKPOINT_PATH, map_location="cpu", weights_only=False)
    cfg = payload.get("config", {})
    model = PileAutoencoder(
        input_dim=cfg.get("input_dim", AE_INPUT_DIM),
        latent_dim=cfg.get("latent_dim", AE_LATENT_DIM),
    )
    model.load_state_dict(payload["state_dict"])
    model.eval()
    threshold = float(payload["threshold"])
    _model_cache = model
    _threshold_cache = threshold
    log.info("loaded autoencoder (threshold=%.5f)", threshold)
    return model, threshold


def score_window(window: np.ndarray) -> tuple[float, float]:
    """Return (reconstruction_error, threshold) for a single (8, 32) window."""
    if window.shape != (NUM_CHANNELS, SEQ_LEN):
        raise ValueError(
            f"window shape {window.shape} != expected ({NUM_CHANNELS}, {SEQ_LEN})"
        )
    model, threshold = _load()
    with torch.no_grad():
        x = torch.from_numpy(window.astype(np.float32)).unsqueeze(0)
        err = float(model.reconstruction_error(x).item())
    return err, threshold


def check_pile(pile_id: str) -> AnomalyScore:
    """Pull the latest 32-step window for ``pile_id`` and score it."""
    window = latest_window_for_pile(pile_id)
    if window is None:
        raise ValueError(f"not enough history for pile {pile_id}")
    err, threshold = score_window(window)
    return AnomalyScore(
        pile_id=pile_id,
        is_anomaly=err > threshold,
        reconstruction_error=err,
        threshold=threshold,
        margin_ratio=err / threshold if threshold else float("inf"),
    )
