"""End-to-end benchmark for the 4 AI models.

Runs the LSTM, XGBoost and Autoencoder evaluation scripts in sequence and
prints a table of metrics with PASS/FAIL against the spec targets.  YOLO
isn't trained so we instead measure inference latency on the bundled
sample image.

Targets (spec §7 / AI model brief):

    LSTM         : MAE  < 0.08
    XGBoost      : R²   > 0.85
    Autoencoder  : F1   > 0.85
    YOLO         : (smoke check) >0 inferences/sec
"""

from __future__ import annotations

import os

# Mixing PyTorch + XGBoost + ONNXRuntime in the same process on Apple Silicon
# segfaults intermittently when the OpenMP thread pools collide.  Forcing a
# single thread per library makes the benchmark deterministic; the eval is
# small enough that single-threaded runs are still seconds-long.
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")

import logging
import time
from dataclasses import dataclass
from pathlib import Path

log = logging.getLogger("ai.eval.benchmark")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

_LSTM_TARGET_MAE = 0.08
_XGB_TARGET_R2 = 0.85
_AE_TARGET_F1 = 0.85


@dataclass(frozen=True, slots=True)
class _Row:
    name: str
    metric: str
    value: float
    target: str
    passed: bool


def _bench_lstm() -> _Row:
    from ai.lstm_demand.evaluate import evaluate

    m = evaluate()
    return _Row(
        name="LSTM demand",
        metric=f"MAE={m.mae:.4f} RMSE={m.rmse:.4f} MAPE={m.mape:.4f}",
        value=m.mae,
        target=f"MAE < {_LSTM_TARGET_MAE}",
        passed=m.mae < _LSTM_TARGET_MAE,
    )


def _bench_xgb() -> _Row:
    from ai.site_selection.evaluate import evaluate

    m = evaluate()
    return _Row(
        name="XGBoost site",
        metric=f"R²={m.r2:.4f} MAE={m.mae:.4f}",
        value=m.r2,
        target=f"R² > {_XGB_TARGET_R2}",
        passed=m.r2 > _XGB_TARGET_R2,
    )


def _bench_ae() -> _Row:
    from ai.anomaly_detection.evaluate import evaluate

    m = evaluate()
    return _Row(
        name="Autoencoder",
        metric=f"F1={m.f1:.4f} P={m.precision:.4f} R={m.recall:.4f} thr={m.threshold:.4f}",
        value=m.f1,
        target=f"F1 > {_AE_TARGET_F1}",
        passed=m.f1 > _AE_TARGET_F1,
    )


def _bench_yolo() -> _Row:
    from ai.yolo_occupancy.inference import detect_image

    sample_dir = Path(__file__).parent.parent / "yolo_occupancy" / "sample_images"
    candidates = list(sample_dir.glob("*.jpg")) + list(sample_dir.glob("*.png"))
    if not candidates:
        return _Row("YOLOv8", "no sample image", value=0.0, target="N/A", passed=False)
    img = candidates[0]
    t0 = time.perf_counter()
    res = detect_image(img)
    elapsed = time.perf_counter() - t0
    return _Row(
        name="YOLOv8",
        metric=f"detect={res.vehicle_count} infer_ms={res.inference_ms:.1f} sample={img.name}",
        value=elapsed,
        target="runs",
        passed=True,
    )


def run() -> list[_Row]:
    rows: list[_Row] = []
    log.info("=== AI MODEL BENCHMARK ===")
    rows.append(_bench_lstm())
    rows.append(_bench_xgb())
    rows.append(_bench_ae())
    rows.append(_bench_yolo())
    return rows


def _print_report(rows: list[_Row]) -> bool:
    width = max(len(r.name) for r in rows) + 2
    all_pass = True
    print()
    print(f"{'Model':{width}}  {'Target':<22}  Metric")
    print("-" * (width + 70))
    for r in rows:
        status = "PASS" if r.passed else "FAIL"
        if not r.passed:
            all_pass = False
        print(f"{r.name:{width}}  {r.target:<22}  {r.metric}  [{status}]")
    print("-" * (width + 70))
    print("Overall:", "PASS" if all_pass else "FAIL")
    return all_pass


if __name__ == "__main__":
    rows = run()
    ok = _print_report(rows)
    raise SystemExit(0 if ok else 1)
