/**
 * Typography tokens.
 *
 * Three font roles (all self-hosted via @fontsource):
 *   - display : Geist Variable (modern geometric, KPI numbers, page titles)
 *   - body    : Geist Variable + Noto Sans SC (UI text, EN+ZH harmonized)
 *   - mono    : Geist Mono Variable (telemetry values, code, IDs)
 *
 * Loaded via `import` in `main.tsx`. Tailwind exposes them as
 * `font-display`, `font-body`, `font-mono`.
 *
 * `font-title` is kept as a back-compat alias mapping to `display` while
 * legacy components migrate.
 */

export const fontFamily = {
  display:
    "'Geist Variable', 'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', system-ui, sans-serif",
  body: "'Geist Variable', 'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', system-ui, sans-serif",
  mono: "'Geist Mono Variable', 'JetBrains Mono', ui-monospace, monospace",
} as const

export const fontSize = {
  kpi: '2.75rem',
  h1: '2rem',
  h2: '1.5rem',
  h3: '1.25rem',
  body: '0.9375rem',
  small: '0.8125rem',
  caption: '0.6875rem',
} as const
