import { useMemo } from 'react'

import { KpiCard } from '@/components/ioc/KpiCard'
import { ScanLine } from '@/components/ioc/ScanLine'
import { TechBorder } from '@/components/ioc/TechBorder'
import { MapProvider } from '@/components/map/MapProvider'
import { useEvents } from '@/hooks/useEvents'
import { useOperators } from '@/hooks/useOperators'
import { usePiles } from '@/hooks/usePiles'
import { useWebSocket } from '@/hooks/useWebSocket'
import { env } from '@/lib/env'
import { formatPower } from '@/lib/utils'

/**
 * Placeholder homepage.
 *
 * Goal: prove the foundation works end-to-end —
 *   - design tokens render (dark gradient, cyan glow, Orbitron title)
 *   - axios → /api/piles returns data
 *   - WebSocket connects and ticks
 *   - MapProvider renders Hangzhou
 *
 * Spawn 5 will replace this with the full IOC dashboard layout.
 */
export function Home() {
  const piles = usePiles()
  const operators = useOperators()
  const events = useEvents({ limit: 25 })
  const { isConnected } = useWebSocket()

  const kpis = useMemo(() => {
    const list = piles.data ?? []
    const online = list.filter((p) => p.current_status !== 'offline').length
    const power = list.reduce((sum, p) => sum + (p.current_power ?? 0), 0)
    const utilization =
      list.length > 0
        ? list.reduce((sum, p) => sum + (p.current_occupancy ?? 0), 0) / list.length
        : 0
    const todayAlerts = (events.data ?? []).filter(
      (e) => e.severity !== 'info',
    ).length
    return { online, power, utilization, todayAlerts, total: list.length }
  }, [piles.data, events.data])

  const markers = useMemo(
    () =>
      (piles.data ?? []).map((p) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        status: p.current_status,
        label: `${p.id} · ${p.current_status}`,
      })),
    [piles.data],
  )

  return (
    <div className="relative min-h-full overflow-hidden p-6">
      <ScanLine />
      <header className="mb-6">
        <h1 className="font-title text-3xl font-bold uppercase tracking-[0.25em] text-ioc-cyan text-glow-cyan">
          HZ-EV Brain
        </h1>
        <p className="mt-1 text-sm text-ioc-text-secondary">
          杭州智慧充电城市大脑 · synthetic city-scale charging-network telemetry
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          tone="success"
          label="Online Piles 在线桩"
          value={kpis.online}
          suffix={kpis.total ? `/ ${kpis.total}` : ''}
        />
        <KpiCard
          tone="cyan"
          label="Live Power 实时功率"
          value={kpis.power}
          decimals={1}
          suffix=" kW"
        />
        <KpiCard
          tone="warning"
          label="Alerts (24h) 告警"
          value={kpis.todayAlerts}
        />
        <KpiCard
          tone="cyan"
          label="Utilization 利用率"
          value={kpis.utilization * 100}
          decimals={1}
          suffix=" %"
        />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <TechBorder className="h-[420px]">
          <div className="relative h-[420px] p-2">
            <div className="mb-2 flex items-center justify-between px-2 text-xs uppercase tracking-wider text-ioc-text-secondary">
              <span>Hangzhou Pile Map · 桩位地图</span>
              <span className="font-mono">
                provider={env.mapProvider} · markers={markers.length}
              </span>
            </div>
            <div className="h-[378px] w-full">
              <MapProvider markers={markers} theme="dark" />
            </div>
          </div>
        </TechBorder>

        <TechBorder className="h-[420px]">
          <div className="flex h-[420px] flex-col p-4">
            <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-wider text-ioc-text-secondary">
              <span>Latest Operators</span>
              <span className="font-mono">{(operators.data ?? []).length} ops</span>
            </div>
            <ul className="flex-1 space-y-2 overflow-y-auto">
              {(operators.data ?? []).map((op) => (
                <li
                  key={op.id}
                  className="flex items-center justify-between rounded-sm border border-ioc-border/40 bg-ioc-panel/60 px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: op.color }}
                    />
                    <span className="text-ioc-text-primary">{op.name_zh}</span>
                    <span className="text-xs text-ioc-text-muted">{op.name_en}</span>
                  </span>
                  <span className="font-mono text-xs text-ioc-text-secondary">
                    {op.pile_count ?? '–'} piles · {(op.market_share * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </TechBorder>
      </section>

      <section className="mt-6 flex flex-wrap items-center gap-4 text-sm">
        <Status
          label="REST /api/piles"
          ok={!piles.isError && !piles.isLoading}
          detail={piles.isLoading ? 'loading' : `${(piles.data ?? []).length} piles`}
        />
        <Status
          label="WebSocket /ws"
          ok={isConnected}
          detail={isConnected ? 'live' : 'reconnecting'}
        />
        <Status
          label="REST /api/operators"
          ok={!operators.isError && !operators.isLoading}
          detail={`${(operators.data ?? []).length} ops`}
        />
        <Status
          label={`Live Power · ${formatPower(kpis.power)}`}
          ok={kpis.power > 0}
          detail={kpis.power > 0 ? 'flowing' : 'idle'}
        />
      </section>

      <p className="mt-8 max-w-3xl text-xs leading-relaxed text-ioc-text-muted">
        ⚡ Spawn 3 placeholder · Spawn 5 will render the full IOC dashboard
        (KPI strip + central map + 6-feature sidebar + scrolling event feed +
        bottom analytics row) here. This page exists to verify design tokens,
        REST + WebSocket connectivity, and the AMap/OSM map abstraction.
      </p>
    </div>
  )
}

function Status({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-ioc-border/40 bg-ioc-panel/60 px-3 py-1.5">
      <span
        className={
          ok ? 'h-2 w-2 rounded-full bg-ioc-success shadow-[0_0_8px_rgba(0,255,148,0.85)]' : 'h-2 w-2 rounded-full bg-ioc-danger shadow-[0_0_8px_rgba(255,107,53,0.85)]'
        }
      />
      <span className="text-ioc-text-primary">{label}</span>
      <span className="font-mono text-xs text-ioc-text-secondary">{detail}</span>
    </div>
  )
}
