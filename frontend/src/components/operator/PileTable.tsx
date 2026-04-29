import { useMemo, useState } from 'react'
import { ArrowDownNarrowWide, ArrowUpNarrowWide } from 'lucide-react'

import type { Pile } from '@/api/piles'
import { pileStatusColor } from '@/design-tokens'
import { cn, formatPct, formatPower } from '@/lib/utils'

type SortKey = 'id' | 'region_id' | 'current_status' | 'current_power' | 'current_occupancy'

interface PileTableProps {
  piles: Pile[]
  /** Optional per-row click — usually navigates to /city/piles/:id. */
  onRowClick?: (pile: Pile) => void
}

const STATUS_LABEL: Record<string, string> = {
  idle: '空闲',
  charging: '充电中',
  occupied: '占用',
  fault: '故障',
  offline: '离线',
}

const STATUS_FILTERS = ['all', 'idle', 'charging', 'occupied', 'fault', 'offline'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

export function PileTable({ piles, onRowClick }: PileTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('current_occupancy')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filter, setFilter] = useState<StatusFilter>('all')

  const filtered = useMemo(() => {
    if (filter === 'all') return piles
    return piles.filter((p) => p.current_status === filter)
  }, [piles, filter])

  const sorted = useMemo(() => {
    const list = [...filtered]
    list.sort((a, b) => {
      const av = a[sortKey] as string | number
      const bv = b[sortKey] as string | number
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
    return list
  }, [filtered, sortKey, sortDir])

  const onSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: piles.length }
    for (const p of piles) {
      c[p.current_status] = (c[p.current_status] ?? 0) + 1
    }
    return c
  }, [piles])

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {STATUS_FILTERS.map((s) => {
          const active = filter === s
          const label = s === 'all' ? '全部' : STATUS_LABEL[s] ?? s
          const n = counts[s] ?? 0
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors',
                active
                  ? 'border-saas-accent bg-saas-accent text-white'
                  : 'border-saas-border bg-white text-saas-text-mid hover:border-saas-accent/40 hover:text-saas-text-dark',
              )}
            >
              {s !== 'all' ? (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: pileStatusColor[s] }}
                />
              ) : null}
              <span>{label}</span>
              <span
                className={cn(
                  'tabular-nums text-[10px]',
                  active ? 'text-white/80' : 'text-saas-text-light',
                )}
              >
                {n}
              </span>
            </button>
          )
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-saas-border text-left text-xs uppercase tracking-wider text-saas-text-mid">
              <SortableTh active={sortKey === 'id'} dir={sortDir} onClick={() => onSort('id')}>
                Pile ID
              </SortableTh>
              <SortableTh
                active={sortKey === 'region_id'}
                dir={sortDir}
                onClick={() => onSort('region_id')}
              >
                区域
              </SortableTh>
              <SortableTh
                active={sortKey === 'current_status'}
                dir={sortDir}
                onClick={() => onSort('current_status')}
              >
                状态
              </SortableTh>
              <SortableTh
                active={sortKey === 'current_power'}
                dir={sortDir}
                onClick={() => onSort('current_power')}
              >
                当前功率
              </SortableTh>
              <SortableTh
                active={sortKey === 'current_occupancy'}
                dir={sortDir}
                onClick={() => onSort('current_occupancy')}
              >
                24h 占用
              </SortableTh>
              <th className="px-3 py-2.5 text-right font-medium">详情</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-saas-text-light"
                >
                  没有匹配的桩 · No piles match this filter
                </td>
              </tr>
            ) : (
              sorted.slice(0, 60).map((p) => {
                const color = pileStatusColor[p.current_status]
                return (
                  <tr
                    key={p.id}
                    onClick={() => onRowClick?.(p)}
                    className={cn(
                      'border-b border-saas-border/70 transition-colors',
                      onRowClick && 'cursor-pointer hover:bg-saas-bg-alt',
                    )}
                  >
                    <td className="px-3 py-2.5 font-mono text-xs">{p.id.slice(0, 14)}</td>
                    <td className="px-3 py-2.5 text-saas-text-mid">{p.region_id}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-saas-text-dark">
                          {STATUS_LABEL[p.current_status] ?? p.current_status}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {formatPower(p.current_power)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-saas-bg-alt">
                          <span
                            className="block h-full rounded-full bg-saas-accent"
                            style={{
                              width: `${Math.min(100, Math.round(p.current_occupancy * 100))}%`,
                            }}
                          />
                        </span>
                        <span className="text-saas-text-mid">
                          {formatPct(p.current_occupancy)}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs text-saas-accent">
                      查看 →
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        {sorted.length > 60 ? (
          <p className="px-3 py-2 text-[11px] text-saas-text-light">
            Showing first 60 of {sorted.length} piles · 显示前 60 条
          </p>
        ) : null}
      </div>
    </div>
  )
}

function SortableTh({
  children,
  active,
  dir,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
}) {
  return (
    <th
      onClick={onClick}
      className={cn(
        'cursor-pointer select-none px-3 py-2.5 font-medium transition-colors',
        active ? 'text-saas-accent' : 'hover:text-saas-text-dark',
      )}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active ? (
          dir === 'asc' ? (
            <ArrowUpNarrowWide className="h-3 w-3" />
          ) : (
            <ArrowDownNarrowWide className="h-3 w-3" />
          )
        ) : null}
      </span>
    </th>
  )
}
