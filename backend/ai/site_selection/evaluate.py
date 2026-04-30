"""Evaluate the XGBoost site-selection model on the held-out 20 % split.

Re-uses the same seeded split that ``train.py`` produces so the report
matches the value printed during training.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

from ai.site_selection.feature_engineering import build_training_set
from ai.site_selection.inference import _load_model
from ai.site_selection.model import predict

log = logging.getLogger("ai.site_selection.evaluate")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@dataclass(frozen=True, slots=True)
class XgbMetrics:
    r2: float
    mae: float
    n_samples: int


def evaluate() -> XgbMetrics:
    X, y = build_training_set()
    _, X_te, _, y_te = train_test_split(X, y, test_size=0.20, random_state=42)
    model = _load_model()
    pred = predict(model, X_te)
    return XgbMetrics(
        r2=float(r2_score(y_te, pred)),
        mae=float(mean_absolute_error(y_te, pred)),
        n_samples=int(len(y_te)),
    )


if __name__ == "__main__":
    m = evaluate()
    log.info("XGBoost test metrics: R²=%.4f MAE=%.4f n=%d", m.r2, m.mae, m.n_samples)
    print(f"R²: {m.r2:.4f}")
    print(f"MAE: {m.mae:.4f}")
