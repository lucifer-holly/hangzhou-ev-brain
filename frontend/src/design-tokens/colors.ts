/**
 * Design tokens — color palettes.
 *
 * Two coherent palettes:
 *   - `ioc`  → dark "city operations center" big-screen look (City Console home).
 *   - `saas` → light, clean dashboard look (detail pages, operator console).
 *
 * Keep this file as the single source of truth. The Tailwind config mirrors
 * these as `bg-ioc-deep`, `text-saas-accent`, etc., so JS code rarely needs to
 * import these directly.
 */

export const ioc = {
  bg: {
    deep: '#0A0E1A',
    panel: 'rgba(20,30,60,0.7)',
    panelSolid: '#141E3C',
  },
  gradient: {
    home: 'radial-gradient(circle at 20% 30%, #1A2238 0%, #0A0E1A 70%)',
  },
  border: {
    tech: 'rgba(0,212,255,0.3)',
  },
  accent: {
    cyan: '#00D4FF',
    blue: '#4A9EFF',
  },
  status: {
    warning: '#FFB800',
    danger: '#FF6B35',
    success: '#00FF94',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#A0B0CC',
    muted: '#5A6680',
  },
} as const

export const saas = {
  bg: {
    primary: '#FFFFFF',
    alt: '#F8FAFC',
  },
  border: '#E2E8F0',
  accent: '#2563EB',
  text: {
    dark: '#0F172A',
    mid: '#475569',
    light: '#94A3B8',
  },
} as const

/** Map of pile status → IOC accent color (used by map markers + KPI). */
export const pileStatusColor = {
  idle: ioc.status.success,
  charging: ioc.accent.cyan,
  occupied: ioc.status.warning,
  fault: ioc.status.danger,
  offline: ioc.text.muted,
} as const

export type PileStatus = keyof typeof pileStatusColor
