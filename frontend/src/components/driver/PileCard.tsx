import { Bookmark, Clock, MapPin, Navigation, Plug, Zap } from 'lucide-react'

import type { Pile } from '@/api/piles'
import { pileStatusColor } from '@/design-tokens'
import { cn } from '@/lib/utils'

interface PileCardProps {
  pile: Pile
  operatorName: string
  operatorColor: string
  /** Distance to driver in km. */
  distanceKm: number
  /** Predicted minutes until a port frees up. */
  waitMinutes: number
  waitSource: 'lstm' | 'occupancy'
  pricePerKwh: number
  onNavigate: () => void
  onReserve: () => void
}

const STATUS_LABEL: Record<string, string> = {
  idle: '空闲',
  charging: '充电中',
  occupied: '占用',
  fault: '故障',
  offline: '离线',
}

const STATUS_BG: Record<string, string> = {
  idle: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  charging: 'bg-cyan-100 text-cyan-700 ring-cyan-200',
  occupied: 'bg-amber-100 text-amber-700 ring-amber-200',
  fault: 'bg-rose-100 text-rose-700 ring-rose-200',
  offline: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export function PileCard({
  pile,
  operatorName,
  operatorColor,
  distanceKm,
  waitMinutes,
  waitSource,
  pricePerKwh,
  onNavigate,
  onReserve,
}: PileCardProps) {
  const dotColor = pileStatusColor[pile.current_status]
  const isReservable = pile.current_status !== 'fault' && pile.current_status !== 'offline'

  return (
    <article className="overflow-hidden rounded-2xl border border-saas-border bg-white shadow-sm">
      <header className="flex items-start justify-between gap-3 px-4 pt-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] font-medium text-saas-text-mid">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: operatorColor }}
            />
            <span className="truncate">{operatorName}</span>
            <span className="text-saas-text-light">·</span>
            <span className="font-mono text-saas-text-light">
              {pile.id.slice(0, 12)}
            </span>
          </div>
          <h3 className="mt-1 flex items-center gap-2 text-base font-semibold text-saas-text-dark">
            <Plug className="h-4 w-4 text-saas-accent" />
            {pile.capacity_kw.toFixed(0)} kW · {pile.connector_type}
          </h3>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
            STATUS_BG[pile.current_status],
          )}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: dotColor }}
          />
          {STATUS_LABEL[pile.current_status] ?? pile.current_status}
        </span>
      </header>

      <div className="grid grid-cols-3 gap-2 px-4 py-3">
        <Stat
          icon={MapPin}
          tone="blue"
          label="距离"
          value={
            distanceKm < 1
              ? `${(distanceKm * 1000).toFixed(0)} m`
              : `${distanceKm.toFixed(1)} km`
          }
        />
        <Stat
          icon={Clock}
          tone={waitMinutes < 5 ? 'emerald' : waitMinutes < 15 ? 'amber' : 'rose'}
          label={waitSource === 'lstm' ? '预测等待 (LSTM)' : '预测等待'}
          value={waitMinutes < 1 ? '< 1 min' : `${Math.round(waitMinutes)} min`}
        />
        <Stat
          icon={Zap}
          tone="amber"
          label="电价"
          value={`¥${pricePerKwh.toFixed(2)}/kWh`}
        />
      </div>

      <div className="flex items-center gap-2 border-t border-saas-border bg-saas-bg-alt/40 px-3 py-2.5">
        <button
          onClick={onNavigate}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-saas-border bg-white text-sm font-medium text-saas-text-dark active:bg-saas-bg-alt"
        >
          <Navigation className="h-4 w-4" />
          导航
        </button>
        <button
          disabled={!isReservable}
          onClick={onReserve}
          className={cn(
            'inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-medium',
            isReservable
              ? 'bg-saas-accent text-white shadow-sm active:bg-saas-accent/90'
              : 'cursor-not-allowed bg-slate-200 text-slate-400',
          )}
        >
          <Bookmark className="h-4 w-4" />
          预约
        </button>
      </div>
    </article>
  )
}

function Stat({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: typeof MapPin
  tone: 'blue' | 'emerald' | 'amber' | 'rose'
  label: string
  value: string
}) {
  const toneCls = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  }[tone]
  return (
    <div className="flex items-center gap-2">
      <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-lg', toneCls)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <div className="truncate text-[10px] uppercase tracking-wider text-saas-text-light">
          {label}
        </div>
        <div className="truncate text-xs font-semibold tabular-nums text-saas-text-dark">
          {value}
        </div>
      </div>
    </div>
  )
}
