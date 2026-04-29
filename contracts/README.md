# `contracts/` — Spec-Driven Design

This directory is the **single source of truth** for every wire-format the
HZ-EV Brain platform exchanges:

- **`openapi.yaml`** — REST + WebSocket surface served by the cloud backend.
- **`asyncapi.yaml`** — MQTT topics exchanged between cloud and edge.
- **`operators/*.schema.json`** — heterogeneous data formats hypothetically
  exposed by the four real-world Hangzhou charging operators.

## Why a contracts folder?

> **"Code is the implementation; the contract is the API."**

In the real city, four operators (国网, 特来电, 星星充电, 蔚来) each ship a
slightly different API; one of the city-management platform's hardest jobs
is to **integrate these heterogeneous shapes into a unified data plane**.
The contracts folder demonstrates that integration as design artefacts:

1. Frontend, backend, and (later) operator-adapter modules all read these
   files instead of cross-importing each other's types.
2. Anyone reading the repo can understand the system *without running it* —
   open `openapi.yaml` and the API surface is right there.
3. When a real operator's API changes, only the matching `.schema.json`
   moves — the adapter is the only place that needs editing.

## File-by-file

### `openapi.yaml` (auto-generated)

OpenAPI 3.1 description of every REST endpoint + every WebSocket envelope
served by `backend/`.  It is regenerated from FastAPI's
`/openapi.json` route, so it can never drift from what the code actually
serves:

```bash
docker-compose up -d backend
curl -s http://localhost:8000/openapi.json | \
  python3 -c "import yaml,json,sys; \
              yaml.dump(json.load(sys.stdin), sys.stdout, \
                        allow_unicode=True, sort_keys=False)" \
  > contracts/openapi.yaml
```

Spawn 3 (frontend) will use this file as the input to a TypeScript
client generator (`openapi-typescript`, `orval`, or hand-rolled fetch
wrappers) — it MUST not write its own request/response types.

### `asyncapi.yaml` (hand-written)

AsyncAPI 2.6 description of the five MQTT channels:

| Channel | Direction | Used by |
| --- | --- | --- |
| `pile/{pile_id}/telemetry` | edge → cloud | Wokwi firmware (Spawn 8) → backend ingestion |
| `pile/{pile_id}/event`     | edge → cloud | Discrete state changes (faults, session start/end) |
| `pile/{pile_id}/command`   | cloud → edge | Power throttling, lock / unlock, reboot |
| `system/grid/alert`        | cloud → fleet | Function 3 — grid-pressure broadcast |
| `system/emergency/{event_id}` | cloud → region | Function 5 — region-scoped emergency directives |

Operations are described **from the cloud's point of view** —
`subscribe` means the cloud is the receiver.  Producers should send with
QoS 1; consumers MUST tolerate occasional duplicates.

### `operators/` — four heterogeneous JSON Schemas

A pure spec-design exercise: even though no real operator API is consumed
in the demo, having these four schemas in the repo:

- forces a unified internal model on the backend (no leaky abstractions),
- proves the project's authors understand why integration is hard,
- gives Spawn 3+ something realistic to target if anyone ever wires up a
  mock adapter chain.

Each file deliberately mirrors a *real* style of API published by the
corresponding company:

| Operator | Naming | Identity | Distinguishing field |
| --- | --- | --- | --- |
| **State Grid (`state-grid`)** | `snake_case` | `SG-12345678` | `region_grid_code`, `tariff_book_version`, `last_inspection_date_yyyy_mm_dd` |
| **TELD (`teld`)** | `camelCase` | UUID stationId | `pricing.peakHourMultiplier`, `session.userMaskedMobile` |
| **StarCharge (`starcharge`)** | `snake_case`, deeply nested | UUID pile + operator | `geo.geohash`, `metrics.estimated_remaining_minutes`, `network.rssi_dbm` |
| **NIO (`nio`)** | `camelCase` + 车端语境 | `NIO-AB123456` | `vehicleCompatibility[]`, `swapInventory.readyBatteryCount`, `currentSession.batterySoc` |

The four files are intentionally readable side-by-side: skim them and you
should immediately see "ah, four different teams' product cultures",
which is the lesson the city-management platform has to absorb.

## Validating the contracts

```bash
# Every YAML must parse:
python3 -c "import yaml; yaml.safe_load(open('contracts/openapi.yaml'))"
python3 -c "import yaml; yaml.safe_load(open('contracts/asyncapi.yaml'))"

# Every operator schema must be valid JSON:
for f in contracts/operators/*.schema.json; do
  python3 -c "import json; json.load(open('$f'))" && echo "ok $f"
done
```

The repo's CI (Spawn 9 will wire it) will run these checks plus a
`spectral lint` pass against the OpenAPI / AsyncAPI files.

## Real operator API references

These schemas are **mocks** — none of the operators publish a public,
machine-readable contract — but the styles are based on the public-facing
information that does exist:

- 国网充电桩 — see [https://www.95598.cn](https://www.95598.cn) (e-charge / 国网充电站
  service flavour, Chinese only).
- 特来电 — [https://www.teld.cn](https://www.teld.cn) (modern marketing site,
  developer docs are private).
- 星星充电 — [https://www.starcharge.com](https://www.starcharge.com) (open ecosystem
  positioning; some BD-only API specs leaked in industry whitepapers).
- 蔚来 Power — [https://power.nio.com](https://power.nio.com) (the only operator
  with a polished mobile SDK; vehicle / swap context shows up everywhere).

When integrating against any real operator API, the corresponding
`.schema.json` is the **only file** that should change — the rest of the
backend's adapter layer reads through this contract.

## What's intentionally NOT here

- ❌ Schemas for the AI-model HTTP endpoints — those are in OpenAPI under
  `/api/ai/*` once Spawn 4 ships them.
- ❌ Frontend-only types (component props, store shapes) — TS local concern.
- ❌ Wokwi pin-out / hardware schema — that lives in
  `firmware/pile-simulator/diagram.json` (Spawn 8).
- ❌ A runtime validator middleware — this is a demo; prod-grade contract
  enforcement at request time is out of scope (decision logged in
  `docs/spec.md` §13).
