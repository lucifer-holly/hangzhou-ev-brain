import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { TrendingUp } from 'lucide-react'

import type { OperatorComplianceRow } from '@/api/stats'
import { saas } from '@/design-tokens'
import { cn, formatPct } from '@/lib/utils'

interface BenchmarkRadarProps {
  rows: OperatorComplianceRow[]
  /** ID of the focused operator. */
  meId: string
  className?: string
}

/**
 * Mini radar chart that compares the focused operator against the other
 * three on five normalised KPIs. Driven by the same compliance endpoint
 * the City Console drill-down uses.
 */
export function BenchmarkRadar({ rows, meId, className }: BenchmarkRadarProps) {
  const me = useMemo(() => rows.find((r) => r.operator_id === meId), [rows, meId])

  const option = useMemo(() => {
    if (rows.length === 0 || !me) return null

    const cityAvg = {
      availability: avg(rows.map((r) => r.availability_rate)),
      mttr: avg(rows.map((r) => r.mttr_minutes)),
      priceStability: avg(
        rows.map((r) =>
          Math.max(0, 1 - r.price_anomaly_count / Math.max(1, r.pile_count)),
        ),
      ),
      complaint: avg(
        rows.map((r) =>
          Math.max(0, 1 - r.complaint_count / Math.max(1, r.pile_count * 5)),
        ),
      ),
      composite: avg(rows.map((r) => r.composite_score)),
    }

    const meValues = [
      me.availability_rate * 100,
      Math.max(0, 100 - me.mttr_minutes * (100 / 90)), // 0min=100, 90min=0
      Math.max(0, 1 - me.price_anomaly_count / Math.max(1, me.pile_count)) * 100,
      Math.max(0, 1 - me.complaint_count / Math.max(1, me.pile_count * 5)) * 100,
      me.composite_score,
    ]

    const cityValues = [
      cityAvg.availability * 100,
      Math.max(0, 100 - cityAvg.mttr * (100 / 90)),
      cityAvg.priceStability * 100,
      cityAvg.complaint * 100,
      cityAvg.composite,
    ]

    return {
      tooltip: { trigger: 'item' },
      legend: {
        bottom: 0,
        left: 'center',
        textStyle: { color: saas.text.mid, fontSize: 10 },
        itemWidth: 10,
        itemHeight: 8,
        itemGap: 14,
      },
      radar: {
        center: ['50%', '46%'],
        radius: '60%',
        indicator: [
          { name: '可用率', max: 100 },
          { name: '故障响应', max: 100 },
          { name: '价格稳定', max: 100 },
          { name: '投诉指数', max: 100 },
          { name: '综合分', max: 100 },
        ],
        axisName: { color: saas.text.mid, fontSize: 10 },
        splitArea: { areaStyle: { color: ['rgba(248,250,252,0.6)', 'rgba(255,255,255,0.4)'] } },
        splitLine: { lineStyle: { color: saas.border } },
        axisLine: { lineStyle: { color: saas.border } },
      },
      series: [
        {
          type: 'radar',
          symbol: 'circle',
          symbolSize: 4,
          data: [
            {
              value: meValues,
              name: me.operator_name,
              areaStyle: { color: hexToRgba(me.color, 0.32) },
              lineStyle: { color: me.color, width: 2 },
              itemStyle: { color: me.color },
            },
            {
              value: cityValues,
              name: '全市均值',
              areaStyle: { color: 'rgba(148,163,184,0.18)' },
              lineStyle: { color: '#94A3B8', width: 1.5, type: 'dashed' },
              itemStyle: { color: '#94A3B8' },
            },
          ],
        },
      ],
    }
  }, [rows, me])

  return (
    <section
      className={cn(
        'overflow-hidden rounded-lg border border-saas-border bg-white shadow-sm',
        className,
      )}
    >
      <header className="flex items-center justify-between border-b border-saas-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-saas-text-dark">
            Benchmark · 同业对标
          </h2>
          <p className="mt-0.5 text-[11px] text-saas-text-light">
            us vs. city avg · 数据源 /api/stats/operator-compliance
          </p>
        </div>
        {me ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-blue-100">
            <TrendingUp className="h-3 w-3" />
            综合 {me.composite_score.toFixed(1)}
          </span>
        ) : null}
      </header>
      <div className="px-4 pt-2 pb-3">
        {option ? (
          <div className="h-52">
            <ReactECharts
              option={option}
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'canvas' }}
              notMerge
            />
          </div>
        ) : (
          <div className="flex h-52 items-center justify-center text-sm text-saas-text-light">
            loading…
          </div>
        )}
        {me ? (
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-saas-text-mid">
            <Stat label="可用率">{formatPct(me.availability_rate, 1)}</Stat>
            <Stat label="MTTR">{me.mttr_minutes.toFixed(0)} min</Stat>
            <Stat label="价格异常">{me.price_anomaly_count} 次</Stat>
            <Stat label="评级">
              <span className="font-bold text-saas-text-dark">{me.rating}</span>
            </Stat>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <span>{label}</span>
      <span className="tabular-nums text-saas-text-dark">{children}</span>
    </div>
  )
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '')
  const v = m.length === 3
    ? m.split('').map((c) => c + c).join('')
    : m
  const r = parseInt(v.slice(0, 2), 16)
  const g = parseInt(v.slice(2, 4), 16)
  const b = parseInt(v.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
