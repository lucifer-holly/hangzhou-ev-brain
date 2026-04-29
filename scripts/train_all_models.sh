#!/usr/bin/env bash
# Reproducibly train the 3 trainable AI models.  YOLO uses Ultralytics'
# pretrained yolov8n.pt and is downloaded on demand at inference time, so
# it doesn't need a training pass.
#
# Prerequisite: the synthetic SQLite DB must already be seeded.  Run
# ``python -m db.seed`` once if you haven't (the FastAPI app does this on
# startup when the file is missing).
#
# Run from the repo root:
#
#     ./scripts/train_all_models.sh

set -euo pipefail
cd "$(dirname "$0")/.."

# Cap OpenMP threads — see backend/ai/eval/benchmark.py for the why.
export OMP_NUM_THREADS=1
export MKL_NUM_THREADS=1
export OPENBLAS_NUM_THREADS=1

VENV="backend/.venv/bin/activate"
if [[ -f "$VENV" ]]; then
  # shellcheck disable=SC1090
  source "$VENV"
fi
cd backend

if [[ ! -f data/hzev.db ]]; then
  echo "==> seeding SQLite DB (no existing data found)"
  python -m db.seed
fi

echo "==> 1/3  Training LSTM demand model"
python -m ai.lstm_demand.train

echo "==> 2/3  Training XGBoost site-selection model"
python -m ai.site_selection.train

echo "==> 3/3  Training Autoencoder anomaly model"
python -m ai.anomaly_detection.train

echo "==> Exporting Autoencoder to ONNX (Edge consumer = Spawn 8)"
python -m ai.anomaly_detection.quantize_tflite || echo "(ONNX/INT8 export non-critical, see backend/ai/anomaly_detection/README.md)"

echo
echo "==> All trainable models done.  YOLO uses Ultralytics' pretrained yolov8n.pt."
echo "==> Run benchmark:"
echo "    python -m ai.eval.benchmark"
