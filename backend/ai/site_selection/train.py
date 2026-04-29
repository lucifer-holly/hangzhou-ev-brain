"""Train the XGBoost site-selection regressor and persist artifacts.

Pipeline:

1. Build a (~600, 12) training matrix from 100 real piles + 5 jittered
   replicas via :func:`feature_engineering.build_training_set`.
2. 80/20 train/test split.
3. Fit ``XGBRegressor`` with the spec-fixed hyperparameters.
4. Persist ``model.json`` (XGBoost native), ``shap_explainer.pkl``
   (TreeExplainer for fast inference-time SHAP), and a
   predicted-vs-actual scatter plot.
"""

from __future__ import annotations

import logging
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import shap
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

from ai.site_selection.feature_engineering import FEATURE_NAMES, build_training_set
from ai.site_selection.model import (
    EXPLAINER_PATH,
    MODEL_PATH,
    SAVED_DIR,
    TRAINING_PNG_PATH,
    make_regressor,
)

log = logging.getLogger("ai.site_selection.train")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def main() -> None:
    SAVED_DIR.mkdir(parents=True, exist_ok=True)
    log.info("building training set")
    X, y = build_training_set()
    log.info("training matrix: X=%s y=%s", X.shape, y.shape)

    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.20, random_state=42)
    model = make_regressor()
    log.info("fitting XGBoost: %d estimators × max_depth=%d", model.n_estimators, model.max_depth)
    model.fit(X_tr, y_tr)

    pred_te = np.clip(model.predict(X_te), 0.0, 1.0)
    r2 = r2_score(y_te, pred_te)
    mae = mean_absolute_error(y_te, pred_te)
    log.info("test set: R² = %.4f, MAE = %.4f, n_test = %d", r2, mae, len(y_te))

    log.info("saving model → %s", MODEL_PATH)
    model.save_model(str(MODEL_PATH))

    log.info("building SHAP TreeExplainer")
    explainer = shap.TreeExplainer(model)
    joblib.dump(explainer, EXPLAINER_PATH)
    log.info("explainer → %s", EXPLAINER_PATH)

    fig, ax = plt.subplots(figsize=(5.5, 5), dpi=110)
    ax.scatter(y_te, pred_te, alpha=0.6, edgecolor="white", linewidth=0.5)
    ax.plot([0, 1], [0, 1], "r--", linewidth=1)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_xlabel("Actual 30d avg occupancy")
    ax.set_ylabel("Predicted")
    ax.set_title(f"Site-selection XGBoost (R²={r2:.3f})")
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(TRAINING_PNG_PATH)
    plt.close(fig)
    log.info("scatter → %s", TRAINING_PNG_PATH)

    log.info("feature names: %s", list(FEATURE_NAMES))


if __name__ == "__main__":
    main()
