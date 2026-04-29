import { useMemo, useState } from 'react'
import { ArrowDownNarrowWide, ArrowUpNarrowWide, FileDown, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import type { ComplianceWindow, OperatorComplianceRow } from '@/api/stats'
import { Button } from '@/components/ui/button'
import { useOperatorCompliance } from '@/hooks/useStats'
import { cn, formatPct } from '@/lib/utils'

import { DetailHeader } from './_shared/DetailHeader'
import { SaasCard } from './_shared/SaasCard'

const WINDOW_OPTIONS: { value: ComplianceWindow; label: string }[] = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
]

type SortKey =
  | 'composite_score'
  | 'availability_rate'
  | 'mttr_minutes'
  | 'price_anomaly_count'
  | 'complaint_count'

const RATING_TONE: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' },
  B: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-300' },
  C: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' },
  D: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-300' },
}

export function ComplianceDetail() {
  const [windowParam, setWindow] = useState<ComplianceWindow>('24h')
  const [selected, setSelected] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('composite_score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const compliance = useOperatorCompliance(windowParam)

  const rows = useMemo(() => compliance.data?.rows ?? [], [compliance.data])
  const sorted = useMemo(() => {
    const list = [...rows]
    list.sort((a, b) => {
      const av = a[sortKey] as number
      const bv = b[sortKey] as number
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return list
  }, [rows, sortKey, sortDir])

  const selectedRow = useMemo(
    () => rows.find((r) => r.operator_id === selected) ?? null,
    [rows, selected],
  )

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const onExport = () => {
    toast('Export PDF · 功能预览', {
      description: '将下载完整合规报告 PDF（demo build, 实际 PDF 生成已规划但未启用）',
      duration: 4000,
    })
  }

  return (
    <div className="min-h-full bg-saas-bg-alt p-5 text-saas-text-dark">
      <DetailHeader
        eyebrow="04 · Compliance"
        title="运营商合规仪表盘"
        subtitle="4-operator scorecard · z-score price anomalies · A/B/C/D 综合评级"
        right={
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-saas-border bg-white">
              {WINDOW_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setWindow(o.value)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium transition-colors',
                    windowParam === o.value
                      ? 'bg-saas-accent text-white'
                      : 'text-saas-text-mid hover:bg-saas-bg-alt',
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <Button variant="solid" size="sm" onClick={onExport}>
              <FileDown className="h-3.5 w-3.5" />
              <span>Export PDF</span>
            </Button>
          </div>
        }
      />

      {compliance.isLoading ? (
        <div className="mt-8 flex h-40 items-center justify-center text-sm text-saas-text-mid">
          loading…
        </div>
      ) : compliance.isError ? (
        <div className="mt-8 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Failed to load compliance data: {String(compliance.error)}
        </div>
      ) : (
        <>
          <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {rows.map((r) => (
              <OperatorScoreCard
                key={r.operator_id}
                row={r}
                isSelected={selected === r.operator_id}
                onClick={() =>
                  setSelected((cur) => (cur === r.operator_id ? null : r.operator_id))
                }
              />
            ))}
          </section>

          <section className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[2.4fr_1fr]">
            <SaasCard
              title="详细对比 · Side-by-side comparison"
              accessory={
                <span className="text-[11px] text-saas-text-light">
                  click any header to sort · 选中行高亮
                </span>
              }
              padded={false}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-saas-border text-left text-xs uppercase tracking-wider text-saas-text-mid">
                      <th className="px-4 py-2.5 font-medium">运营商 · Operator</th>
                      <SortableTh
                        active={sortKey === 'availability_rate'}
                        dir={sortDir}
                        onClick={() => onSort('availability_rate')}
                      >
                        可用率
                      </SortableTh>
                      <SortableTh
                        active={sortKey === 'mttr_minutes'}
                        dir={sortDir}
                        onClick={() => onSort('mttr_minutes')}
                      >
                        故障响应
                      </SortableTh>
                      <SortableTh
                        active={sortKey === 'price_anomaly_count'}
                        dir={sortDir}
                        onClick={() => onSort('price_anomaly_count')}
                      >
                        价格异常
                      </SortableTh>
                      <SortableTh
                        active={sortKey === 'complaint_count'}
                        dir={sortDir}
                        onClick={() => onSort('complaint_count')}
                      >
                        投诉数
                      </SortableTh>
                      <SortableTh
                        active={sortKey === 'composite_score'}
                        dir={sortDir}
                        onClick={() => onSort('composite_score')}
                      >
                        综合分
                      </SortableTh>
                      <th className="px-4 py-2.5 text-right font-medium">评级</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((r) => {
                      const tone = RATING_TONE[r.rating]
                      const isSel = selected === r.operator_id
                      return (
                        <tr
                          key={r.operator_id}
                          onClick={() =>
                            setSelected((cur) =>
                              cur === r.operator_id ? null : r.operator_id,
                            )
                          }
                          className={cn(
                            'cursor-pointer border-b border-saas-border/70 transition-colors',
                            isSel ? 'bg-saas-accent/5' : 'hover:bg-saas-bg-alt',
                          )}
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: r.color }}
                              />
                              <span className="font-medium">{r.operator_name}</span>
                              <span className="text-xs text-saas-text-light">
                                · {r.pile_count} 桩
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {formatPct(r.availability_rate)}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {r.mttr_minutes.toFixed(1)} min
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {r.price_anomaly_count}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">{r.complaint_count}</td>
                          <td className="px-3 py-2.5 tabular-nums font-semibold">
                            {r.composite_score.toFixed(1)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span
                              className={cn(
                                'inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold',
                                tone.bg,
                                tone.text,
                                tone.border,
                              )}
                            >
                              {r.rating}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </SaasCard>

            <DrillDownPanel row={selectedRow} window={windowParam} />
          </section>

          <p className="mt-3 text-[11px] text-saas-text-light">
            Methodology · 算法说明: composite =
            0.45·availability + 0.20·(1 − MTTR/90 min) + 0.20·(1 − price_anom/pile)
            + 0.15·(1 − complaints/(pile·5)) → 0–100. Price anomaly 用 voltage_anomaly
            事件作为 z-score &gt; 2σ 价格偏离的代理指标。
          </p>
        </>
      )}
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

function OperatorScoreCard({
  row,
  isSelected,
  onClick,
}: {
  row: OperatorComplianceRow
  isSelected: boolean
  onClick: () => void
}) {
  const tone = RATING_TONE[row.rating]
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-lg border bg-white p-4 text-left transition-all',
        isSelected
          ? 'border-saas-accent shadow-md ring-2 ring-saas-accent/20'
          : 'border-saas-border hover:border-saas-accent/40 hover:shadow-sm',
      )}
    >
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: row.color }}
      />
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-saas-text-mid">
            {row.operator_id.replace(/_/g, ' ')}
          </div>
          <div className="mt-0.5 text-base font-semibold">{row.operator_name}</div>
          <div className="text-[11px] text-saas-text-light">{row.pile_count} 桩</div>
        </div>
        <span
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full border text-base font-bold',
            tone.bg,
            tone.text,
            tone.border,
          )}
        >
          {row.rating}
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tabular-nums">
          {row.composite_score.toFixed(1)}
        </span>
        <span className="text-xs text-saas-text-mid">/ 100</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-saas-text-mid">
        <div className="flex justify-between">
          <span>可用率</span>
          <span className="tabular-nums">{formatPct(row.availability_rate, 1)}</span>
        </div>
        <div className="flex justify-between">
          <span>MTTR</span>
          <span className="tabular-nums">{row.mttr_minutes.toFixed(0)}m</span>
        </div>
        <div className="flex justify-between">
          <span>价格异常</span>
          <span className="tabular-nums">{row.price_anomaly_count}</span>
        </div>
        <div className="flex justify-between">
          <span>投诉</span>
          <span className="tabular-nums">{row.complaint_count}</span>
        </div>
      </div>
    </button>
  )
}

function DrillDownPanel({
  row,
  window,
}: {
  row: OperatorComplianceRow | null
  window: ComplianceWindow
}) {
  if (!row) {
    return (
      <SaasCard title="Drill-down · 下钻详情">
        <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-sm text-saas-text-light">
          <ShieldCheck className="h-8 w-8 text-saas-text-light/50" />
          <span>选中任意运营商查看详细指标</span>
        </div>
      </SaasCard>
    )
  }

  const tone = RATING_TONE[row.rating]
  const subscores = [
    {
      label: '可用率 (45%)',
      raw: formatPct(row.availability_rate),
      pct: row.availability_rate,
    },
    {
      label: 'MTTR (20%)',
      raw: `${row.mttr_minutes.toFixed(1)} min`,
      pct: Math.max(0, 1 - row.mttr_minutes / 90),
    },
    {
      label: '价格稳定 (20%)',
      raw: `${row.price_anomaly_count} anom`,
      pct: Math.max(0, 1 - row.price_anomaly_count / Math.max(1, row.pile_count)),
    },
    {
      label: '投诉指数 (15%)',
      raw: `${row.complaint_count} cases`,
      pct: Math.max(0, 1 - row.complaint_count / Math.max(1, row.pile_count * 5)),
    },
  ]

  return (
    <SaasCard
      title={`Drill-down · ${row.operator_name}`}
      accessory={
        <span className="font-mono text-[10px] text-saas-text-light">window={window}</span>
      }
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-full border text-2xl font-bold',
            tone.bg,
            tone.text,
            tone.border,
          )}
        >
          {row.rating}
        </span>
        <div>
          <div className="text-3xl font-bold tabular-nums">
            {row.composite_score.toFixed(1)}
          </div>
          <div className="text-xs text-saas-text-mid">composite score / 100</div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {subscores.map((s) => (
          <div key={s.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-saas-text-mid">{s.label}</span>
              <span className="tabular-nums text-saas-text-dark">{s.raw}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-saas-bg-alt">
              <div
                className="h-full rounded-full bg-saas-accent transition-all"
                style={{ width: `${Math.round(s.pct * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-md border border-saas-border bg-saas-bg-alt/60 p-3 text-[11px] leading-relaxed text-saas-text-mid">
        <div className="mb-1 font-semibold text-saas-text-dark">
          Recommendation · 建议
        </div>
        {row.rating === 'A' &&
          '★ 表现优秀。可作为补贴续期参考标杆，下个窗口期保持监控即可。'}
        {row.rating === 'B' &&
          'MTTR 仍有压缩空间——建议优先升级远程诊断与备件就近调度。'}
        {row.rating === 'C' &&
          '价格异常和投诉指数偏高，需要监管关注；建议下个窗口期约谈。'}
        {row.rating === 'D' &&
          '⚠ 综合分低于 70——触发监管预警，要求 30 天内提交整改方案。'}
      </div>
    </SaasCard>
  )
}
