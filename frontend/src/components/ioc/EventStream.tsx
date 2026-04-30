import { AnimatePresence, motion } from 'framer-motion'

import { cn } from '@/lib/utils'

export interface EventStreamItem {
  id: string | number
  ts: string
  message: string
  severity: 'info' | 'warning' | 'critical'
  pile_id?: string
}

interface EventStreamProps {
  events: EventStreamItem[]
  className?: string
  maxItems?: number
}

const severityStyle = {
  info: 'border-ioc-cyan/40 text-ioc-cyan',
  warning: 'border-ioc-warning/40 text-ioc-warning',
  critical: 'border-ioc-danger/40 text-ioc-danger',
} as const

/**
 * Animated rolling event feed — newest at top.
 *
 * Production wiring hooks this to the live WebSocket stream; for the placeholder
 * homepage it simply renders the events handed in.
 */
export function EventStream({ events, className, maxItems = 25 }: EventStreamProps) {
  const visible = events.slice(0, maxItems)
  return (
    <ul className={cn('flex flex-col gap-2', className)}>
      <AnimatePresence initial={false}>
        {visible.map((evt) => (
          <motion.li
            key={evt.id}
            layout
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.32 }}
            className={cn(
              'flex items-start gap-3 rounded-sm border-l-2 bg-ioc-panel/70 px-3 py-2 text-xs',
              severityStyle[evt.severity],
            )}
          >
            <span className="font-mono text-ioc-text-muted">
              {evt.ts.slice(11, 19)}
            </span>
            <span className="flex-1 text-ioc-text-primary">{evt.message}</span>
            {evt.pile_id ? (
              <span className="font-mono text-ioc-text-muted">{evt.pile_id.slice(0, 10)}</span>
            ) : null}
          </motion.li>
        ))}
      </AnimatePresence>
      {visible.length === 0 ? (
        <li className="text-xs text-ioc-text-muted">No events yet · 暂无事件</li>
      ) : null}
    </ul>
  )
}
