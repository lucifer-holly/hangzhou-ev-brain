import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Info, ShieldAlert } from 'lucide-react'

import type { Event } from '@/api/events'
import { cn } from '@/lib/utils'

interface OperatorEventStreamProps {
  /** Events already filtered to the focused operator's piles. */
  events: Event[]
  isConnected: boolean
  className?: string
  maxItems?: number
}

const SEVERITY_STYLE = {
  info: 'border-blue-200 bg-blue-50/70 text-blue-700',
  warning: 'border-amber-200 bg-amber-50/70 text-amber-700',
  critical: 'border-rose-200 bg-rose-50/70 text-rose-700',
} as const

const SEVERITY_ICON = {
  info: Info,
  warning: AlertTriangle,
  critical: ShieldAlert,
} as const

const TYPE_LABEL: Record<Event['type'], string> = {
  voltage_anomaly: '电压异常',
  thermal_fault: '过热',
  vibration_event: '震动',
  cable_fault: '电缆故障',
  communication_loss: '通信丢失',
  charging_start: '充电开始',
  charging_end: '充电结束',
}

export function OperatorEventStream({
  events,
  isConnected,
  className,
  maxItems = 22,
}: OperatorEventStreamProps) {
  const visible = useMemo(() => events.slice(0, maxItems), [events, maxItems])

  const counts = useMemo(() => {
    const c = { critical: 0, warning: 0, info: 0 }
    for (const e of events) c[e.severity]++
    return c
  }, [events])

  return (
    <section
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-lg border border-saas-border bg-white shadow-sm',
        className,
      )}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-saas-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-saas-text-dark">
            Live Events · 实时异常流
          </h2>
          <p className="mt-0.5 text-[11px] text-saas-text-light">
            filtered to my piles · {events.length} events
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1',
            isConnected
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
              : 'bg-rose-50 text-rose-700 ring-rose-100',
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500',
            )}
          />
          {isConnected ? 'WS LIVE' : 'OFFLINE'}
        </span>
      </header>

      <div className="flex shrink-0 items-center gap-3 border-b border-saas-border bg-saas-bg-alt/60 px-4 py-2 text-[11px]">
        <SeverityChip color="rose" label="Critical" count={counts.critical} />
        <SeverityChip color="amber" label="Warning" count={counts.warning} />
        <SeverityChip color="blue" label="Info" count={counts.info} />
      </div>

      <ul className="flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
        <AnimatePresence initial={false}>
          {visible.map((evt) => {
            const Icon = SEVERITY_ICON[evt.severity]
            const style = SEVERITY_STYLE[evt.severity]
            return (
              <motion.li
                key={`${evt.id}-${evt.pile_id}`}
                layout
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }}
                className={cn(
                  'flex items-start gap-2 rounded-md border-l-2 px-3 py-2 text-xs',
                  style,
                )}
              >
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-saas-text-dark">
                      {TYPE_LABEL[evt.type] ?? evt.type}
                    </span>
                    <span className="font-mono text-[10px] text-saas-text-light">
                      {evt.ts.slice(11, 19)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-saas-text-mid">
                    {evt.message}
                  </p>
                  <div className="mt-1 font-mono text-[10px] text-saas-text-light">
                    {evt.pile_id.slice(0, 14)}
                  </div>
                </div>
              </motion.li>
            )
          })}
        </AnimatePresence>
        {visible.length === 0 ? (
          <li className="flex h-full items-center justify-center px-2 py-10 text-center text-xs text-saas-text-light">
            No events for this operator yet · 暂无事件
          </li>
        ) : null}
      </ul>
    </section>
  )
}

function SeverityChip({
  color,
  label,
  count,
}: {
  color: 'rose' | 'amber' | 'blue'
  label: string
  count: number
}) {
  const dot =
    color === 'rose'
      ? 'bg-rose-500'
      : color === 'amber'
        ? 'bg-amber-500'
        : 'bg-blue-500'
  return (
    <span className="inline-flex items-center gap-1.5 text-saas-text-mid">
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
      <span>{label}</span>
      <span className="tabular-nums font-semibold text-saas-text-dark">{count}</span>
    </span>
  )
}
