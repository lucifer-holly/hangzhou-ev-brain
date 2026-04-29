# HZ-EV Brain — Backend (Spawn 1)

FastAPI service + 100% synthetic data generator + SQLite + Mosquitto MQTT.
This is the foundation that every other Spawn (frontend, AI models,
firmware, contracts) plugs into.

## What it provides

- A REST API at `http://localhost:8000` (Swagger UI at `/docs`).
- A WebSocket fan-out at `ws://localhost:8000/ws` that emits one frame per
  realtime tick (1 Hz by default).
- A SQLite database pre-seeded with **100 piles × 30 days of hourly history**
  plus injected fault and communication-loss events.
- A live ticker that updates each pile's "current" snapshot every second and
  broadcasts the update over the WebSocket.
- A Mosquitto broker container (started by `docker-compose`) that the Wokwi
  ESP32 firmware (Spawn 8) will publish to.

## Quick start

### Option A — Docker (recommended)

```bash
# from the repo root (one level up from backend/)
docker-compose up --build
```

Then in another shell:

```bash
curl -s http://localhost:8000/health
# {"status":"ok"}

curl -s http://localhost:8000/api/piles | jq length
# 100

open http://localhost:8000/docs        # Swagger UI
```

### Option B — local Python venv

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# seed the DB once
python -m db.seed

# run the server
uvicorn api.main:app --reload --port 8000
```

The dev server runs the realtime ticker too, so opening
`ws://localhost:8000/ws` (e.g. with `websocat` or the built-in Swagger UI's
WebSocket helper) will deliver one frame per second.

## Running tests

```bash
cd backend
source .venv/bin/activate
python -m pytest tests/ -v
```

The suite covers:

| File | What it pins |
| --- | --- |
| `tests/test_synth.py` | 4 operators, 60/40 region split, 100 piles, lat/lng in 杭州 box, capacity tiers, install-date window, demand-curve shape, Poisson fault counts. |
| `tests/test_health.py` | `/health` returns `{"status":"ok"}`, `/version` returns name+version. |
| `tests/test_piles.py` | All `/api/*` endpoints + `/openapi.json` shape, region/operator/status filters, 24h summary, telemetry rows. |

## API surface

| Method | Path | What it does |
| --- | --- | --- |
| `GET` | `/health` | Liveness — `{"status":"ok"}` |
| `GET` | `/version` | Name + version metadata |
| `GET` | `/api/piles?region=&operator=&status=` | List piles with current snapshot |
| `GET` | `/api/piles/{pile_id}` | Pile detail + 24-hour summary |
| `GET` | `/api/piles/{pile_id}/telemetry?from=&to=&limit=` | Historical telemetry |
| `GET` | `/api/operators` | 4 operators with pile counts |
| `GET` | `/api/regions` | 2 regions with pile counts |
| `GET` | `/api/events?type=&severity=&pile_id=&since=&limit=` | Event stream, newest first |
| `WS`  | `/ws` | Realtime telemetry + event push |

The full request/response shape lives in `api/schemas.py` — and FastAPI
auto-generates an OpenAPI 3 document at `/openapi.json` that Spawn 2 can
import wholesale into `contracts/openapi.yaml`.

### WebSocket envelope

```json
{
  "type": "telemetry" | "event" | "tick",
  "pile_id": "pile-001-…" | null,
  "timestamp": "2026-04-30T01:23:45+00:00",
  "data": { ... }
}
```

For `type: "telemetry"`, `data.piles` is a list of one snapshot per pile in
the fleet — sent as a single frame so 100 piles ≠ 100 socket writes.

## Synthetic data spec

| Knob | Default | Source of truth |
| --- | --- | --- |
| Pile count | 100 | `PILE_COUNT` env / `Settings` |
| FTC piles | 60 | `synth.geography.generate_pile_locations` |
| QTA piles | 40 | same |
| Operator share | 50/25/15/10 | `synth.operators.OPERATORS` |
| History | 30 days hourly | `HISTORY_DAYS` env |
| Realtime tick | 1.0 s | `REALTIME_TICK_SECONDS` env |
| Capacity tiers | 60/120/180/240 kW | `synth.geography._CAPACITY_TIERS` |
| Install window | 1–3 yr ago | `synth.geography.generate_pile_locations` |
| Faults / day | Poisson, λ=2 | `synth.failure_inject.inject_faults_for_day` |
| Comm loss | ~1 %/h, 5–30 min | `synth.failure_inject.sample_comm_losses` |
| RNG seed | 42 | `RNG_SEED` env |

### Demand curves (deterministic centre-line)

| Time | FTC | QTA |
| --- | --- | --- |
| Weekday 08:00 morning peak | ~0.70 | ~0.62 |
| Weekday 18:00 evening peak | ~0.85 | ~0.72 |
| Weekend 13:00 plateau | ~0.50 | ~0.50 |

Add Gaussian noise `σ=0.05` for the actual generated values, clipped to
`[0, 1]`.

## Layout

```
backend/
├── pyproject.toml         pip-installable, deps pinned to ranges
├── Dockerfile             python:3.11-slim
├── api/
│   ├── main.py            FastAPI factory + lifespan
│   ├── config.py          Pydantic Settings, .env-driven
│   ├── database.py        sync + async engines / sessions
│   ├── models.py          SQLAlchemy ORM (Operator/Region/Pile/Telemetry/Event)
│   ├── schemas.py         Pydantic v2 request/response models
│   ├── deps.py            FastAPI dependencies
│   ├── ws.py              WebSocket manager + /ws endpoint
│   ├── realtime.py        Background ticker (snapshot updates + broadcast)
│   └── routers/
│       ├── health.py
│       ├── piles.py
│       ├── operators.py
│       ├── regions.py
│       └── events.py
├── synth/
│   ├── operators.py       4 operator metadata + pile allocation
│   ├── geography.py       Pile placement around 杭州
│   ├── demand_model.py    Time-of-day occupancy curves
│   ├── failure_inject.py  Poisson fault + comm-loss sampling
│   └── generator.py       History bundle + per-tick generator
├── db/
│   └── seed.py            Idempotent seed: tables + 30d history + events
├── tests/                 pytest + httpx integration suite
└── scripts/
    └── reset_db.sh        Drop & re-seed
```

## Idempotency

`db/seed.py` checks if the `piles` table already has `PILE_COUNT` rows and
no-ops if so.  To force a fresh seed:

```bash
python -m db.seed --force
# or
./scripts/reset_db.sh
# or, in docker:
docker-compose run --rm backend python -m db.seed --force
```

## What this layer does NOT do

- ❌ No real operator API integration (synthetic only).
- ❌ No auth / HTTPS / rate limiting.
- ❌ No Wokwi firmware (Spawn 8 — only the broker is here).

## AI endpoints (Spawn 4)

The 4 AI models live under [`backend/ai/`](./ai/) and are exposed under
`/api/ai`.  See [`ai/README.md`](./ai/README.md) for full details and
training instructions.

| Method | Path | Model |
| --- | --- | --- |
| `POST` | `/api/ai/predict/demand` | LSTM hourly demand prediction |
| `POST` | `/api/ai/predict/site` | XGBoost + SHAP site selection |
| `GET`  | `/api/ai/anomaly/{pile_id}` | Autoencoder reconstruction error |
| `POST` | `/api/ai/yolo/detect` | YOLOv8 vehicle detection (image upload) |

To train all three trainable models from a clean checkout:

```bash
./scripts/train_all_models.sh
```

(YOLO uses Ultralytics' pretrained `yolov8n.pt` and is downloaded on
demand at first inference.)

## Troubleshooting

- **`ValueError: the greenlet library is required`** — re-install deps
  (`pip install -e ".[dev]"`); SQLAlchemy's async engine needs `greenlet`.
- **`/api/piles` returns `[]`** — the seed didn't run.  Check container logs
  for `seed: inserted 100 piles` or run `python -m db.seed --force`.
- **WebSocket disconnects immediately** — the realtime ticker only starts
  once the lifespan event fires, which means the seed must finish first.
  Check that the DB seed log line appears before connecting.
