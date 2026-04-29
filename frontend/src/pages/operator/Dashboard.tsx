import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, AlertOctagon, Plug, Trophy, Zap } from 'lucide-react'
import { toast } from 'sonner'

import { useEvents } from '@/hooks/useEvents'
import { useOperators } from '@/hooks/useOperators'
import { useOperatorCompliance } from '@/hooks/useStats'
import { usePiles } from '@/hooks/usePiles'
import { useWebSocket } from '@/hooks/useWebSocket'
import { LiveClock } from '@/components/ioc/LiveClock'
import { PulseDot } from '@/components/ioc/PulseDot'
import { RoleSwitcher } from '@/components/ioc/RoleSwitcher'
import { MapProvider, type MapMarker } from '@/components/map/MapProvider'
import { BenchmarkRadar } from '@/components/operator/BenchmarkRadar'
import { OperatorEventStream } from '@/components/operator/OperatorEventStream'
import { OperatorKpi } from '@/components/operator/OperatorKpi'
import { OperatorPicker } from '@/components/operator/OperatorPicker'
import { PileTable } from '@/components/operator/PileTable'
import { RevenueCard } from '@/components/operator/RevenueCard'
import { cn } from '@/lib/utils'

const DEFAULT_OPERATOR = 'state_grid'

export function OperatorDashboard() {
  const navigate = useNavigate()
  const operators = useOperators()
  const allPiles = usePiles()
  const compliance = useOperatorCompliance('24h')
  const { isConnected, latestTelemetry, recentEvents } = useWebSocket()
  const [operatorId, setOperatorId] = useState<string>(DEFAULT_OPERATOR)

  // Initial alert when compliance loads — gives Operator some live feedback.
  useEffect(() => {
    if (!compliance.data || !operators.data) return
    const me = compliance.data.rows.find((r) => r.operator_id === operatorId)
    if (!me) return
    const ratingTone = me.rating === 'A' || me.rating === 'B' ? 'success' : 'warning'
    toast(`Operator switched · ${me.operator_name}`, {
      description: `综合分 ${me.composite_score.toFixed(1)} · 评级 ${me.rating} · 可用率 ${(me.availability_rate * 100).toFixed(1)}%`,
      duration: 3000,
      className: ratingTone === 'success' ? 'text-emerald-700' : 'text-amber-700',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operatorId, compliance.data, operators.data])

  const events = useEvents({ limit: 200 })

  // Live-merge piles with WS telemetry so power/status update at 1 Hz.
  const livePiles = useMemo(() => {
    const list = allPiles.data ?? []
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
  }, [allPiles.data, latestTelemetry])

  const myPiles = useMemo(
    () => livePiles.filter((p) => p.operator_id === operatorId),
    [livePiles, operatorId],
  )
  const myPileIds = useMemo(() => new Set(myPiles.map((p) => p.id)), [myPiles])

  const myEventsHistory = useMemo(
    () => (events.data ?? []).filter((e) => myPileIds.has(e.pile_id)),
    [events.data, myPileIds],
  )

  const myWsEvents = useMemo(
    () => recentEvents.filter((e) => e.pile_id && myPileIds.has(e.pile_id)),
    [recentEvents, myPileIds],
  )

  // Merge live WS events + REST history (de-dupe by pile_id+ts) into the
  // shape OperatorEventStream wants. Newest-first.
  const mergedEvents = useMemo(() => {
    const seen = new Set<string>()
    const out: typeof myEventsHistory = []
    // WS first (newest)
    for (const e of myWsEvents) {
      const key = `${e.pile_id}:${e.ts}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        id: out.length, // synthetic id is fine for keys
        pile_id: e.pile_id,
        ts: e.ts,
        type: e.type as never,
        severity: e.severity,
        message: e.message,
        duration_minutes: 0,
        resolved: false,
      } as never)
    }
    for (const e of myEventsHistory) {
      const key = `${e.pile_id}:${e.ts}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(e)
    }
    return out.slice(0, 100)
  }, [myWsEvents, myEventsHistory])

  const kpis = useMemo(() => {
    const total = myPiles.length
    const power = myPiles.reduce((s, p) => s + (p.current_power ?? 0), 0)
    const utilization =
      total === 0
        ? 0
        : myPiles.reduce((s, p) => s + (p.current_occupancy ?? 0), 0) / total
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayAlerts = myEventsHistory.filter((e) => {
      const d = new Date(e.ts)
      return e.severity !== 'info' && d >= today
    }).length

    // Utilization rank — higher is better.
    let rank = 0
    let rankTotal = 0
    if (operators.data && livePiles.length > 0) {
      rankTotal = operators.data.length
      const utilByOp: { id: string; util: number }[] = operators.data.map((o) => {
        const ps = livePiles.filter((p) => p.operator_id === o.id)
        const u = ps.length === 0 ? 0 : ps.reduce((s, p) => s + p.current_occupancy, 0) / ps.length
        return { id: o.id, util: u }
      })
      utilByOp.sort((a, b) => b.util - a.util)
      rank = utilByOp.findIndex((x) => x.id === operatorId) + 1
    }
    return { total, power, utilization, todayAlerts, rank, rankTotal }
  }, [myPiles, myEventsHistory, operators.data, livePiles, operatorId])

  const me = operators.data?.find((o) => o.id === operatorId)

  const mapMarkers: MapMarker[] = useMemo(() => {
    return livePiles.map((p) => {
      const isMine = p.operator_id === operatorId
      return {
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        // Non-mine piles are dimmed via the muted "offline" color.
        status: isMine ? p.current_status : 'offline',
        label: isMine
          ? `${p.id.slice(0, 14)} · ${p.current_status} · ${p.current_power.toFixed(1)} kW`
          : `${p.id.slice(0, 14)} · 其他运营商`,
      }
    })
  }, [livePiles, operatorId])

  const onMarkerClick = (m: MapMarker) => {
    if (myPileIds.has(m.id)) navigate(`/city/piles/${m.id}`)
    else toast('其他运营商的桩 · Not your pile')
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-saas-bg-alt">
      {/* IOC dark topbar — keeps brand identity consistent across consoles */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-ioc-border bg-ioc-deep px-5">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="智枢" className="h-7 w-7" />
          <span className="font-display text-lg font-semibold tracking-wide text-ioc-cyan text-glow-cyan">
            智枢
          </span>
          <span className="hidden md:inline font-mono text-[10px] uppercase tracking-[0.2em] text-ioc-text-muted">
            ZHISHU
          </span>
          <span className="hidden lg:inline text-xs text-ioc-text-secondary">运营商工作台</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-ioc-text-secondary">
          <div className="flex items-center gap-2 rounded-sm border border-ioc-border/50 bg-ioc-deep/60 px-2 py-1">
            <PulseDot tone={isConnected ? 'success' : 'danger'} size="sm" />
            <span className="font-mono text-[10px]">
              {isConnected ? 'WS · LIVE' : 'WS · OFFLINE'}
            </span>
          </div>
          <OperatorPicker
            operators={operators.data ?? []}
            selectedId={operatorId}
            onSelect={setOperatorId}
          />
          <LiveClock tz="Asia/Shanghai" />
          <RoleSwitcher current="operator" />
        </div>
      </header>

      {/* SaaS body */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-5">
          {/* Title row */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-saas-accent/80">
                Operator Console · 运营商工作台
              </div>
              <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-saas-text-dark">
                {me ? (
                  <>
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: me.color }}
                    />
                    {me.name_zh}
                    <span className="text-base font-normal text-saas-text-mid">
                      · {me.name_en}
                    </span>
                  </>
                ) : (
                  '加载中…'
                )}
              </h1>
              <p className="mt-1 text-sm text-saas-text-mid">
                单运营商视角 · 桩状态 / 异常 / 利用率 / 收益 / 同业对标
              </p>
            </div>
            {compliance.data ? (
              <div className="flex items-center gap-2 rounded-md border border-saas-border bg-white px-3 py-1.5 text-xs text-saas-text-mid shadow-sm">
                <span>City rank</span>
                <span className="font-bold tabular-nums text-saas-text-dark">
                  #{kpis.rank} / {kpis.rankTotal}
                </span>
                <span className="text-saas-text-light">
                  · 综合得分排行
                </span>
              </div>
            ) : null}
          </div>

          {/* KPI strip */}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <OperatorKpi
              label="我的桩数 · My Piles"
              value={kpis.total}
              tone="blue"
              Icon={Plug}
              hint={
                me?.market_share != null
                  ? `市占率 ${(me.market_share * 100).toFixed(0)}%`
                  : undefined
              }
            />
            <OperatorKpi
              label="实时功率 · Live Power"
              value={kpis.power / 1000}
              decimals={2}
              suffix=" MW"
              tone="cyan"
              Icon={Zap}
              hint={`${kpis.power.toFixed(1)} kW · 1Hz WS`}
            />
            <OperatorKpi
              label="今日告警 · Today Alerts"
              value={kpis.todayAlerts}
              tone={kpis.todayAlerts > 5 ? 'rose' : 'amber'}
              Icon={AlertOctagon}
              hint="warning + critical"
            />
            <OperatorKpi
              label="利用率排名 · Util Rank"
              value={kpis.rankTotal > 0 ? `#${kpis.rank}` : '—'}
              tone="emerald"
              Icon={Trophy}
              hint={`${(kpis.utilization * 100).toFixed(1)}% util · vs ${kpis.rankTotal} 运营商`}
            />
          </section>

          {/* Map + Events */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
            <div className="overflow-hidden rounded-lg border border-saas-border bg-white shadow-sm">
              <header className="flex items-center justify-between border-b border-saas-border px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-saas-text-dark">
                    Pile Map · 桩位地图
                  </h2>
                  <p className="mt-0.5 text-[11px] text-saas-text-light">
                    自家桩按状态着色 · 其他运营商灰显作为对照
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-saas-text-mid">
                  <Legend tone="emerald" label="空闲" />
                  <Legend tone="cyan" label="充电" />
                  <Legend tone="amber" label="占用" />
                  <Legend tone="rose" label="故障" />
                  <Legend tone="slate" label="其他/离线" />
                </div>
              </header>
              <div className="relative h-[440px]">
                <MapProvider
                  theme="light"
                  markers={mapMarkers}
                  onMarkerClick={onMarkerClick}
                />
              </div>
            </div>

            <div className="h-[500px]">
              <OperatorEventStream
                events={mergedEvents}
                isConnected={isConnected}
                className="h-full"
              />
            </div>
          </section>

          {/* Pile list */}
          <section className="overflow-hidden rounded-lg border border-saas-border bg-white shadow-sm">
            <header className="flex items-center justify-between border-b border-saas-border px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-saas-text-dark">
                  My Piles · 我的桩
                </h2>
                <p className="mt-0.5 text-[11px] text-saas-text-light">
                  click row → drill into city pile detail · 点击行查看单桩
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-blue-100">
                <Activity className="h-3 w-3" />
                {myPiles.length} piles
              </span>
            </header>
            <div className="px-4 py-4">
              <PileTable
                piles={myPiles}
                onRowClick={(p) => navigate(`/city/piles/${p.id}`)}
              />
            </div>
          </section>

          {/* Revenue + Benchmark */}
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <RevenueCard
              operatorId={operatorId}
              pileCount={myPiles.length}
              accentColor={me?.color ?? '#2563EB'}
            />
            <BenchmarkRadar
              rows={compliance.data?.rows ?? []}
              meId={operatorId}
            />
          </section>

          <p className="text-[11px] text-saas-text-light">
            数据源 · /api/piles + /api/events + /api/stats/operator-compliance
            · WS 1Hz live merge · revenue 为演示用 mock。
          </p>
        </div>
      </main>
    </div>
  )
}

function Legend({
  tone,
  label,
}: {
  tone: 'emerald' | 'cyan' | 'amber' | 'rose' | 'slate'
  label: string
}) {
  const dot = {
    emerald: 'bg-emerald-500',
    cyan: 'bg-cyan-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    slate: 'bg-slate-400',
  }[tone]
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
      {label}
    </span>
  )
}
