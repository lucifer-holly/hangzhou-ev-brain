import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, AlertOctagon, Info } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import type { Event as ApiEvent } from '@/api/events'
import { useEvents } from '@/hooks/useEvents'
import type { WsEvent } from '@/hooks/useWebSocket'
import { cn } from '@/lib/utils'

type Severity = 'info' | 'warning' | 'critical'

interface MergedEvent {
  key: string
  ts: string
  message: string
  severity: Severity
  pile_id?: string
  type?: string
}

interface LiveEventStreamProps {
  realtimeEvents: WsEvent[]
  isConnected: boolean
  className?: string
  maxItems?: number
}

const severityStyle: Record<Severity, string> = {
  info: 'border-ioc-cyan/40 text-ioc-cyan bg-ioc-cyan/5',
  warning: 'border-ioc-warning/40 text-ioc-warning bg-ioc-warning/5',
  critical: 'border-ioc-danger/40 text-ioc-danger bg-ioc-danger/5',
}

const SeverityIcon: Record<Severity, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertOctagon,
}

function severityRank(s: Severity): number {
  return s === 'critical' ? 2 : s === 'warning' ? 1 : 0
}

function eventKey(e: { id?: number | string; pile_id?: string; ts: string; message: string }): string {
  return e.id != null ? `id:${e.id}` : `${e.pile_id ?? '?'}:${e.ts}:${e.message.slice(0, 32)}`
}

export function LiveEventStream({
  realtimeEvents,
  isConnected,
  className,
  maxItems = 20,
}: LiveEventStreamProps) {
  const navigate = useNavigate()
  const [paused, setPaused] = useState(false)
  const seed = useEvents({ limit: 50 })
  const seenKeys = useRef<Set<string>>(new Set())

  const merged: MergedEvent[] = useMemo(() => {
    const seedList: MergedEvent[] = (seed.data ?? []).map((e: ApiEvent) => ({
      key: eventKey(e),
      ts: e.ts,
      message: e.message,
      severity: e.severity as Severity,
      pile_id: e.pile_id,
      type: e.type,
    }))
    const liveList: MergedEvent[] = realtimeEvents.map((e) => ({
      key: eventKey(e),
      ts: e.ts,
      message: e.message,
      severity: e.severity,
      pile_id: e.pile_id,
      type: e.type,
    }))
    const all = [...liveList, ...seedList]
    const dedup = new Map<string, MergedEvent>()
    for (const e of all) if (!dedup.has(e.key)) dedup.set(e.key, e)
    const sorted = Array.from(dedup.values()).sort((a, b) => (a.ts < b.ts ? 1 : -1))
    return sorted.slice(0, maxItems)
  }, [seed.data, realtimeEvents, maxItems])

  useEffect(() => {
    for (const e of merged) seenKeys.current.add(e.key)
  }, [merged])

  const counts = useMemo(() => {
    const c = { info: 0, warning: 0, critical: 0 }
    for (const e of merged) c[e.severity] += 1
    return c
  }, [merged])

  return (
    <div
      className={cn('flex h-full flex-col', className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-ioc-border/50 px-3 py-2">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-ioc-text-secondary">
          <span>Live Events · 实时事件</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-ioc-text-muted">
          <span className="text-ioc-danger">●{counts.critical}</span>
          <span className="text-ioc-warning">●{counts.warning}</span>
          <span className="text-ioc-cyan">●{counts.info}</span>
          <span
            className={cn(
              'rounded px-1.5 py-px',
              isConnected
                ? 'bg-ioc-success/15 text-ioc-success'
                : 'bg-ioc-danger/15 text-ioc-danger',
            )}
          >
            {isConnected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* WS-disconnect warning bar */}
      {!isConnected ? (
        <div className="flex items-center gap-2 border-b border-ioc-danger/40 bg-ioc-danger/10 px-3 py-1 text-[11px] text-ioc-danger">
          <AlertOctagon className="h-3 w-3" />
          <span>WebSocket disconnected · reconnecting…</span>
        </div>
      ) : null}

      {/* Stream */}
      <div className="relative flex-1 overflow-hidden">
        <ul
          className={cn(
            'absolute inset-x-0 top-0 flex flex-col gap-1.5 overflow-y-auto px-2 py-2',
            'h-full',
            !paused && 'will-change-transform',
          )}
        >
          <AnimatePresence initial={false}>
            {merged.map((evt) => {
              const Icon = SeverityIcon[evt.severity]
              const isCritical = evt.severity === 'critical'
              return (
                <motion.li
                  key={evt.key}
                  layout
                  initial={{ opacity: 0, x: 24, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.32, ease: 'easeOut' }}
                  onClick={() => evt.pile_id && navigate(`/city/piles/${evt.pile_id}`)}
                  className={cn(
                    'group cursor-pointer rounded-sm border-l-2 px-2 py-1.5 text-xs transition-colors',
                    severityStyle[evt.severity],
                    'hover:bg-ioc-panel/80',
                    isCritical && 'animate-flicker',
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Icon className="mt-0.5 h-3 w-3 shrink-0" />
                    <span className="flex-1 leading-tight text-ioc-text-primary">
                      {evt.message}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 pl-5 text-[10px] font-mono text-ioc-text-muted">
                    <span>{evt.ts.slice(11, 19)}</span>
                    {evt.pile_id ? (
                      <span className="truncate">
                        {evt.pile_id.slice(0, 14)} →
                      </span>
                    ) : null}
                    {evt.type ? (
                      <span className="ml-auto opacity-60">{evt.type}</span>
                    ) : null}
                  </div>
                </motion.li>
              )
            })}
          </AnimatePresence>
          {merged.length === 0 && !seed.isLoading ? (
            <li className="px-1 py-2 text-xs text-ioc-text-muted">
              No events · 暂无事件
            </li>
          ) : null}
          {seed.isLoading ? (
            <li className="px-1 py-2 text-xs text-ioc-text-muted">
              loading event history…
            </li>
          ) : null}
        </ul>
      </div>

      <div className="border-t border-ioc-border/50 px-3 py-1.5 text-[10px] font-mono text-ioc-text-muted">
        {paused
          ? 'paused · hover to read · 移开鼠标继续滚动'
          : `${merged.length}/${maxItems} · click to drill in · 点击查看详情`}
      </div>
    </div>
  )
}

/** Severity rank export — used elsewhere for sort stability when needed. */
export { severityRank }
