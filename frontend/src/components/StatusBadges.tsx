/**
 * Replacement for the cryptic "WS · LIVE" pill.
 *
 * Renders a compact strip of subsystem health badges so a non-technical
 * viewer can see at a glance that the API, realtime stream, AI service,
 * and message bus are healthy. Bilingual labels keep the IOC look
 * without forcing every viewer to recognise WebSocket terminology.
 *
 * Two variants:
 *   - compact : single row of label-color-value pills (used in topbars)
 *   - full    : same data with longer descriptors (used in panels)
 */

import { useEffect, useState } from 'react'

import { usePiles } from '@/hooks/usePiles'
import { useWebSocket } from '@/hooks/useWebSocket'
import { cn } from '@/lib/utils'

type Status = 'ok' | 'degraded' | 'error' | 'unknown'

interface Props {
  variant?: 'compact' | 'full'
  className?: string
}

const DOT: Record<Status, string> = {
  ok: 'bg-ioc-success shadow-[0_0_6px_rgba(0,255,148,0.7)]',
  degraded: 'bg-ioc-warning shadow-[0_0_6px_rgba(255,184,0,0.6)]',
  error: 'bg-ioc-danger shadow-[0_0_6px_rgba(255,107,53,0.6)]',
  unknown: 'bg-ioc-text-muted',
}
const TXT: Record<Status, string> = {
  ok: 'text-ioc-success',
  degraded: 'text-ioc-warning',
  error: 'text-ioc-danger',
  unknown: 'text-ioc-text-muted',
}

export function StatusBadges({ variant = 'compact', className }: Props) {
  const piles = usePiles()
  const { isConnected } = useWebSocket()
  const [apiPing, setApiPing] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const measure = async () => {
      const t0 = performance.now()
      try {
        await fetch(
          (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000') +
            '/health',
          { method: 'GET', cache: 'no-store' },
        )
        if (!cancelled) setApiPing(Math.round(performance.now() - t0))
      } catch {
        if (!cancelled) setApiPing(null)
      }
    }
    measure()
    const id = setInterval(measure, 30_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const apiStatus: Status = piles.isError
    ? 'error'
    : piles.data
      ? 'ok'
      : piles.isLoading
        ? 'unknown'
        : 'degraded'
  const realtimeStatus: Status = isConnected ? 'ok' : 'error'
  const aiStatus: Status = piles.data ? 'ok' : 'unknown'
  const mqttStatus: Status = isConnected ? 'ok' : 'degraded'

  const items: { label_zh: string; label_en: string; status: Status; value: string }[] = [
    {
      label_zh: 'API',
      label_en: 'REST',
      status: apiStatus,
      value: apiPing !== null ? `${apiPing}ms` : 'OK',
    },
    {
      label_zh: '实时流',
      label_en: 'Realtime',
      status: realtimeStatus,
      value: realtimeStatus === 'ok' ? 'LIVE' : 'OFFLINE',
    },
    {
      label_zh: 'AI',
      label_en: 'PyTorch',
      status: aiStatus,
      value: aiStatus === 'ok' ? 'Ready' : '—',
    },
    {
      label_zh: '消息总线',
      label_en: 'MQTT',
      status: mqttStatus,
      value: mqttStatus === 'ok' ? 'OK' : '—',
    },
  ]

  if (variant === 'full') {
    return (
      <div className={cn('flex flex-col gap-1.5 text-[11px]', className)}>
        {items.map((it) => (
          <div key={it.label_zh} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={cn('h-1.5 w-1.5 rounded-full', DOT[it.status])} />
              <span className="text-ioc-text-secondary">{it.label_zh}</span>
              <span className="font-mono text-[10px] text-ioc-text-muted">{it.label_en}</span>
            </div>
            <span className={cn('font-mono text-[10px]', TXT[it.status])}>{it.value}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-md border border-ioc-border/50 bg-ioc-deep/70 px-1.5 py-1 backdrop-blur',
        className,
      )}
      title="Subsystem health · 子系统健康"
    >
      {items.map((it, i) => (
        <div key={it.label_zh} className="flex items-center gap-1.5 px-1.5">
          <span className={cn('h-1.5 w-1.5 rounded-full', DOT[it.status])} />
          <span className="text-[10px] text-ioc-text-secondary">{it.label_zh}</span>
          <span className={cn('font-mono text-[9px]', TXT[it.status])}>{it.value}</span>
          {i < items.length - 1 ? (
            <span className="ml-1 h-3 w-px bg-ioc-border/40" />
          ) : null}
        </div>
      ))}
    </div>
  )
}
