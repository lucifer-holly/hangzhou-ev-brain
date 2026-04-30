# Design System · 视觉设计系统

> Reference for the visual language of HZ-EV Brain. Documents the
> tokens, components, motion, and decorative utilities that the
> three consoles share, plus the design lineage we drew on.
>
> The single source of truth in code lives in
> [`frontend/src/design-tokens/`](../frontend/src/design-tokens/) (TS
> tokens), mirrored into Tailwind utility classes via
> [`frontend/tailwind.config.ts`](../frontend/tailwind.config.ts).

---

## 1. Two coherent palettes — one project

The platform has a deliberate **dark/light dual-mode** identity:

- **IOC** (Intelligent Operations Center) — the dark, big-screen,
  glow-laden look used for the City Console home page. This is the
  *theatre* of the project — the page recruiters see first.
- **SaaS** — a clean, light, dashboard look used for the six City
  Console *detail* pages, plus the entire Operator and Driver
  consoles.

The split mirrors the spec's intent ([`docs/spec.md`](./spec.md) §5.3):
*"first impression must look like a city control room; once the user
drills in, the workflows must look like the SaaS dashboards they actually
work with day-to-day."*

### 1.1 Color tokens

```ts
// frontend/src/design-tokens/colors.ts
export const ioc = {
  bg:     { deep: '#0A0E1A', panel: 'rgba(20,30,60,0.7)',
            panelSolid: '#141E3C' },
  gradient: { home: 'radial-gradient(circle at 20% 30%, #1A2238 0%, #0A0E1A 70%)' },
  border:   { tech: 'rgba(0,212,255,0.3)' },
  accent:   { cyan: '#00D4FF', blue: '#4A9EFF' },
  status:   { warning: '#FFB800', danger: '#FF6B35', success: '#00FF94' },
  text:     { primary: '#FFFFFF', secondary: '#A0B0CC', muted: '#5A6680' },
}

export const saas = {
  bg:     { primary: '#FFFFFF', alt: '#F8FAFC' },
  border: '#E2E8F0',
  accent: '#2563EB',
  text:   { dark: '#0F172A', mid: '#475569', light: '#94A3B8' },
}
```

| Role | IOC dark | SaaS light | Tailwind utility |
|---|---|---|---|
| Primary surface | `#0A0E1A` | `#FFFFFF` | `bg-ioc-deep` / `bg-saas-bg` |
| Secondary surface | `rgba(20,30,60,0.7)` | `#F8FAFC` | `bg-ioc-panel` / `bg-saas-bg-alt` |
| Accent (data + CTA) | `#00D4FF` cyan | `#2563EB` blue | `text-ioc-cyan` / `text-saas-accent` |
| Secondary accent | `#4A9EFF` | — | `text-ioc-blue` |
| Success | `#00FF94` | inherit IOC | `text-ioc-success` |
| Warning | `#FFB800` | inherit IOC | `text-ioc-warning` |
| Danger | `#FF6B35` | inherit IOC | `text-ioc-danger` |
| Body text | `#FFFFFF` | `#0F172A` | `text-ioc-text-primary` / `text-saas-text-dark` |
| Muted text | `#A0B0CC` | `#475569` | `text-ioc-text-secondary` / `text-saas-text-mid` |
| Border | `rgba(0,212,255,0.3)` | `#E2E8F0` | `border-ioc-border` / `border-saas-border` |

### 1.2 Pile status → color (unified)

Both palettes share the same map-marker semantic colors, drawn from
the IOC accent system so the dark big-screen reads correctly:

| Status | Color | Token |
|---|---|---|
| `idle` | green `#00FF94` | `pileStatusColor.idle` |
| `charging` | cyan `#00D4FF` | `pileStatusColor.charging` |
| `occupied` | yellow `#FFB800` | `pileStatusColor.occupied` |
| `fault` | orange-red `#FF6B35` | `pileStatusColor.fault` |
| `offline` | muted `#5A6680` | `pileStatusColor.offline` |

### 1.3 Operator brand colors

The four operators each have a brand color used in donut charts,
ratio bars, and operator chips:

| Operator | Brand color | Notes |
|---|---|---|
| 国家电网 (State Grid) | `#2563EB` blue | Aligns with State Grid's printed brand. |
| 特来电 (TELD) | `#FF6B35` orange | TELD uses an orange-red identity. |
| 星星充电 (StarCharge) | `#FFB800` gold | "Star" → gold. |
| 蔚来 (NIO) | `#00D4FF` cyan | NIO's signature electric blue. |

These are pinned in [`backend/synth/operators.py`](../backend/synth/operators.py)
and surfaced through `/api/operators` so the frontend never hard-codes
them — change the backend, the frontend follows.

---

## 2. Typography

### 2.1 Three font roles

```ts
// frontend/src/design-tokens/typography.ts
fontFamily = {
  display: '"Geist Variable", "Noto Sans SC", PingFang SC, …',
  body:    '"Geist Variable", "Noto Sans SC", PingFang SC, …',
  mono:    '"Geist Mono Variable", "JetBrains Mono", ui-monospace, …',
}
```

| Role | Family | Used for |
|---|---|---|
| `display` | Geist Variable + Noto Sans SC fallback | KPI numbers, page titles, hero headlines |
| `body` | Geist Variable + Noto Sans SC | UI text, labels, card content |
| `mono` | Geist Mono Variable | telemetry values, pile IDs, code, timestamps |

The Geist + Noto Sans SC pairing is the **one strategic choice** here:
both families share the same x-height and stroke contrast, so EN and ZH
text harmonize when mixed in the same line. This matters for City Console
pages that show "在线桩 / Online piles" badges, where mismatched
x-heights would jar the eye.

All three fonts ship as **self-hosted variables** via `@fontsource-variable`
(see `frontend/package.json`). No Google CDN call at runtime — the demo
works offline.

### 2.2 Type scale

```ts
fontSize = {
  kpi:     '2.75rem',     // big screen KPI numbers
  h1:      '2rem',
  h2:      '1.5rem',
  h3:      '1.25rem',
  body:    '0.9375rem',
  small:   '0.8125rem',
  caption: '0.6875rem',
}
```

The `kpi` size is the project's **identity number** — it lands a
44 px figure on a desktop, large enough that an IOC big-screen sees the
KPI strip from across a meeting room without leaning forward.

### 2.3 Spacing & layout

We do not depart from Tailwind's default spacing scale (4 px base).
The container utility is centered with `padding: 1rem` so detail pages
sit naturally in 1280-1600 px viewports while the IOC home grows to fill
2560 px ultra-wide displays.

---

## 3. Components

The component tree splits into three buckets:

```
frontend/src/components/
├── ui/                shadcn primitives (Button, Card, Badge, Tabs, …)
├── ioc/               IOC dark big-screen visuals
│    ├── TechBorder.tsx
│    ├── KpiCard.tsx
│    ├── PulseDot.tsx
│    ├── ScanLine.tsx
│    ├── EventStream.tsx + LiveEventStream.tsx
│    ├── BottomChartStrip.tsx
│    ├── ModeSwitch.tsx + RoleSwitcher.tsx
│    ├── LiveClock.tsx + WeatherBadge.tsx
│    └── PulseDot.tsx
├── map/               MapProvider abstraction (AMap | OSM)
│    ├── MapProvider.tsx · CityMap.tsx · SiteMap.tsx
│    ├── AMapMap.tsx · AMapCityMap.tsx · AMapSiteMap.tsx
│    ├── OSMMap.tsx · OSMCityMap.tsx · OSMSiteMap.tsx
│    └── landmarks.tsx · regions.ts · types.ts
├── charts/            ECharts wrappers (per-page, lazy)
├── sidebar/           IOC sidebar panels (TodayPanel, TechStackPanel)
├── driver/            Driver-app specific widgets
└── operator/          Operator-dashboard specific widgets
```

### 3.1 IOC dark — five workhorse components

| Component | Job |
|---|---|
| `<TechBorder>` | Wraps any rectangular surface in a chamfered cyber-aesthetic border. Uses CSS `clip-path` (no extra DOM) — see `.clip-tech` utility in `index.css`. |
| `<KpiCard>` | The big animated counter. Uses `react-countup` for the rolling-digit effect; the tone prop selects cyan / success / warning / danger glow. |
| `<PulseDot>` | A pile-status dot with the pulsing ring animation. The ring is a child element animated by the `animate-pulse-ring` keyframe defined in Tailwind. |
| `<ScanLine>` | Horizontal cyan sweep that crosses the screen every 6 s. Layered above the map with `z-index: 1` and `pointer-events: none` so it never blocks clicks. |
| `<LiveEventStream>` | The right-panel scrolling event feed. Auto-scrolls newest-first; pauses on hover; events fade in via Framer Motion. |

### 3.2 SaaS light — shadcn primitives all the way

The detail pages use shadcn/ui primitives directly, with the SaaS palette
plumbed through Tailwind. The component set is intentionally minimal:

`Button` · `Card` · `Badge` · `Tabs` · `Tooltip` · `Dialog` · `DropdownMenu`
· `ScrollArea` · `Separator` · `Label`

We have **never added a new shadcn primitive without first checking
the existing ones**, which keeps the bundle lean (gzipped vendor JS
under 200 KB).

### 3.3 Charts — ECharts via `echarts-for-react`

Charts are configured per-page (no shared chart registry yet — that's a
follow-up task once we have ≥ 3 instances of the same chart shape).
Common patterns:

- **Dark theme on IOC home**: pinned cyan / blue / orange operator
  series; transparent panel background with `rgba(0, 212, 255, 0.06)`
  axis ticks.
- **Light theme on detail pages**: pinned `#2563EB` accent; subtle
  `#E2E8F0` grid; readable on white.

### 3.4 The map abstraction

```ts
<MapProvider>      // routes AMap | OSM at runtime
<CityMap>          // 100-pile fleet view with status halos + region polygons
<SiteMap>          // candidate-pin selector for site-selection page
```

The provider switches based on `VITE_MAP_PROVIDER` (`amap` or `osm`).
The OSM path uses React-Leaflet; the AMap path uses
`@amap/amap-jsapi-loader`. Both implement the same set of marker / event
props from `types.ts`, so pages never have to branch on provider.

---

## 4. Motion design

```ts
// frontend/src/design-tokens/animations.ts
duration = { fast: 0.18, base: 0.32, slow: 0.6, pulse: 1.6, scan: 6 }
easing   = {
  smooth: [0.215, 0.61, 0.355, 1],
  enter:  [0.0, 0.0, 0.2, 1],
  exit:   [0.4, 0.0, 1.0, 1],
}
```

Three named systems:

1. **Pulse rings** on map markers (`animate-pulse-ring`, 1.6 s loop).
   The ring scales from 0.8 → 2.4 while fading out. Severity-tied tones.
2. **Scan line** across the map (`animate-scan-line`, 6 s linear).
   Adds the IOC big-screen "active surveillance" feel. The line is
   `2 px` of `#00D4FF` with low opacity and `mix-blend-mode: screen`.
3. **Marquee** for the event stream (`animate-marquee`, 30 s linear).
   Vertical slow scroll; pauses on hover via Framer Motion.

Page transitions and skeletons are handled by Framer Motion using the
`easing.smooth` curve. The first-paint splash screen has its own
`splash-*` keyframes in `index.css` (logo zoom-in, scan sweep, fade-up
tagline) — Spawn 9.5/C documents the choreography.

---

## 5. Visual decoration utilities

These live in [`frontend/src/index.css`](../frontend/src/index.css) so any
component can opt in without props:

| Utility | Effect |
|---|---|
| `.clip-tech` | 14 px chamfered top-left + bottom-right corners (CSS clip-path). |
| `.text-glow-cyan` | Cyan text shadow, 8 px + 16 px halo. |
| `.text-glow-success` / `warning` / `danger` | Same with status palette. |
| `.bg-ioc-circuit` | Subtle inline-SVG circuit-trace pattern; layers under any IOC dark surface via `::before`. |
| `.hover-lift` | -2 px Y on hover, 0.15 s ease. |
| `.hover-glow` | Cyan glow on hover. |
| `.btn-press` | 0.97× scale on `:active`. |

The **circuit trace** background (`.bg-ioc-circuit`) is the single most
recognizable design choice — it gives the IOC home a "this is
infrastructure" texture without being noisy. The inline SVG is small
enough that it adds &lt; 0.5 KB to the CSS bundle.

The **chamfered corner** (`.clip-tech`) is the other identity element.
Every IOC dark surface uses it; every SaaS light surface uses square
corners. This creates an immediate visual signal that "you have moved
from theatre into workflow" when a user clicks from IOC home into a
detail page.

---

## 6. AMap dark-theme contrast fix

A non-trivial design call: **AMap's default attribution** ("高德地图"
logo + "© 2026 AutoNavi" text) is dark-on-white. On our IOC dark
surface the credit becomes near-invisible, which (a) violates Amap's
attribution license and (b) looks like a bug.

The fix lives outside `@layer` in `index.css` (so Tailwind doesn't
purge the runtime-injected classes). It:

- Wraps the credit in a `rgba(10, 14, 26, 0.7)` glass chip with
  `backdrop-filter: blur(4px)`.
- Recolors the copyright text to `rgba(160, 176, 204, 0.92)` —
  matching `text-ioc-text-secondary`.
- Inverts the rasterised AMap logo PNG with `invert(1) hue-rotate(180deg)
  brightness(1.5) saturate(1.25)` so the orange origami arrow returns
  to its brand blue and the "高德地图" text reads as crisp white.
- Lifts the whole credit to full `#00D4FF` on hover.

Spawn 9.7/A is the commit that finalised this. The CSS is heavily
commented in `index.css` because the filter algebra is not obvious and
future maintainers need to know not to change it casually.

---

## 7. Design references — the lineage we drew on

We did not invent the IOC big-screen aesthetic. We borrowed from the
canonical Chinese-tech-industry references:

| Reference | What we took |
|---|---|
| **阿里 ET 城市大脑 (Alibaba ET City Brain)** | The "city as a single dashboard" framing; the cyan/blue accent palette. |
| **海康威视 iVMS** | The chamfered-corner panel lattice; multi-pane grid layout for the IOC home. |
| **华为 IOC** | The KPI horizontal strip pattern; the bottom-strip "data ribbon" with three small charts. |
| **阿里 DataV-React** | The visual decoration vocabulary — pulse rings, scan lines, sci-fi tech borders. |
| **Geovis (中科星图)** | The geographic-information-platform feel; the dark map basemap palette. |

The SaaS light side draws from a different lineage:

| Reference | What we took |
|---|---|
| **Linear** | The clean data-table treatment; the way Operator Dashboard's tables breathe. |
| **Vercel dashboard** | The flat shadow-less card style for the Driver app's H5. |
| **Stripe Dashboard** | The KPI-card → drill-down pattern in the Site Selection detail page. |

Citing these openly is the right thing to do — none of the visual ideas
above are novel, and our value-add is the *combination* of them around
a charging-network domain plus the AI surface. The implementation in
React + Tailwind is, however, entirely original.

---

## 8. How to extend the system

Three operational rules for anyone making UI changes:

1. **Tokens before classes.** If a value appears in more than one
   `tailwind.config.ts` color or `index.css` rule, lift it into
   `frontend/src/design-tokens/` first.
2. **No new UI library.** The frontend's package.json deliberately
   pins `shadcn/ui + Tailwind` and that's it. Adding a Material UI or
   Ant Design dependency would double the bundle and dilute the
   identity. Build the missing primitive in `components/ui/` instead.
3. **Don't break the IOC ↔ SaaS dichotomy.** If you find yourself
   adding a glow effect to a SaaS detail page, stop and check whether
   the page should be IOC-themed instead. The dichotomy is the
   product's *visual narrative* and bleeding the styles together
   muddies the story.

This document is the canonical reference. When in doubt, the source of
truth is whichever file under [`frontend/src/design-tokens/`](../frontend/src/design-tokens/)
holds the contested value. Tailwind config and `index.css` mirror those
tokens — they never define a new value independently.
