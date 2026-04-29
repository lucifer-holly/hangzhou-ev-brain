# `backend/ai/` — AI Models

Four sub-packages, one per model:

| Path | Model | Framework | Endpoint |
|---|---|---|---|
| [`lstm_demand/`](./lstm_demand/) | Hourly demand prediction | PyTorch | `POST /api/ai/predict/demand` |
| [`site_selection/`](./site_selection/) | Site-selection regressor + SHAP ⭐ | xgboost + shap | `POST /api/ai/predict/site` |
| [`anomaly_detection/`](./anomaly_detection/) | Per-pile autoencoder | PyTorch (+ ONNX export) | `GET /api/ai/anomaly/{pile_id}` |
| [`yolo_occupancy/`](./yolo_occupancy/) | YOLOv8 vehicle detection | Ultralytics (pretrained) | `POST /api/ai/yolo/detect` |

Plus [`eval/benchmark.py`](./eval/benchmark.py) — one command to print all four metrics.

## Reproducing the trained models

From the repo root:

```bash
./scripts/train_all_models.sh
```

This expects the SQLite DB to already be seeded (the FastAPI app does it on
first startup, or run `python -m db.seed`).  Each model writes its
artefacts into `<package>/saved/`.

The script runs single-threaded (`OMP_NUM_THREADS=1`) — see the comment in
[`eval/benchmark.py`](./eval/benchmark.py) for the OpenMP-conflict
backstory.

## Spec targets and current results

| Model | Target | Current |
|---|---|---|
| LSTM demand | MAE < 0.08 | **MAE 0.0428** |
| XGBoost site selection | R² > 0.85 | **R² 0.9424** |
| Autoencoder anomaly | F1 > 0.85 | **F1 0.9639** |
| YOLOv8 occupancy | smoke-test runs | ~50 ms / image |

Run `python -m ai.eval.benchmark` after training to refresh the numbers.

## What each FastAPI endpoint does

```bash
# 1. LSTM
curl -X POST http://localhost:8000/api/ai/predict/demand \
  -H 'Content-Type: application/json' \
  -d '{"pile_id": "<pile-id-from-db>", "hours_ahead": 1}'

# 2. XGBoost + SHAP
curl -X POST http://localhost:8000/api/ai/predict/site \
  -H 'Content-Type: application/json' \
  -d '{"lat":30.275,"lng":120.030,"pop_density_1km":12000,
       "poi_mall_count":5,"poi_office_count":25,"poi_residential_count":12,
       "existing_pile_count_1km":4,"avg_utilization_1km":0.32,
       "road_grade":3,"operator":"state_grid"}'

# 3. Autoencoder
curl http://localhost:8000/api/ai/anomaly/<pile-id-from-db>

# 4. YOLOv8
curl -X POST http://localhost:8000/api/ai/yolo/detect \
  -F "image=@backend/ai/yolo_occupancy/sample_images/sample_bus.jpg"
```
