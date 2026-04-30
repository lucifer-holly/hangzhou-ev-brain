"""Evaluate the autoencoder on injected anomalies (F1)."""

from __future__ import annotations

import logging
from dataclasses import dataclass

import torch

from ai.anomaly_detection.data_loader import build_dataset
from ai.anomaly_detection.inference import _load

log = logging.getLogger("ai.anomaly_detection.evaluate")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@dataclass(frozen=True, slots=True)
class AeMetrics:
    f1: float
    precision: float
    recall: float
    threshold: float
    n_normal: int
    n_fault: int
    n_normal_eval: int


def evaluate() -> AeMetrics:
    ws = build_dataset()
    model, threshold = _load()
    if len(ws.fault_eval) == 0 or len(ws.normal_eval) == 0:
        return AeMetrics(
            f1=float("nan"),
            precision=float("nan"),
            recall=float("nan"),
            threshold=threshold,
            n_normal=int(len(ws.normal)),
            n_fault=0,
            n_normal_eval=int(len(ws.normal_eval)),
        )
    with torch.no_grad():
        fault_scores = model.reconstruction_error(torch.from_numpy(ws.fault_eval)).cpu().numpy()
        normal_scores = model.reconstruction_error(torch.from_numpy(ws.normal_eval)).cpu().numpy()
    tp = int((fault_scores > threshold).sum())
    fn = int((fault_scores <= threshold).sum())
    fp = int((normal_scores > threshold).sum())
    tn = int((normal_scores <= threshold).sum())
    precision = tp / max(1, tp + fp)
    recall = tp / max(1, tp + fn)
    f1 = 2 * precision * recall / max(1e-9, precision + recall)
    log.info(
        "TP=%d FP=%d TN=%d FN=%d → precision=%.3f recall=%.3f f1=%.3f",
        tp,
        fp,
        tn,
        fn,
        precision,
        recall,
        f1,
    )
    return AeMetrics(
        f1=float(f1),
        precision=float(precision),
        recall=float(recall),
        threshold=float(threshold),
        n_normal=int(len(ws.normal)),
        n_fault=int(len(ws.fault_eval)),
        n_normal_eval=int(len(ws.normal_eval)),
    )


if __name__ == "__main__":
    m = evaluate()
    print(f"F1: {m.f1:.4f}")
    print(f"Precision: {m.precision:.4f}")
    print(f"Recall: {m.recall:.4f}")
    print(f"Threshold: {m.threshold:.5f}")
