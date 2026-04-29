import CountUp from 'react-countup'

import { cn } from '@/lib/utils'

import { PulseDot } from './PulseDot'

interface KpiCardProps {
  label: string
  /** Pass a number to drive the count-up animation; pass a string to render verbatim. */
  value: number | string
  /** Suffix appended after the number, e.g. " MW" or " %". */
  suffix?: string
  /** Decimal digits when `value` is numeric. */
  decimals?: number
  delta?: { dir: 'up' | 'down' | 'flat'; pct: number } | null
  tone?: 'cyan' | 'warning' | 'danger' | 'success'
  className?: string
}

const toneTextMap = {
  cyan: 'text-ioc-cyan text-glow-cyan',
  warning: 'text-ioc-warning text-glow-warning',
  danger: 'text-ioc-danger text-glow-danger',
  success: 'text-ioc-success text-glow-success',
} as const

const tonePulseMap = {
  cyan: 'cyan',
  warning: 'warning',
  danger: 'danger',
  success: 'success',
} as const

/**
 * Neon KPI card — single big number, optional delta, accent halo.
 * Used in the IOC top KPI strip and detail-page summary cards.
 */
export function KpiCard({
  label,
  value,
  suffix,
  decimals = 0,
  delta,
  tone = 'cyan',
  className,
}: KpiCardProps) {
  const numeric = typeof value === 'number'
  return (
    <div
      className={cn(
        'hover-lift hover-glow relative overflow-hidden rounded-md border border-ioc-border bg-ioc-panel px-5 py-4',
        'before:absolute before:inset-y-0 before:left-0 before:w-[3px]',
        tone === 'cyan' && 'before:bg-ioc-cyan',
        tone === 'warning' && 'before:bg-ioc-warning',
        tone === 'danger' && 'before:bg-ioc-danger',
        tone === 'success' && 'before:bg-ioc-success',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-ioc-text-secondary">
        <PulseDot tone={tonePulseMap[tone]} size="sm" />
        <span>{label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={cn('font-title text-4xl font-bold tabular-nums', toneTextMap[tone])}>
          {numeric ? (
            <CountUp end={value as number} duration={1.4} decimals={decimals} separator="," />
          ) : (
            value
          )}
        </span>
        {suffix ? (
          <span className="text-sm text-ioc-text-secondary">{suffix}</span>
        ) : null}
      </div>
      {delta ? (
        <div className="mt-1 text-xs text-ioc-text-secondary">
          <span
            className={cn(
              'mr-1',
              delta.dir === 'up' && 'text-ioc-success',
              delta.dir === 'down' && 'text-ioc-danger',
            )}
          >
            {delta.dir === 'up' ? '▲' : delta.dir === 'down' ? '▼' : '–'}
            {delta.pct.toFixed(1)}%
          </span>
          vs. yesterday
        </div>
      ) : null}
    </div>
  )
}
