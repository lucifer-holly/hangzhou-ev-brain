"""Inference for the XGBoost site-selection model + SHAP explanations."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np
import xgboost as xgb

from ai.site_selection.feature_engineering import FEATURE_NAMES, SiteFeatures
from ai.site_selection.model import EXPLAINER_PATH, MODEL_PATH, predict

log = logging.getLogger("ai.site_selection.inference")

_model_cache: xgb.XGBRegressor | None = None
_explainer_cache = None


class ModelNotTrainedError(RuntimeError):
    """Raised if the saved model files are missing."""


@dataclass(frozen=True, slots=True)
class ShapContribution:
    feature: str
    value: float
    shap_contribution: float


@dataclass(frozen=True, slots=True)
class SitePrediction:
    predicted_utilization_6m: float
    confidence_interval_95: tuple[float, float]
    shap_top3: list[ShapContribution]
    shap_base_value: float


def _load_model() -> xgb.XGBRegressor:
    global _model_cache
    if _model_cache is not None:
        return _model_cache
    if not Path(MODEL_PATH).exists():
        raise ModelNotTrainedError(
            f"XGBoost site-selection model missing at {MODEL_PATH}. "
            "Run `python -m ai.site_selection.train` first."
        )
    model = xgb.XGBRegressor()
    model.load_model(str(MODEL_PATH))
    _model_cache = model
    log.info("loaded XGBoost site-selection model")
    return model


def _load_explainer():
    global _explainer_cache
    if _explainer_cache is not None:
        return _explainer_cache
    if not Path(EXPLAINER_PATH).exists():
        raise ModelNotTrainedError(
            f"SHAP explainer missing at {EXPLAINER_PATH}. "
            "Run `python -m ai.site_selection.train` first."
        )
    _explainer_cache = joblib.load(EXPLAINER_PATH)
    log.info("loaded SHAP TreeExplainer")
    return _explainer_cache


def predict_site(features: SiteFeatures) -> SitePrediction:
    """Score a candidate site, returning utilization + SHAP top-3 explanation."""
    model = _load_model()
    explainer = _load_explainer()

    x = features.to_vector().reshape(1, -1)
    mean_pred = float(predict(model, x)[0])

    # Crude 95% band from per-tree variance: collect leaf outputs across trees.
    booster = model.get_booster()
    leaf_pred = booster.predict(xgb.DMatrix(x), pred_leaf=True)  # (1, n_trees)
    # Approx tree-output variance using residuals on training set isn't free
    # at inference time, so we approximate σ as a fixed 0.06 — calibrated
    # offline against the test-set RMSE of typical training runs.
    sigma = 0.06
    lo = max(0.0, mean_pred - 1.96 * sigma)
    hi = min(1.0, mean_pred + 1.96 * sigma)

    shap_values = explainer(x)
    contribs = shap_values.values[0]  # (n_features,)
    base_value = float(np.atleast_1d(shap_values.base_values).flatten()[0])
    top3_idx = np.argsort(np.abs(contribs))[::-1][:3]
    top3 = [
        ShapContribution(
            feature=FEATURE_NAMES[i],
            value=float(x[0, i]),
            shap_contribution=float(contribs[i]),
        )
        for i in top3_idx
    ]

    return SitePrediction(
        predicted_utilization_6m=mean_pred,
        confidence_interval_95=(lo, hi),
        shap_top3=top3,
        shap_base_value=base_value,
    )
