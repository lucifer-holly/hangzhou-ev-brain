import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** shadcn/ui standard `cn()` helper. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a number with thousand separators, no fractional digits. */
export function formatInt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

/** Format a kilowatt value, e.g. 12345.67 → "12.3 MW". */
export function formatPower(kw: number): string {
  if (kw >= 1000) return `${(kw / 1000).toFixed(1)} MW`
  return `${kw.toFixed(1)} kW`
}

/** Format a 0..1 ratio as percent string. */
export function formatPct(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits)}%`
}

/** Clamp `n` to `[min, max]`. */
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}
