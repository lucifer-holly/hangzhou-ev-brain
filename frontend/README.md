# HZ-EV Brain · Frontend

React + TypeScript + Vite scaffold for the **HZ-EV Brain** synthetic city
charging-network demo (杭州智慧充电城市大脑). This package houses three
interfaces:

- **City Console** (`/city`) — IOC dark big-screen + 6 governance pages
- **Operator Dashboard** (`/operator`) — light SaaS theme
- **Driver App** (`/driver`) — mobile-first light SaaS theme

> **Spawn 3 status (this commit):** foundation only. The placeholder
> `/city` home screen verifies design tokens + REST + WebSocket. Spawns
> 5/6/7 fill in the actual screens.

---

## Quick start (local dev)

```bash
# 1. Install deps (uses pnpm; see package.json for the pinned version).
cd frontend
pnpm install

# 2. Generate the typed API client from the OpenAPI source of truth.
pnpm run codegen
# → writes src/types/api.ts (do NOT hand-edit — re-run when contracts change)

# 3. Start the backend in another terminal.
cd ..
docker-compose up -d backend mosquitto
# wait for /health → ok

# 4. Start the dev server.
cd frontend
pnpm dev
# → http://localhost:5173
```

Vite proxies `/api/*` and `/ws` to `http://localhost:8000` so you don't
hit any CORS during development. In Docker the frontend container talks
to the backend by service name (`backend:8000`).

---

## Directory map

```
frontend/
├── public/                 static assets served as-is
├── src/
│   ├── main.tsx            entry; QueryClientProvider + BrowserRouter
│   ├── App.tsx             route table
│   ├── index.css           Tailwind base + IOC clip-path / glow utilities
│   ├── design-tokens/      single source of truth for colors / fonts / motion
│   ├── lib/                framework-agnostic helpers (axios, ws manager, env, cn)
│   ├── components/
│   │   ├── ui/             shadcn primitives (Button, Card, Badge, …)
│   │   ├── ioc/            dark big-screen visuals (TechBorder, KpiCard, …)
│   │   ├── map/            MapProvider abstraction (AMap | OSM)
│   │   └── charts/         echarts wrappers (filled in by Spawn 5+)
│   ├── pages/
│   │   ├── city-console/   IOC Layout + Home + 6 detail placeholders
│   │   ├── operator/       Operator Dashboard placeholder
│   │   └── driver/         Driver App placeholder
│   ├── hooks/              react-query + WebSocket hooks
│   ├── stores/             zustand stores (filled in by feature spawns)
│   ├── api/                domain API modules (piles, operators, events, ws)
│   └── types/api.ts        ✱ generated ✱ — see `pnpm run codegen`
├── Dockerfile              multi-stage: pnpm build → nginx serve
├── nginx.conf              SPA fallback + gzip + asset caching
├── tailwind.config.ts      mirrors design-tokens into utility classes
├── components.json         shadcn config (so `npx shadcn add` keeps working)
└── vite.config.ts          dev proxy to localhost:8000
```

---

## Design tokens

Two coherent palettes, both declared in
`src/design-tokens/colors.ts` and mirrored into Tailwind so most code
just uses utility classes:

- `bg-ioc-deep`, `text-ioc-cyan`, `text-glow-cyan`, `shadow-ioc-glow`,
  `bg-ioc-radial`, `border-ioc-border` — IOC dark.
- `bg-saas-bg`, `text-saas-text-dark`, `border-saas-border`,
  `text-saas-accent` — SaaS light.

```tsx
import { ioc, pileStatusColor } from '@/design-tokens'

<div className="bg-ioc-radial text-ioc-text-primary">
  <h1 className="font-title uppercase tracking-[0.25em] text-glow-cyan">
    HZ-EV Brain
  </h1>
</div>
```

Visual decoration utilities live in `src/index.css` (`clip-tech`,
`text-glow-*`) and as Tailwind keyframes (`animate-pulse-ring`,
`animate-scan-line`).

---

## Map provider

`<MapProvider>` switches at runtime between AMap (高德) and OpenStreetMap
based on `VITE_MAP_PROVIDER`:

| provider | needs key | best for | file |
| --- | --- | --- | --- |
| `amap` | `VITE_AMAP_KEY` | demo against Hangzhou | `components/map/AMapMap.tsx` |
| `osm` | none | CI / fallback | `components/map/OSMMap.tsx` |

```tsx
import { MapProvider, HZ_CENTER } from '@/components/map/MapProvider'

<MapProvider
  center={HZ_CENTER}
  markers={piles.map(p => ({ id: p.id, lat: p.lat, lng: p.lng, status: p.current_status }))}
  onMarkerClick={(m) => navigate(`/city/piles/${m.id}`)}
  theme="dark"
/>
```

### Configuring AMap

1. Apply for a JS API 2.0 key at <https://lbs.amap.com/>.
2. Copy `.env.example` to `.env` and set:
   ```
   VITE_MAP_PROVIDER=amap
   VITE_AMAP_KEY=<your-key>
   ```
3. Restart `pnpm dev`.

If `VITE_AMAP_KEY` is missing while `VITE_MAP_PROVIDER=amap`, the AMap
component renders a friendly warning instead of crashing, so the rest
of the app keeps working.

---

## API + WebSocket plumbing

- `src/lib/api.ts` — shared axios instance honoring `VITE_API_BASE_URL`.
  Domain modules in `src/api/*.ts` build typed wrappers.
- `src/lib/websocket.ts` — `WsManager` with exponential-backoff reconnect.
  `src/api/ws.ts` exposes a singleton.
- `src/hooks/useWebSocket.ts` — projects the wire-format frames
  documented in `backend/api/realtime.py` (aggregated 1-Hz telemetry +
  per-event messages) into a per-pile dictionary plus a 50-event ring buffer.
- `src/hooks/usePiles.ts` / `useOperators.ts` / `useEvents.ts` —
  react-query wrappers around the typed REST clients.

When the OpenAPI spec changes (e.g. Spawn 4 adds AI endpoints), re-run
`pnpm run codegen` to refresh `src/types/api.ts`. **Don't hand-edit it.**

---

## Backend integration

The placeholder home page (`pages/city-console/Home.tsx`) makes one of
each call so a fresh checkout proves end-to-end connectivity:

| concern | call | shows |
| --- | --- | --- |
| REST | `GET /api/piles` | total pile count + map markers |
| REST | `GET /api/operators` | sidebar list |
| REST | `GET /api/events?limit=25` | alert KPI |
| WS | `ws://…/ws` | live `Realtime · 实时` indicator |

Common gotchas:

- `pnpm dev` proxies `/ws` over the Vite dev server; in production
  nginx does not, so Docker users must set `VITE_WS_URL` to point
  directly at the backend.
- Vite reads env vars at **build time**. After editing `.env`,
  restart the dev server.

---

## Scripts

```bash
pnpm dev       # vite dev server (HMR)
pnpm build     # tsc -b + vite build → dist/
pnpm preview   # serve the built bundle
pnpm codegen   # ../contracts/openapi.yaml → src/types/api.ts
pnpm lint      # eslint
pnpm format    # prettier
```

---

## Out of scope for this package

- Auth / RBAC — every route is open. Spawn 7 may revisit for the
  driver flow.
- Real charts — Spawn 5+ wires up echarts.
- 6 governance pages — currently `<PlaceholderPage>` stubs that
  document what each one will look like.
