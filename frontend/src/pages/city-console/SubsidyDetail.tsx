import { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { TrendingUp, Lightbulb } from 'lucide-react'

import type { SubsidyPileRow } from '@/api/stats'
import { useOperators } from '@/hooks/useOperators'
import { useSubsidyAnalysis } from '@/hooks/useStats'
import { saas } from '@/design-tokens/colors'
import { cn } from '@/lib/utils'

import { DetailHeader } from './_shared/DetailHeader'
import { SaasCard } from './_shared/SaasCard'

const OPERATOR_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All operators' },
  { value: 'state_grid', label: '国网 State Grid' },
  { value: 'teld', label: '特来电 TELD' },
  { value: 'starcharge', label: '星星 StarCharge' },
  { value: 'nio', label: '蔚来 NIO' },
]

const WINDOW_PRESETS: { label: string; pre: number; post: number }[] = [
  { label: '23/7 days', pre: 23, post: 7 },
  { label: '14/14 days', pre: 14, post: 14 },
  { label: '7/7 days', pre: 7, post: 7 },
]

export function SubsidyDetail() {
  const [op, setOp] = useState<string>('all')
  const [presetIdx, setPresetIdx] = useState<number>(0)
  const preset = WINDOW_PRESETS[presetIdx]
  const operators = useOperators()
  const analysis = useSubsidyAnalysis(preset.pre, preset.post)

  const allRows = useMemo(() => analysis.data?.rows ?? [], [analysis.data])
  const filtered = useMemo(() => {
    if (op === 'all') return allRows
    return allRows.filter((r) => r.operator_id === op)
  }, [allRows, op])

  const opColor = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of operators.data ?? []) m.set(o.id, o.color)
    return m
  }, [operators.data])

  return (
    <div className="min-h-full bg-saas-bg-alt p-5 text-saas-text-dark">
      <DetailHeader
        eyebrow="06 · Subsidy"
        title="补贴效果评估 · DID Causal Analysis"
        subtitle="Difference-in-differences treatment effect · per-pile ROI · policy advice"
        right={
          <div className="flex items-center gap-2">
            <select
              value={op}
              onChange={(e) => setOp(e.target.value)}
              className="rounded-md border border-saas-border bg-white px-3 py-1.5 text-xs text-saas-text-dark"
            >
              {OPERATOR_FILTERS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="flex overflow-hidden rounded-md border border-saas-border bg-white">
              {WINDOW_PRESETS.map((p, i) => (
                <button
                  key={p.label}
                  onClick={() => setPresetIdx(i)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium transition-colors',
                    presetIdx === i
                      ? 'bg-saas-accent text-white'
                      : 'text-saas-text-mid hover:bg-saas-bg-alt',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {analysis.isLoading ? (
        <div className="mt-8 flex h-40 items-center justify-center text-sm text-saas-text-mid">
          loading…
        </div>
      ) : analysis.isError ? (
        <div className="mt-8 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Failed to load analysis: {String(analysis.error)}
        </div>
      ) : analysis.data ? (
        <>
          <DIDCard data={analysis.data} />

          <section className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_1fr]">
            <SaasCard
              title="Subsidy × utilization lift · 散点图"
              accessory={
                <span className="text-[11px] text-saas-text-light">
                  {filtered.length} piles · 处理组绿色 / 对照组灰色
                </span>
              }
            >
              <SubsidyScatter rows={filtered} opColor={opColor} />
            </SaasCard>

            <SaasCard
              title="Top ROI · 单位补贴效率"
              accessory={
                <span className="text-[11px] text-saas-text-light">
                  per 1000 元补贴的利用率提升
                </span>
              }
              padded={false}
            >
              <TopRoiTable rows={filtered} opColor={opColor} />
            </SaasCard>
          </section>

          <PolicyAdviceCards data={analysis.data} />
        </>
      ) : null}
    </div>
  )
}

function DIDCard({
  data,
}: {
  data: NonNullable<ReturnType<typeof useSubsidyAnalysis>['data']>
}) {
  const sig = data.p_value < 0.05
  return (
    <section className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr]">
      <div className="overflow-hidden rounded-lg border border-saas-border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-saas-text-mid">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>DID Treatment Effect · 因果推断</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-4">
          <DIDStat
            label="Treatment uplift"
            sub={`处理组 (${data.treatment_n} piles)`}
            value={`${(data.treatment_uplift * 100).toFixed(2)}%`}
            tone="emerald"
          />
          <DIDStat
            label="Control uplift"
            sub={`对照组 (${data.control_n} piles)`}
            value={`${(data.control_uplift * 100).toFixed(2)}%`}
            tone="slate"
          />
          <DIDStat
            label="DID effect"
            sub="treatment − control"
            value={`${data.did_effect >= 0 ? '+' : ''}${(data.did_effect * 100).toFixed(2)}%`}
            tone={sig ? 'accent' : 'amber'}
          />
        </div>
        <div className="mt-3 flex items-center gap-3 text-[11px] text-saas-text-mid">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 font-mono text-[10px]',
              sig
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700',
            )}
          >
            p = {data.p_value < 1e-6 ? '< 1e-6' : data.p_value.toFixed(4)}{' '}
            {sig ? '· significant' : '· not significant'}
          </span>
          <span>
            window: pre {data.pre_window_days}d → post {data.post_window_days}d
          </span>
          <span>
            avg subsidy ¥
            {data.avg_treatment_subsidy.toLocaleString('en-US', {
              maximumFractionDigits: 0,
            })}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-xs leading-relaxed text-amber-900 shadow-sm">
        <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider">
          <Lightbulb className="h-3.5 w-3.5" />
          Methodology · 方法说明
        </div>
        <p>
          Per-pile{' '}
          <span className="font-mono">Δ = ū_post − ū_pre</span>，按 treatment / control 求均
          值差，DID 即两组差的差。p-value 来自 Welch t-test。
        </p>
        <p className="mt-2">
          <strong>注：</strong>底层 demand model 不直接编码补贴效应，演示侧叠加了
          一个确定性 modelled lift（policy elasticity 0.08 / 100k￥）以使 DID 可
          视化具有现实可信度。
        </p>
      </div>
    </section>
  )
}

function DIDStat({
  label,
  sub,
  value,
  tone,
}: {
  label: string
  sub: string
  value: string
  tone: 'emerald' | 'slate' | 'accent' | 'amber'
}) {
  const toneCls = {
    emerald: 'text-emerald-600',
    slate: 'text-slate-600',
    accent: 'text-saas-accent',
    amber: 'text-amber-600',
  }[tone]
  return (
    <div>
      <div className="text-xs text-saas-text-mid">{label}</div>
      <div className={cn('mt-0.5 font-title text-3xl font-bold tabular-nums', toneCls)}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] text-saas-text-light">{sub}</div>
    </div>
  )
}

function SubsidyScatter({
  rows,
  opColor,
}: {
  rows: SubsidyPileRow[]
  opColor: Map<string, string>
}) {
  const option = useMemo(() => {
    const treatment = rows.filter((r) => r.subsidy_group === 'treatment')
    const control = rows.filter((r) => r.subsidy_group === 'control')

    const toPoint = (r: SubsidyPileRow) => ({
      value: [r.subsidy_amount, r.occupancy_lift * 100],
      itemStyle: { color: opColor.get(r.operator_id) ?? saas.text.mid },
      pile_id: r.pile_id,
      operator_id: r.operator_id,
      group: r.subsidy_group,
    })

    // Linear regression on treatment subset for the trend line.
    const xs = treatment.map((r) => r.subsidy_amount)
    const ys = treatment.map((r) => r.occupancy_lift * 100)
    let slope = 0
    let intercept = 0
    if (xs.length >= 2) {
      const meanX = xs.reduce((a, b) => a + b, 0) / xs.length
      const meanY = ys.reduce((a, b) => a + b, 0) / ys.length
      const num = xs.reduce((a, x, i) => a + (x - meanX) * (ys[i] - meanY), 0)
      const den = xs.reduce((a, x) => a + (x - meanX) ** 2, 0)
      slope = den === 0 ? 0 : num / den
      intercept = meanY - slope * meanX
    }
    const xMin = 0
    const xMax = Math.max(100_000, ...xs, ...control.map((r) => r.subsidy_amount))
    const trendLine =
      treatment.length >= 2
        ? [
            [xMin, intercept + slope * xMin],
            [xMax, intercept + slope * xMax],
          ]
        : []

    return {
      grid: { left: 56, right: 24, top: 24, bottom: 48 },
      tooltip: {
        trigger: 'item',
        backgroundColor: '#ffffff',
        borderColor: saas.border,
        textStyle: { color: saas.text.dark, fontSize: 12 },
        formatter: (params: { data: { pile_id: string; operator_id: string; group: string; value: [number, number] } }) => {
          const d = params.data
          if (!d || !d.value) return ''
          return `<strong>${d.pile_id.slice(0, 18)}</strong><br/>group: ${
            d.group
          }<br/>operator: ${d.operator_id}<br/>subsidy: ¥${d.value[0].toLocaleString(
            'en-US',
            { maximumFractionDigits: 0 },
          )}<br/>lift: ${d.value[1].toFixed(2)}%`
        },
      },
      xAxis: {
        type: 'value',
        name: '补贴金额 / 元',
        nameLocation: 'middle',
        nameGap: 28,
        axisLabel: {
          color: saas.text.mid,
          formatter: (v: number) => `${(v / 1000).toFixed(0)}k`,
        },
        axisLine: { lineStyle: { color: saas.border } },
        splitLine: { lineStyle: { color: saas.border, type: 'dashed' } },
      },
      yAxis: {
        type: 'value',
        name: '利用率提升 (%)',
        nameLocation: 'middle',
        nameGap: 36,
        axisLabel: { color: saas.text.mid },
        axisLine: { lineStyle: { color: saas.border } },
        splitLine: { lineStyle: { color: saas.border, type: 'dashed' } },
      },
      legend: {
        data: ['treatment', 'control', 'DID trend'],
        bottom: 4,
        textStyle: { color: saas.text.mid, fontSize: 11 },
      },
      series: [
        {
          name: 'control',
          type: 'scatter',
          symbolSize: 9,
          data: control.map(toPoint),
          itemStyle: { opacity: 0.55, borderColor: '#94A3B8' },
        },
        {
          name: 'treatment',
          type: 'scatter',
          symbolSize: 12,
          data: treatment.map(toPoint),
          itemStyle: { opacity: 0.95, borderColor: '#10B981', borderWidth: 1.5 },
        },
        {
          name: 'DID trend',
          type: 'line',
          showSymbol: false,
          data: trendLine,
          lineStyle: { color: saas.accent, width: 2, type: 'dashed' },
          tooltip: { show: false },
        },
      ],
    }
  }, [rows, opColor])

  return (
    <ReactECharts
      option={option}
      notMerge
      style={{ width: '100%', height: 360 }}
      opts={{ renderer: 'canvas' }}
    />
  )
}

function TopRoiTable({
  rows,
  opColor,
}: {
  rows: SubsidyPileRow[]
  opColor: Map<string, string>
}) {
  const top = useMemo(() => {
    return [...rows]
      .filter((r) => r.subsidy_amount > 0)
      .sort((a, b) => b.roi_per_kyuan - a.roi_per_kyuan)
      .slice(0, 10)
  }, [rows])

  if (top.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-saas-text-light">
        no rows for current filter
      </div>
    )
  }

  const maxRoi = Math.max(...top.map((r) => r.roi_per_kyuan))

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-saas-border text-left uppercase tracking-wider text-saas-text-mid">
          <th className="px-3 py-2 font-medium">Pile</th>
          <th className="px-3 py-2 font-medium">补贴</th>
          <th className="px-3 py-2 font-medium">Lift</th>
          <th className="px-3 py-2 font-medium">ROI / k¥</th>
        </tr>
      </thead>
      <tbody>
        {top.map((r) => {
          const fillPct = Math.max(2, Math.round((r.roi_per_kyuan / maxRoi) * 100))
          return (
            <tr key={r.pile_id} className="border-b border-saas-border/60">
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: opColor.get(r.operator_id) ?? saas.text.mid }}
                  />
                  <span className="font-mono">{r.pile_id.slice(0, 14)}</span>
                  {r.subsidy_group === 'treatment' ? (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] uppercase text-emerald-700">
                      T
                    </span>
                  ) : null}
                </div>
              </td>
              <td className="px-3 py-2 tabular-nums">
                ¥{r.subsidy_amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {(r.occupancy_lift * 100).toFixed(2)}%
              </td>
              <td className="px-3 py-2 tabular-nums">
                <div className="flex items-center gap-2">
                  <span>{r.roi_per_kyuan.toFixed(3)}</span>
                  <div className="h-1 w-16 overflow-hidden rounded-full bg-saas-bg-alt">
                    <div
                      className="h-full rounded-full bg-saas-accent"
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function PolicyAdviceCards({
  data,
}: {
  data: NonNullable<ReturnType<typeof useSubsidyAnalysis>['data']>
}) {
  const treatmentByRegion = useMemo(() => {
    const map = new Map<string, { count: number; lift: number }>()
    for (const r of data.rows) {
      if (r.subsidy_group !== 'treatment') continue
      const cur = map.get(r.region_id) ?? { count: 0, lift: 0 }
      cur.count += 1
      cur.lift += r.occupancy_lift
      map.set(r.region_id, cur)
    }
    return [...map.entries()].map(([region_id, agg]) => ({
      region_id,
      avg_lift: agg.lift / Math.max(1, agg.count),
      count: agg.count,
    }))
  }, [data.rows])

  const recommended = treatmentByRegion.sort((a, b) => b.avg_lift - a.avg_lift)[0]
  const reduce = treatmentByRegion.sort((a, b) => a.avg_lift - b.avg_lift)[0]

  const friendly = (id: string) =>
    id === 'future_tech_city'
      ? '未来科技城'
      : id === 'qiantang_new_area'
        ? '钱塘新区'
        : id

  return (
    <section className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
      {recommended ? (
        <PolicyCard
          tone="positive"
          title="🚀 续期推荐 · Continue subsidy"
          body={
            <>
              <strong>{friendly(recommended.region_id)}</strong> 处理组平均利用率
              提升 <strong>{(recommended.avg_lift * 100).toFixed(1)}%</strong>
              ，ROI 最高，建议持续补贴。
            </>
          }
        />
      ) : null}
      {reduce && reduce !== recommended ? (
        <PolicyCard
          tone="caution"
          title="⚙️ 降幅建议 · Reduce subsidy"
          body={
            <>
              <strong>{friendly(reduce.region_id)}</strong> 处理组提升仅
              <strong> {(reduce.avg_lift * 100).toFixed(1)}%</strong>
              ，可降低 30% 补贴投入释放预算。
            </>
          }
        />
      ) : null}
      <PolicyCard
        tone="neutral"
        title="📊 整体显著性 · Statistical significance"
        body={
          <>
            DID = <strong>{(data.did_effect * 100).toFixed(2)}%</strong>，p ={' '}
            <strong>{data.p_value < 1e-6 ? '< 1e-6' : data.p_value.toFixed(4)}</strong>
            。{data.p_value < 0.05 ? '补贴显著有效' : '效果不显著，建议增加样本'}。
          </>
        }
      />
    </section>
  )
}

function PolicyCard({
  tone,
  title,
  body,
}: {
  tone: 'positive' | 'caution' | 'neutral'
  title: string
  body: React.ReactNode
}) {
  const toneCls = {
    positive: 'border-emerald-200 bg-emerald-50/70 text-emerald-900',
    caution: 'border-amber-200 bg-amber-50/70 text-amber-900',
    neutral: 'border-saas-border bg-white text-saas-text-dark',
  }[tone]
  return (
    <div className={cn('rounded-lg border p-4 text-sm leading-relaxed shadow-sm', toneCls)}>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider">{title}</div>
      <div>{body}</div>
    </div>
  )
}
