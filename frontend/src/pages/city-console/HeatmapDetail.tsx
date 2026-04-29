import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Clock, MapPinned, TrendingUp } from 'lucide-react'

import type { Pile } from '@/api/piles'
import { useDemandForecast } from '@/hooks/useDemandForecast'
import { useOperators, useRegions } from '@/hooks/useOperators'
import { usePiles } from '@/hooks/usePiles'
import { usePileSnapshot } from '@/hooks/useStats'
import { useWebSocket } from '@/hooks/useWebSocket'
import { CityMap } from '@/components/map/CityMap'
import { TechBorder } from '@/components/ioc/TechBorder'
import { cn, formatPct } from '@/lib/utils'

import { DetailHeader } from './_shared/DetailHeader'
import { SaasCard } from './_shared/SaasCard'

type Mode = 'realtime' | 'history' | 'predict'

const MODE_OPTIONS: { value: Mode; label: string; sub: string }[] = [
  { value: 'realtime', label: '实时 Realtime', sub: 'WS · 1Hz' },
  { value: 'history', label: '历史 History', sub: '24h time slider' },
  { value: 'predict', label: '预测 Predict', sub: '+1h LSTM' },
]

const REGION_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: '全市' },
  { value: 'future_tech_city', label: '未来科技城' },
  { value: 'qiantang_new_area', label: '钱塘新区' },
]

function hourOffsetIso(hoursBack: number): string {
  const now = new Date()
  now.setMinutes(0, 0, 0)
  now.setHours(now.getHours() - hoursBack)
  return now.toISOString().slice(0, 19)
}

export function HeatmapDetail() {
  const navigate = useNavigate()
  const piles = usePiles()
  const operators = useOperators()
  const regions = useRegions()
  const { latestTelemetry, isConnected } = useWebSocket()
  const [mode, setMode] = useState<Mode>('realtime')
  const [region, setRegion] = useState<string>('all')
  const [hoursBack, setHoursBack] = useState<number>(0)

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

  const snapshotAt = mode === 'history' && hoursBack > 0 ? hourOffsetIso(hoursBack) : null
  const snapshot = usePileSnapshot(snapshotAt)
  const forecast = useDemandForecast(1, mode === 'predict')

  const displayPiles: Pile[] = useMemo(() => {
    let base: Pile[] = livePiles
    if (mode === 'history' && snapshot.data?.snapshots) {
      const map = new Map(snapshot.data.snapshots.map((s) => [s.pile_id, s]))
      base = livePiles.map((p) => {
        const s = map.get(p.id)
        if (!s) return p
        return {
          ...p,
          current_status: s.status as typeof p.current_status,
          current_voltage: s.voltage,
          current_current: s.current,
          current_power: s.power,
          current_occupancy: s.occupancy_rate,
        }
      })
    } else if (mode === 'predict') {
      base = livePiles.map((p) => {
        const f = forecast.byPileId[p.id]
        if (!f) return p
        return { ...p, current_occupancy: f.predicted_occupancy }
      })
    }
    if (region !== 'all') base = base.filter((p) => p.region_id === region)
    return base
  }, [livePiles, mode, snapshot.data, forecast.byPileId, region])

  const regionStats = useMemo(() => {
    const map = new Map<
      string,
      { count: number; occSum: number; powerSum: number; faults: number }
    >()
    for (const p of displayPiles) {
      const cur = map.get(p.region_id) ?? {
        count: 0,
        occSum: 0,
        powerSum: 0,
        faults: 0,
      }
      cur.count += 1
      cur.occSum += p.current_occupancy ?? 0
      cur.powerSum += p.current_power ?? 0
      if (p.current_status === 'fault') cur.faults += 1
      map.set(p.region_id, cur)
    }
    return [...map.entries()].map(([region_id, agg]) => ({
      region_id,
      count: agg.count,
      avg_occ: agg.occSum / Math.max(1, agg.count),
      total_power: agg.powerSum,
      faults: agg.faults,
    }))
  }, [displayPiles])

  const kpis = useMemo(() => {
    const total = displayPiles.length
    const online = displayPiles.filter((p) => p.current_status !== 'offline').length
    const power = displayPiles.reduce((s, p) => s + (p.current_power ?? 0), 0)
    const avgOcc =
      total > 0
        ? displayPiles.reduce((s, p) => s + (p.current_occupancy ?? 0), 0) / total
        : 0
    const fault = displayPiles.filter((p) => p.current_status === 'fault').length
    return { total, online, power, avgOcc, fault }
  }, [displayPiles])

  const sliderTimeout = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (sliderTimeout.current) window.clearTimeout(sliderTimeout.current)
    },
    [],
  )

  const regionLabel = (id: string) =>
    regions.data?.find((r) => r.id === id)?.name_zh ?? id

  const sliderTime = useMemo(() => {
    if (hoursBack <= 0) return 'now'
    const d = new Date()
    d.setMinutes(0, 0, 0)
    d.setHours(d.getHours() - hoursBack)
    return d.toLocaleString('zh-CN', { hour12: false })
  }, [hoursBack])

  return (
    <div className="min-h-full bg-saas-bg-alt p-5 text-saas-text-dark">
      <DetailHeader
        eyebrow="01 · Heatmap"
        title="全城供需热力 · KDE + LSTM"
        subtitle="深色 IOC 地图（视觉锚点）+ 实时 / 历史 / 预测三模式 + 24h 时间滑块"
        right={
          <div className="flex items-center gap-2">
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="rounded-md border border-saas-border bg-white px-3 py-1.5 text-xs text-saas-text-dark"
            >
              {REGION_FILTERS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <div className="flex overflow-hidden rounded-md border border-saas-border bg-white">
              {MODE_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => {
                    setMode(m.value)
                    if (m.value === 'history' && hoursBack === 0) setHoursBack(6)
                  }}
                  className={cn(
                    'flex flex-col items-start px-3 py-1.5 text-xs font-medium transition-colors',
                    mode === m.value
                      ? 'bg-saas-accent text-white'
                      : 'text-saas-text-mid hover:bg-saas-bg-alt',
                  )}
                >
                  <span>{m.label}</span>
                  <span
                    className={cn(
                      'text-[9px]',
                      mode === m.value ? 'text-white/80' : 'text-saas-text-light',
                    )}
                  >
                    {m.sub}
                  </span>
                </button>
              ))}
            </div>
          </div>
        }
      />

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Total piles"
          value={kpis.total.toString()}
          sub={`${kpis.online} online`}
          icon={<MapPinned className="h-4 w-4" />}
        />
        <KpiTile
          label="Live power"
          value={`${(kpis.power / 1000).toFixed(2)} MW`}
          sub={`${kpis.power.toFixed(0)} kW total`}
          icon={<Activity className="h-4 w-4" />}
        />
        <KpiTile
          label="Avg utilization"
          value={formatPct(kpis.avgOcc, 1)}
          sub={
            mode === 'predict' ? 'forecast +1h' : mode === 'history' ? sliderTime : 'live'
          }
          icon={<TrendingUp className="h-4 w-4" />}
          tone={mode === 'predict' ? 'accent' : 'default'}
        />
        <KpiTile
          label="Faulted"
          value={kpis.fault.toString()}
          sub={kpis.fault === 0 ? 'no active faults' : 'active faults'}
          icon={<Clock className="h-4 w-4" />}
          tone={kpis.fault > 0 ? 'danger' : 'default'}
        />
      </section>

      <section className="mt-4 grid min-h-[520px] grid-cols-1 gap-3 lg:grid-cols-[2.4fr_1fr]">
        <TechBorder>
          <div className="relative flex h-[520px] flex-col">
            <div className="flex items-center justify-between border-b border-ioc-border/50 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-ioc-text-secondary">
              <span>
                Hangzhou Heatmap · 杭州供需热力图
                {mode === 'predict' ? (
                  <span className="ml-2 text-ioc-blue">[FORECAST]</span>
                ) : mode === 'history' ? (
                  <span className="ml-2 text-ioc-text-muted">[HISTORY · {sliderTime}]</span>
                ) : null}
              </span>
              <span className="font-mono text-[10px] text-ioc-text-muted">
                {displayPiles.length} piles ·{' '}
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
            {snapshot.isLoading && mode === 'history' ? (
              <div className="absolute right-3 top-9 rounded-md bg-ioc-deep/80 px-3 py-1.5 font-mono text-[10px] text-ioc-cyan">
                fetching snapshot…
              </div>
            ) : null}
          </div>
        </TechBorder>

        <div className="flex flex-col gap-3">
          <SaasCard title="区域统计 · Region stats">
            <div className="space-y-2">
              {regionStats.length === 0 ? (
                <div className="text-sm text-saas-text-light">no data</div>
              ) : (
                regionStats.map((r) => (
                  <button
                    key={r.region_id}
                    onClick={() => setRegion(region === r.region_id ? 'all' : r.region_id)}
                    className={cn(
                      'w-full rounded-md border px-3 py-2 text-left transition-colors',
                      region === r.region_id
                        ? 'border-saas-accent bg-saas-accent/5'
                        : 'border-saas-border hover:bg-saas-bg-alt',
                    )}
                  >
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>{regionLabel(r.region_id)}</span>
                      <span className="tabular-nums text-saas-text-mid">{r.count} 桩</span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-3 text-[11px] text-saas-text-mid">
                      <div>
                        <div className="text-saas-text-light">平均占用</div>
                        <div className="tabular-nums text-saas-text-dark">
                          {formatPct(r.avg_occ, 1)}
                        </div>
                      </div>
                      <div>
                        <div className="text-saas-text-light">实时功率</div>
                        <div className="tabular-nums text-saas-text-dark">
                          {(r.total_power / 1000).toFixed(2)} MW
                        </div>
                      </div>
                      <div>
                        <div className="text-saas-text-light">故障</div>
                        <div className="tabular-nums text-saas-text-dark">{r.faults}</div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </SaasCard>

          <SaasCard title="图例 · Legend">
            <div className="space-y-2 text-xs">
              <LegendRow color="#00FF94" label="idle · 空闲" />
              <LegendRow color="#00D4FF" label="charging · 充电中" />
              <LegendRow color="#FFB800" label="occupied · 满员" />
              <LegendRow color="#FF6B35" label="fault · 故障" />
              <LegendRow color="#5A6680" label="offline · 离线" />
              <div className="mt-3 border-t border-saas-border pt-2 text-saas-text-mid">
                <div>热力色相 · 利用率 (KDE)</div>
                <div className="mt-1 h-2 w-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500" />
                <div className="mt-1 flex justify-between text-[10px]">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>
              <p className="mt-3 text-[10px] text-saas-text-light">
                {operators.data?.length ?? 0} operators · {regions.data?.length ?? 0}{' '}
                regions tracked
              </p>
            </div>
          </SaasCard>
        </div>
      </section>

      {mode === 'history' ? (
        <SaasCard
          className="mt-4"
          title="时间滑块 · 24h history slider"
          accessory={
            <span className="font-mono text-[11px] text-saas-text-light">
              snapshot @ {sliderTime}
            </span>
          }
        >
          <div className="px-2">
            <input
              type="range"
              min={0}
              max={24}
              step={1}
              value={hoursBack}
              onChange={(e) => setHoursBack(Number(e.target.value))}
              className="w-full accent-saas-accent"
            />
            <div className="mt-1 flex justify-between text-[10px] text-saas-text-mid">
              <span>now</span>
              <span>-6h</span>
              <span>-12h</span>
              <span>-18h</span>
              <span>-24h</span>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-saas-text-mid">
            滑动选取过去 24 小时任一整点。后端按整点对齐到最近 telemetry 行（hourly
            序列）。桩点颜色与利用率会随快照同步切换。
          </p>
        </SaasCard>
      ) : null}

      {mode === 'predict' ? (
        <SaasCard
          className="mt-4"
          title="LSTM 预测 · +1h forecast"
          accessory={
            <span className="font-mono text-[11px] text-saas-text-light">
              {forecast.loading
                ? '加载中…'
                : forecast.error
                  ? `error: ${forecast.error}`
                  : `${forecast.pileCount} piles · 置信度 ${(forecast.averageConfidence * 100).toFixed(0)}%`}
            </span>
          }
        >
          <p className="text-[11px] text-saas-text-mid">
            一次性批量预测 100 桩未来 1 小时利用率（24×8 LSTM 单次前向传播）。
            平均预测利用率：
            <strong className="ml-1 text-saas-accent">
              {(forecast.averageOccupancy * 100).toFixed(1)}%
            </strong>
            。地图显示预测值；切回 realtime 即恢复 WS 实时。
          </p>
        </SaasCard>
      ) : null}
    </div>
  )
}

function KpiTile({
  label,
  value,
  sub,
  icon,
  tone = 'default',
}: {
  label: string
  value: string
  sub?: string
  icon?: React.ReactNode
  tone?: 'default' | 'accent' | 'danger'
}) {
  const toneCls = {
    default: 'border-saas-border bg-white',
    accent: 'border-saas-accent/40 bg-saas-accent/5',
    danger: 'border-rose-200 bg-rose-50',
  }[tone]
  return (
    <div className={cn('rounded-lg border p-4 shadow-sm', toneCls)}>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-saas-text-mid">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 font-title text-2xl font-bold tabular-nums">{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-saas-text-light">{sub}</div> : null}
    </div>
  )
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-saas-text-mid">{label}</span>
    </div>
  )
}
