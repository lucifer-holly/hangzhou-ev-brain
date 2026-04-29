import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import { BottomChartStrip } from '@/components/ioc/BottomChartStrip'
import { KpiCard } from '@/components/ioc/KpiCard'
import { LiveEventStream } from '@/components/ioc/LiveEventStream'
import { ScanLine } from '@/components/ioc/ScanLine'
import { TechBorder } from '@/components/ioc/TechBorder'
import { CityMap } from '@/components/map/CityMap'
import { useOperators } from '@/hooks/useOperators'
import { usePiles } from '@/hooks/usePiles'
import { useWebSocket } from '@/hooks/useWebSocket'
import { env } from '@/lib/env'

/**
 * IOC city console homepage.
 *
 * Layout (1280×800 minimum, designed for 1920×1080):
 *   - KPI strip (4 cards)
 *   - Central map (left ~2/3) + Live event stream (right ~1/3)
 *   - Bottom 3-chart strip: operator pie · 24h util line · fault donut
 *
 * Mode switcher (Phase D) and weather/role widgets (Phase E) plug into
 * the topbar (`Layout.tsx`).
 */
export function Home() {
  const navigate = useNavigate()
  const piles = usePiles()
  const operators = useOperators()
  const { isConnected, latestTelemetry, recentEvents } = useWebSocket()

  // Live-aware pile snapshots (WS overrides REST when available)
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

  const kpis = useMemo(() => {
    const list = livePiles
    const online = list.filter((p) => p.current_status !== 'offline').length
    const power = list.reduce((sum, p) => sum + (p.current_power ?? 0), 0)
    const utilization =
      list.length > 0
        ? list.reduce((sum, p) => sum + (p.current_occupancy ?? 0), 0) / list.length
        : 0
    const fault = list.filter((p) => p.current_status === 'fault').length
    return { online, power, utilization, fault, total: list.length }
  }, [livePiles])

  return (
    <div className="relative flex h-full flex-col overflow-hidden p-4">
      <ScanLine />

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
        <KpiCard
          tone="danger"
          label="Faulted · 故障"
          value={kpis.fault}
        />
        <KpiCard
          tone="cyan"
          label="Utilization · 利用率"
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
              <span>Hangzhou Pile Map · 杭州充电桩地图</span>
              <span className="font-mono text-[10px] text-ioc-text-muted">
                provider={env.mapProvider} · {livePiles.length} piles ·{' '}
                <span className={isConnected ? 'text-ioc-success' : 'text-ioc-danger'}>
                  {isConnected ? '● live' : '○ offline'}
                </span>
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <CityMap
                piles={livePiles}
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
