import CountUp from 'react-countup'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

interface OperatorKpiProps {
  label: string
  value: number | string
  decimals?: number
  suffix?: string
  Icon?: LucideIcon
  /** Mood color for the icon chip + accent bar. */
  tone?: 'blue' | 'cyan' | 'amber' | 'emerald' | 'rose'
  /** Sub-text below the number, e.g. "#2 / 4 ranked". */
  hint?: string
  className?: string
}

const TONE_BG: Record<NonNullable<OperatorKpiProps['tone']>, string> = {
  blue: 'bg-blue-50 text-blue-600 ring-blue-100',
  cyan: 'bg-cyan-50 text-cyan-600 ring-cyan-100',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  rose: 'bg-rose-50 text-rose-600 ring-rose-100',
}

const TONE_BAR: Record<NonNullable<OperatorKpiProps['tone']>, string> = {
  blue: 'bg-blue-500',
  cyan: 'bg-cyan-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
}

/**
 * SaaS-light KPI card. Sister to the IOC `<KpiCard>` but flipped to the
 * white surface palette used across detail pages and the operator
 * console. Numeric values animate via `CountUp`.
 */
export function OperatorKpi({
  label,
  value,
  decimals = 0,
  suffix,
  Icon,
  tone = 'blue',
  hint,
  className,
}: OperatorKpiProps) {
  const numeric = typeof value === 'number'
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-saas-border bg-white p-4 shadow-sm',
        className,
      )}
    >
      <span
        className={cn('absolute inset-y-0 left-0 w-1', TONE_BAR[tone])}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-medium uppercase tracking-wider text-saas-text-mid">
          {label}
        </div>
        {Icon ? (
          <span
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-md ring-1',
              TONE_BG[tone],
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tabular-nums text-saas-text-dark">
          {numeric ? (
            <CountUp end={value as number} duration={1.2} decimals={decimals} separator="," />
          ) : (
            value
          )}
        </span>
        {suffix ? (
          <span className="text-sm text-saas-text-mid">{suffix}</span>
        ) : null}
      </div>
      {hint ? (
        <div className="mt-1 text-[11px] text-saas-text-light">{hint}</div>
      ) : null}
    </div>
  )
}
