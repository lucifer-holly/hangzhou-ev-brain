/**
 * Typography tokens.
 *
 * Three font roles:
 *   - title : Orbitron (futuristic, KPI numbers, page titles)
 *   - body  : Inter + PingFang SC (everything else, ZH+EN)
 *   - mono  : JetBrains Mono (telemetry values, code, IDs)
 *
 * Loaded via `<link>` in `index.html`. Tailwind exposes them as
 * `font-title`, `font-body`, `font-mono`.
 */

export const fontFamily = {
  title: "'Orbitron', 'Manrope', system-ui, sans-serif",
  body: "'Inter', 'PingFang SC', 'Hiragino Sans GB', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
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
