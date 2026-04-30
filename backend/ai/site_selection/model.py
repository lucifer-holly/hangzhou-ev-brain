"""Model wrappers and constants for the site-selection XGBoost model."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import xgboost as xgb

SAVED_DIR = Path(__file__).parent / "saved"
MODEL_PATH = SAVED_DIR / "model.json"
EXPLAINER_PATH = SAVED_DIR / "shap_explainer.pkl"
TRAINING_PNG_PATH = SAVED_DIR / "predicted_vs_actual.png"

# XGBoost params (site-selection brief — kept fixed, no HPO).
XGB_PARAMS: dict = {
    "n_estimators": 100,
    "max_depth": 6,
    "learning_rate": 0.1,
    "objective": "reg:squarederror",
    "random_state": 42,
    "tree_method": "hist",
}


def make_regressor() -> xgb.XGBRegressor:
    return xgb.XGBRegressor(**XGB_PARAMS)


def predict(model: xgb.XGBRegressor, X: np.ndarray) -> np.ndarray:
    """Return a 1-D array of predicted utilizations clipped to [0, 1]."""
    pred = model.predict(X)
    return np.clip(pred, 0.0, 1.0)
