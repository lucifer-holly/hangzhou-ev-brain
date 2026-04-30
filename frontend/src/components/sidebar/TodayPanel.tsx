/**
 * Sidebar "Today" mini-stats panel.
 *
 * Numbers are derived deterministically from the cached pile snapshot so
 * they remain stable across renders without round-tripping the backend
 * for additional aggregates. Spawn 9.7 follow-up: now also surfaces the
 * online-pile count since the SystemStatusPanel (which used to carry
 * realtime/connection info) was removed for being redundant with the
 * topbar StatusBadges.
 *
 *   - 在线桩    : count of piles where current_status != 'offline'
 *   - 充电次数  : count of piles × ~130 sessions/day baseline
 *                 (proxy: synthesized from current_occupancy)
 *   - 总能量    : sum of (capacity_kw × occupancy × 6h) for a rough MWh
 *   - 异常事件  : count of fault/offline piles in the snapshot
 */

import { useMemo } from 'react'
import CountUp from 'react-countup'

import { usePiles } from '@/hooks/usePiles'

export function TodayPanel() {
  const piles = usePiles()

  const stats = useMemo(() => {
    const list = piles.data ?? []
    if (list.length === 0) {
      return { online: 0, total: 0, sessions: 0, energyMWh: 0, anomalies: 0 }
    }
    const online = list.filter((p) => p.current_status !== 'offline').length
    const sessions = list.reduce(
      (s, p) => s + Math.round(120 + p.current_occupancy * 80),
      0,
    )
    const energyKWh = list.reduce(
      (s, p) => s + p.capacity_kw * p.current_occupancy * 6,
      0,
    )
    const anomalies = list.filter(
      (p) => p.current_status === 'fault' || p.current_status === 'offline',
    ).length
    return {
      online,
      total: list.length,
      sessions,
      energyMWh: Math.round(energyKWh / 100) / 10,
      anomalies,
    }
  }, [piles.data])

  return (
    <div className="rounded-md border border-ioc-border/40 bg-ioc-deep/50 px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between text-[9px] uppercase tracking-[0.2em] text-ioc-text-muted">
        <span>Today · 今日</span>
        <span className="font-mono text-ioc-text-muted/60">live</span>
      </div>
      <ul className="flex flex-col gap-1 text-[11px]">
        <Row
          label="在线桩"
          value={stats.online}
          suffix={stats.total ? ` / ${stats.total}` : ''}
          tone="success"
        />
        <Row label="充电次数" value={stats.sessions} suffix="" />
        <Row label="总能量" value={stats.energyMWh} decimals={1} suffix=" MWh" />
        <Row label="异常事件" value={stats.anomalies} suffix="" tone="warning" />
      </ul>
    </div>
  )
}

function Row({
  label,
  value,
  decimals = 0,
  suffix = '',
  tone = 'cyan',
}: {
  label: string
  value: number
  decimals?: number
  suffix?: string
  tone?: 'cyan' | 'warning' | 'success'
}) {
  const toneCls =
    tone === 'warning'
      ? 'font-mono tabular-nums text-ioc-warning'
      : tone === 'success'
        ? 'font-mono tabular-nums text-ioc-success'
        : 'font-mono tabular-nums text-ioc-cyan'
  return (
    <li className="flex items-center justify-between text-ioc-text-secondary">
      <span>{label}</span>
      <span className={toneCls}>
        <CountUp end={value} duration={1.2} decimals={decimals} separator="," />
        {suffix}
      </span>
    </li>
  )
}
