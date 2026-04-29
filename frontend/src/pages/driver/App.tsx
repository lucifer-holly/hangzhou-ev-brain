import { useEffect, useMemo, useState } from 'react'
import { Bookmark, Car, List, Map as MapIcon, Network, Search } from 'lucide-react'
import { toast } from 'sonner'

import type { Operator } from '@/api/operators'
import type { Pile } from '@/api/piles'
import { useDemandForecast } from '@/hooks/useDemandForecast'
import { useOperators } from '@/hooks/useOperators'
import { usePiles } from '@/hooks/usePiles'
import { useWebSocket } from '@/hooks/useWebSocket'
import { LiveClock } from '@/components/ioc/LiveClock'
import { PulseDot } from '@/components/ioc/PulseDot'
import { RoleSwitcher } from '@/components/ioc/RoleSwitcher'
import { MapProvider, type MapMarker } from '@/components/map/MapProvider'
import { PileCard } from '@/components/driver/PileCard'
import { cn } from '@/lib/utils'

/**
 * Mock driver location — Hangzhou Future Sci-Tech City core.
 * Real prod would come from `navigator.geolocation`; the demo
 * intentionally keeps it deterministic.
 */
const MY_LOCATION = { lat: 30.275, lng: 120.03 } as const

/** Per-operator base price ¥/kWh (mock — real billing isn't modeled). */
const PRICE_BY_OPERATOR: Record<string, number> = {
  state_grid: 1.18,
  teld: 1.32,
  starcharge: 1.25,
  nio: 1.45,
}

type ViewMode = 'map' | 'list' | 'me'

export function DriverApp() {
  const allPiles = usePiles()
  const operators = useOperators()
  const { isConnected, latestTelemetry } = useWebSocket()
  const forecast = useDemandForecast(1, true) // always-on LSTM batch
  const [view, setView] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [reservations, setReservations] = useState<string[]>([])

  // Live-merge piles with WS telemetry.
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

  const operatorList = operators.data
  const operatorById = useMemo(() => {
    const m = new Map<string, Operator>()
    for (const o of operatorList ?? []) m.set(o.id, o)
    return m
  }, [operatorList])

  // Decorate piles with distance + predicted wait, then sort+slice.
  const decoratedPiles = useMemo(() => {
    const out = livePiles.map((p) => {
      const distanceKm = haversineKm(MY_LOCATION.lat, MY_LOCATION.lng, p.lat, p.lng)
      const lstm = forecast.byPileId[p.id]
      const occ = lstm ? lstm.predicted_occupancy : p.current_occupancy
      // Wait time heuristic: idle pile → ~0; occupied pile → up to 30 min
      // scaled by predicted occupancy.
      let waitMinutes = occ * 30
      if (p.current_status === 'idle') waitMinutes = Math.max(0, waitMinutes - 4)
      if (p.current_status === 'fault' || p.current_status === 'offline') {
        waitMinutes = 999
      }
      return {
        pile: p,
        distanceKm,
        waitMinutes,
        waitSource: (lstm ? 'lstm' : 'occupancy') as 'lstm' | 'occupancy',
      }
    })
    out.sort((a, b) => a.distanceKm - b.distanceKm)
    return out
  }, [livePiles, forecast.byPileId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = decoratedPiles.slice(0, 20)
    if (!q) return list
    return list.filter((d) => {
      const op = operatorById.get(d.pile.operator_id)
      const opName = op?.name_zh.toLowerCase() ?? ''
      return (
        d.pile.id.toLowerCase().includes(q) ||
        opName.includes(q) ||
        d.pile.region_id.toLowerCase().includes(q)
      )
    })
  }, [decoratedPiles, search, operatorById])

  // One-time toast confirming LSTM call succeeded.
  useEffect(() => {
    if (!forecast.generatedAt) return
    if (forecast.error) return
    toast('LSTM 预测加载完成', {
      description: `${forecast.pileCount} piles · 平均占用 ${(forecast.averageOccupancy * 100).toFixed(0)}% · 用于预测等待时间`,
      duration: 2400,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecast.generatedAt])

  const onReserve = (pile: Pile) => {
    setReservations((cur) =>
      cur.includes(pile.id) ? cur : [pile.id, ...cur].slice(0, 5),
    )
    toast.success(`预约成功 (演示) · ${pile.id.slice(0, 12)}`, {
      description: '已为您保留 30 分钟。到达后扫码即可充电。',
      duration: 3000,
    })
  }

  const onNavigate = (pile: Pile) => {
    toast(`已发送至高德导航`, {
      description: `${pile.id.slice(0, 12)} · ${pile.capacity_kw.toFixed(0)} kW`,
      duration: 2200,
    })
  }

  const mapMarkers: MapMarker[] = useMemo(() => {
    const items: MapMarker[] = filtered.map((d) => ({
      id: d.pile.id,
      lat: d.pile.lat,
      lng: d.pile.lng,
      status: d.pile.current_status,
      label: `${d.pile.id.slice(0, 12)} · ${d.distanceKm.toFixed(1)} km`,
    }))
    items.push({
      id: '__me',
      lat: MY_LOCATION.lat,
      lng: MY_LOCATION.lng,
      status: 'charging',
      label: '我的位置',
    })
    return items
  }, [filtered])

  const onMarkerClick = (m: MapMarker) => {
    if (m.id === '__me') return
    const d = filtered.find((x) => x.pile.id === m.id)
    if (!d) return
    setView('list')
    toast(`查看 ${m.id.slice(0, 12)}`, {
      description: `距离 ${d.distanceKm.toFixed(1)} km · 等待约 ${Math.round(d.waitMinutes)} 分钟`,
      duration: 2200,
    })
  }

  return (
    <div className="flex min-h-screen w-screen items-stretch justify-center bg-slate-100">
      {/* Phone-frame container — centered on desktop, full-width on mobile */}
      <div className="flex w-full max-w-[480px] flex-col bg-saas-bg-alt shadow-xl ring-1 ring-saas-border sm:my-4 sm:rounded-3xl">
        {/* Top bar (IOC dark, mini) */}
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-ioc-border bg-ioc-deep px-4 py-2.5 sm:rounded-t-3xl">
          <div className="flex items-center gap-2 truncate">
            <Network className="h-4 w-4 shrink-0 text-ioc-cyan" />
            <span className="font-title text-xs font-bold uppercase tracking-[0.2em] text-ioc-cyan">
              HZ-EV
            </span>
            <span className="text-[10px] text-ioc-text-secondary">车主端</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-ioc-text-secondary">
            <PulseDot tone={isConnected ? 'success' : 'danger'} size="sm" />
            <LiveClock tz="Asia/Shanghai" />
            <RoleSwitcher current="driver" />
          </div>
        </header>

        {/* Hero greeting */}
        <div className="shrink-0 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 px-5 pt-4 pb-5 text-white">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider opacity-80">
            <Car className="h-3.5 w-3.5" />
            Driver · 司机
          </div>
          <h1 className="mt-1 text-xl font-semibold">附近充电桩</h1>
          <p className="mt-0.5 text-[12px] opacity-85">
            未来科技城 · {filtered.length} 个推荐
            {forecast.loading ? ' · 加载预测…' : ''}
          </p>

          {/* Search */}
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-2 ring-1 ring-white/25 backdrop-blur">
            <Search className="h-4 w-4 opacity-80" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索桩 ID / 运营商 / 区域"
              className="w-full bg-transparent text-sm text-white placeholder-white/65 focus:outline-none"
            />
            {search ? (
              <button
                onClick={() => setSearch('')}
                className="text-[11px] opacity-80 hover:opacity-100"
              >
                清除
              </button>
            ) : null}
          </div>
        </div>

        {/* View body */}
        <main className="flex-1 overflow-y-auto pb-20">
          {view === 'map' ? (
            <div className="relative h-[calc(100vh-260px)] min-h-[420px]">
              <MapProvider
                theme="light"
                center={MY_LOCATION}
                zoom={13}
                markers={mapMarkers}
                onMarkerClick={onMarkerClick}
              />
              <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1 text-[11px] font-medium text-saas-text-dark shadow ring-1 ring-saas-border">
                附近 {filtered.length} 个 · 排序按距离
              </div>
            </div>
          ) : view === 'list' ? (
            <div className="space-y-3 px-4 pt-4">
              {forecast.error ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                  LSTM forecast unavailable — falling back to live occupancy:
                  {' '}
                  {forecast.error}
                </div>
              ) : null}
              {filtered.length === 0 ? (
                <div className="rounded-2xl border border-saas-border bg-white p-8 text-center text-sm text-saas-text-light">
                  没有匹配的桩 · No matches
                </div>
              ) : (
                filtered.map((d) => {
                  const op = operatorById.get(d.pile.operator_id)
                  const price = PRICE_BY_OPERATOR[d.pile.operator_id] ?? 1.2
                  return (
                    <PileCard
                      key={d.pile.id}
                      pile={d.pile}
                      operatorName={op?.name_zh ?? d.pile.operator_id}
                      operatorColor={op?.color ?? '#2563EB'}
                      distanceKm={d.distanceKm}
                      waitMinutes={d.waitMinutes}
                      waitSource={d.waitSource}
                      pricePerKwh={price}
                      onNavigate={() => onNavigate(d.pile)}
                      onReserve={() => onReserve(d.pile)}
                    />
                  )
                })
              )}
              <p className="px-1 pt-2 text-center text-[10px] text-saas-text-light">
                LSTM batch forecast · /api/stats/predicted-utilization
              </p>
            </div>
          ) : (
            <ReservationsView
              reservationIds={reservations}
              piles={livePiles}
              operatorById={operatorById}
              onClear={() => setReservations([])}
            />
          )}
        </main>

        {/* Bottom tab bar */}
        <nav
          className="sticky bottom-0 z-10 flex shrink-0 items-stretch border-t border-saas-border bg-white sm:rounded-b-3xl"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <TabButton
            active={view === 'map'}
            onClick={() => setView('map')}
            icon={MapIcon}
            label="地图"
          />
          <TabButton
            active={view === 'list'}
            onClick={() => setView('list')}
            icon={List}
            label="列表"
          />
          <TabButton
            active={view === 'me'}
            onClick={() => setView('me')}
            icon={Bookmark}
            label="我的预约"
            badge={reservations.length}
          />
        </nav>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  badge,
}: {
  active: boolean
  onClick: () => void
  icon: typeof MapIcon
  label: string
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] transition-colors',
        active ? 'text-saas-accent' : 'text-saas-text-mid hover:text-saas-text-dark',
      )}
    >
      <Icon className={cn('h-5 w-5', active && 'fill-saas-accent/15')} />
      <span className={cn('font-medium', active && 'font-semibold')}>{label}</span>
      {badge && badge > 0 ? (
        <span className="absolute right-[28%] top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
          {badge}
        </span>
      ) : null}
      {active ? (
        <span className="absolute inset-x-6 top-0 h-0.5 rounded-b-full bg-saas-accent" />
      ) : null}
    </button>
  )
}

function ReservationsView({
  reservationIds,
  piles,
  operatorById,
  onClear,
}: {
  reservationIds: string[]
  piles: Pile[]
  operatorById: Map<string, Operator>
  onClear: () => void
}) {
  if (reservationIds.length === 0) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 px-8 text-center">
        <Bookmark className="h-10 w-10 text-saas-text-light" />
        <h3 className="text-base font-semibold text-saas-text-dark">还没有预约</h3>
        <p className="text-sm text-saas-text-mid">
          在列表中点击 <span className="font-semibold text-saas-accent">预约</span>{' '}
          可以为您保留 30 分钟充电位。
        </p>
        <p className="text-[11px] text-saas-text-light">演示功能 · 不写入后端</p>
      </div>
    )
  }
  return (
    <div className="space-y-3 px-4 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-saas-text-dark">
          我的预约 · {reservationIds.length}
        </h3>
        <button
          onClick={onClear}
          className="text-[11px] text-saas-accent hover:underline"
        >
          清空
        </button>
      </div>
      {reservationIds.map((id) => {
        const p = piles.find((x) => x.id === id)
        const op = p ? operatorById.get(p.operator_id) : null
        return (
          <div
            key={id}
            className="rounded-2xl border border-saas-border bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 text-xs text-saas-text-mid">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: op?.color ?? '#94A3B8' }}
              />
              {op?.name_zh ?? '?'}
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                已保留 30 分钟
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="font-mono text-sm text-saas-text-dark">
                {id.slice(0, 14)}
              </span>
              {p ? (
                <span className="text-xs text-saas-text-mid">
                  {p.capacity_kw.toFixed(0)} kW · {p.connector_type}
                </span>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // km
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}
