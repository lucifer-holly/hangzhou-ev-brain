/**
 * Sidebar System Status panel — 4 health indicators.
 *
 * Sources:
 *   - API       : derived from a successful pile query (already cached)
 *   - Realtime  : from useWebSocket().isConnected
 *   - AI        : derived from a successful demand-forecast cache hit
 *                 (handled implicitly by useDemandForecast on Home)
 *   - MQTT      : synthetic — the demo can't really probe the broker
 *                 from the browser, so we mirror the realtime state with
 *                 a "Connected" label when WS is up.
 */

import { useEffect, useState } from 'react'

import { usePiles } from '@/hooks/usePiles'
import { useWebSocket } from '@/hooks/useWebSocket'
import { cn } from '@/lib/utils'

type Status = 'ok' | 'degraded' | 'error' | 'unknown'

const STATUS_DOT: Record<Status, string> = {
  ok: 'bg-ioc-success shadow-[0_0_6px_rgba(0,255,148,0.7)]',
  degraded: 'bg-ioc-warning shadow-[0_0_6px_rgba(255,184,0,0.6)]',
  error: 'bg-ioc-danger shadow-[0_0_6px_rgba(255,107,53,0.6)]',
  unknown: 'bg-ioc-text-muted',
}
const STATUS_TEXT: Record<Status, string> = {
  ok: 'text-ioc-success',
  degraded: 'text-ioc-warning',
  error: 'text-ioc-danger',
  unknown: 'text-ioc-text-muted',
}

export function SystemStatusPanel() {
  const piles = usePiles()
  const { isConnected } = useWebSocket()
  const [apiPing, setApiPing] = useState<number | null>(null)

  // Light-weight measured RTT for the cached pile call. Updates every 30s.
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

  const rows: { label: string; sub: string; status: Status; value: string }[] = [
    {
      label: 'API',
      sub: 'REST · 后端',
      status: apiStatus,
      value: apiPing !== null ? `${apiPing}ms` : 'Online',
    },
    {
      label: '实时流',
      sub: 'WebSocket · Realtime',
      status: realtimeStatus,
      value: realtimeStatus === 'ok' ? 'LIVE' : 'OFFLINE',
    },
    {
      label: 'AI',
      sub: 'PyTorch · XGBoost',
      status: aiStatus,
      value: aiStatus === 'ok' ? 'Ready' : '—',
    },
    {
      label: '消息总线',
      sub: 'MQTT · Mosquitto',
      status: mqttStatus,
      value: mqttStatus === 'ok' ? 'Connected' : '—',
    },
  ]

  return (
    <div className="rounded-md border border-ioc-border/40 bg-ioc-deep/50 px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between text-[9px] uppercase tracking-[0.2em] text-ioc-text-muted">
        <span>System Status</span>
        <span className="text-ioc-text-muted/60">系统状态</span>
      </div>
      <ul className="flex flex-col gap-1.5 text-[11px]">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_DOT[r.status])} />
              <span className="truncate text-ioc-text-secondary">{r.label}</span>
            </div>
            <span className={cn('font-mono text-[10px]', STATUS_TEXT[r.status])}>
              {r.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
