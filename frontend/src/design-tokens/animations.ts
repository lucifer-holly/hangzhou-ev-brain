/**
 * Shared animation timings + easing curves.
 *
 * Keyframes themselves are declared in `tailwind.config.ts` so they're
 * reusable as utility classes (`animate-pulse-ring`, `animate-scan-line`).
 * This file holds the constants we want to reuse from JS (e.g. Framer Motion).
 */

export const easing = {
  smooth: [0.215, 0.61, 0.355, 1] as const,
  enter: [0.0, 0.0, 0.2, 1] as const,
  exit: [0.4, 0.0, 1.0, 1] as const,
}

export const duration = {
  fast: 0.18,
  base: 0.32,
  slow: 0.6,
  pulse: 1.6,
  scan: 6,
}
