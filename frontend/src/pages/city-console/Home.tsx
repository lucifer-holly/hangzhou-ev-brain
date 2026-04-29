import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { BottomChartStrip } from '@/components/ioc/BottomChartStrip'
import { KpiCard } from '@/components/ioc/KpiCard'
import { LiveEventStream } from '@/components/ioc/LiveEventStream'
import { ModeSwitch, type ConsoleMode } from '@/components/ioc/ModeSwitch'
import { ScanLine } from '@/components/ioc/ScanLine'
import { TechBorder } from '@/components/ioc/TechBorder'
import { CityMap } from '@/components/map/CityMap'
import { useDemandForecast } from '@/hooks/useDemandForecast'
import { useOperators } from '@/hooks/useOperators'
import { usePiles } from '@/hooks/usePiles'
import { useWebSocket } from '@/hooks/useWebSocket'
import { env } from '@/lib/env'

/**
 * IOC city console homepage.
 *
 * Three modes drive the visual state:
 *   - realtime  : WS-live current_occupancy, status-coloured halos
 *   - history   : same baseline but jittered (Gaussian noise σ≈0.10) to
 *                 mimic the same hour 24h ago. Cheap stand-in for a real
 *                 historical telemetry replay; Spawn 6 detail page does
 *                 the proper drilldown.
 *   - predict   : pings /api/ai/predict/demand for every pile (batched
 *                 4×10 in flight) and overlays the LSTM forecast.
 */
export function Home() {
  const navigate = useNavigate()
  const piles = usePiles()
  const operators = useOperators()
  const { isConnected, latestTelemetry, recentEvents } = useWebSocket()
  const [mode, setMode] = useState<ConsoleMode>('realtime')

  const livePiles = useMemo(() => {
    const list = piles.data ?? []
    if (Object.keys(latestTelemetry).length === 0) return list
    return list.map((p) => {
      const live = latestTelemetry[p.id]
      if (!live) return p
      return {
        ...p,
        current_status: (live.status as typeof p.current_status) ?? p.current_status,
        current_power: live.power ?? p.current_power,
        current_occupancy: live.occupancy_rate ?? p.current_occupancy,
      }
    })
  }, [piles.data, latestTelemetry])

  const forecast = useDemandForecast(1, mode === 'predict')

  // Toast on WebSocket disconnect transitions (don't fire on initial mount).
  const wasConnected = useRef<boolean | null>(null)
  useEffect(() => {
    if (wasConnected.current === null) {
      wasConnected.current = isConnected
      return
    }
    if (wasConnected.current && !isConnected) {
      toast.warning('WebSocket disconnected', {
        description: 'Realtime stream lost · attempting reconnect…',
      })
    } else if (!wasConnected.current && isConnected) {
      toast.success('WebSocket reconnected', {
        description: 'Realtime stream restored.',
        duration: 2500,
      })
    }
    wasConnected.current = isConnected
  }, [isConnected])

  // Toast on new critical events.
  const seenCritical = useRef<Set<string>>(new Set())
  useEffect(() => {
    for (const evt of recentEvents) {
      if (evt.severity !== 'critical') continue
      const key = `${evt.pile_id}:${evt.ts}`
      if (seenCritical.current.has(key)) continue
      seenCritical.current.add(key)
      toast.error(evt.message, {
        description: `${evt.pile_id?.slice(0, 14)} · ${evt.type}`,
        duration: 6000,
      })
    }
  }, [recentEvents])

  // Toast on forecast result.
  const lastForecastTs = useRef<number | null>(null)
  useEffect(() => {
    if (!forecast.generatedAt) return
    if (lastForecastTs.current === forecast.generatedAt) return
    lastForecastTs.current = forecast.generatedAt
    if (mode === 'predict') {
      toast.success(
        `LSTM forecast 完成 · ${forecast.pileCount} piles`,
        {
          description: `平均预测 ${(forecast.averageOccupancy * 100).toFixed(1)}% · 置信度 ${(forecast.averageConfidence * 100).toFixed(0)}%`,
          duration: 4000,
        },
      )
    }
  }, [forecast.generatedAt, forecast.pileCount, forecast.averageOccupancy, forecast.averageConfidence, mode])

  const displayPiles = useMemo(() => {
    if (mode === 'predict') {
      return livePiles.map((p) => {
        const f = forecast.byPileId[p.id]
        if (!f) return p
        return { ...p, current_occupancy: f.predicted_occupancy }
      })
    }
    if (mode === 'history') {
      // Deterministic pseudo-history: stable per-pile gaussian-ish jitter.
      return livePiles.map((p) => {
        const seed = hashCode(p.id)
        const jitter = ((seed % 200) / 1000 - 0.1) * 1.0
        const next = clamp01(p.current_occupancy + jitter)
        return { ...p, current_occupancy: next }
      })
    }
    return livePiles
  }, [livePiles, mode, forecast.byPileId])

  const kpis = useMemo(() => {
    const list = displayPiles
    const online = list.filter((p) => p.current_status !== 'offline').length
    const power = list.reduce((sum, p) => sum + (p.current_power ?? 0), 0)
    const utilization =
      list.length > 0
        ? list.reduce((sum, p) => sum + (p.current_occupancy ?? 0), 0) / list.length
        : 0
    const fault = list.filter((p) => p.current_status === 'fault').length
    return { online, power, utilization, fault, total: list.length }
  }, [displayPiles])

  const utilLabel =
    mode === 'predict'
      ? 'Forecast Util · 预测利用率(1h)'
      : mode === 'history'
        ? 'Util (24h ago) · 历史利用率'
        : 'Utilization · 实时利用率'

  const utilTone: 'cyan' | 'success' | 'warning' = mode === 'predict' ? 'success' : 'cyan'

  return (
    <div className="bg-ioc-circuit relative flex h-full flex-col overflow-hidden p-4">
      <ScanLine />

      {/* Mode header row */}
      <div className="mb-2 flex shrink-0 items-end justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-title text-base font-bold uppercase tracking-[0.25em] text-ioc-cyan text-glow-cyan">
            City Overview · 城市总览
          </h2>
          {mode === 'predict' ? (
            <span className="text-[11px] text-ioc-blue">
              未来 1 小时预测 · LSTM 模型
              {forecast.loading
                ? ` · 加载中…`
                : forecast.error
                  ? ` · 失败: ${forecast.error}`
                  : forecast.generatedAt
                    ? ` · ${forecast.pileCount}/${displayPiles.length} piles · 置信度 ${(forecast.averageConfidence * 100).toFixed(0)}% · ${ageLabel(forecast.generatedAt)}`
                    : ''}
            </span>
          ) : mode === 'history' ? (
            <span className="text-[11px] text-ioc-text-muted">
              24 小时前同时段 · 合成基线 σ≈0.10
            </span>
          ) : (
            <span className="text-[11px] text-ioc-text-muted">WebSocket 1Hz · synthetic</span>
          )}
        </div>
        <ModeSwitch mode={mode} onChange={setMode} />
      </div>

      {/* KPI strip */}
      <section className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          tone="success"
          label="Online · 在线桩"
          value={kpis.online}
          suffix={kpis.total ? ` / ${kpis.total}` : ''}
        />
        <KpiCard
          tone="cyan"
          label="Live Power · 实时功率"
          value={kpis.power}
          decimals={1}
          suffix=" kW"
        />
        <KpiCard tone="danger" label="Faulted · 故障" value={kpis.fault} />
        <KpiCard
          tone={utilTone}
          label={utilLabel}
          value={kpis.utilization * 100}
          decimals={1}
          suffix=" %"
        />
      </section>

      {/* Map + event stream */}
      <section className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[2.4fr_1fr]">
        <TechBorder>
          <div className="relative flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-ioc-border/50 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-ioc-text-secondary">
              <span>
                Hangzhou Pile Map · 杭州充电桩地图
                {mode === 'predict' ? (
                  <span className="ml-2 text-ioc-blue">[FORECAST]</span>
                ) : mode === 'history' ? (
                  <span className="ml-2 text-ioc-text-muted">[HISTORY]</span>
                ) : null}
              </span>
              <span className="font-mono text-[10px] text-ioc-text-muted">
                provider={env.mapProvider} · {displayPiles.length} piles ·{' '}
                <span className={isConnected ? 'text-ioc-success' : 'text-ioc-danger'}>
                  {isConnected ? '● live' : '○ offline'}
                </span>
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <CityMap
                piles={displayPiles}
                predicted={mode === 'predict'}
                onPileClick={(p) => navigate(`/city/piles/${p.id}`)}
              />
            </div>
          </div>
        </TechBorder>

        <TechBorder>
          <div className="h-full">
            <LiveEventStream
              realtimeEvents={recentEvents}
              isConnected={isConnected}
              maxItems={20}
            />
          </div>
        </TechBorder>
      </section>

      {/* Bottom 3-chart strip */}
      <section className="mt-3 shrink-0">
        <BottomChartStrip operators={operators.data ?? []} />
      </section>
    </div>
  )
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function ageLabel(ts: number): string {
  const sec = Math.round((Date.now() - ts) / 1000)
  if (sec < 60) return `${sec}s ago`
  return `${Math.round(sec / 60)}m ago`
}
