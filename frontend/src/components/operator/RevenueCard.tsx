import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { TrendingUp } from 'lucide-react'

import { saas } from '@/design-tokens'
import { cn } from '@/lib/utils'

interface RevenueCardProps {
  /** Identifier so the deterministic mock varies per operator. */
  operatorId: string
  /** Pile count owned by this operator — drives the revenue scale. */
  pileCount: number
  /** Hex color used for the line tint. */
  accentColor: string
  className?: string
}

/**
 * Revenue analytics card. The number breakdown is mock data — production
 * would derive these from a billing service that the demo backend
 * intentionally doesn't model. Marked clearly so reviewers know.
 */
export function RevenueCard({
  operatorId,
  pileCount,
  accentColor,
  className,
}: RevenueCardProps) {
  const stats = useMemo(() => buildMockRevenue(operatorId, pileCount), [operatorId, pileCount])

  const option = useMemo(
    () => ({
      grid: { top: 6, right: 8, bottom: 18, left: 32, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: stats.months,
        axisLine: { lineStyle: { color: saas.border } },
        axisTick: { show: false },
        axisLabel: { color: saas.text.light, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: saas.border, type: 'dashed' } },
        axisLabel: {
          color: saas.text.light,
          fontSize: 10,
          formatter: (v: number) => `${(v / 1e4).toFixed(0)}万`,
        },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#fff',
        borderColor: saas.border,
        textStyle: { color: saas.text.dark, fontSize: 11 },
        valueFormatter: (v: unknown) =>
          `¥${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      },
      series: [
        {
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          showSymbol: false,
          data: stats.values,
          lineStyle: { color: accentColor, width: 2.5 },
          itemStyle: { color: accentColor },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: hexToRgba(accentColor, 0.3) },
                { offset: 1, color: hexToRgba(accentColor, 0.02) },
              ],
            },
          },
        },
      ],
    }),
    [stats, accentColor],
  )

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
            Revenue · 收益分析
          </h2>
          <p className="mt-0.5 text-[11px] text-saas-text-light">
            Mock data for demo · 演示数据，非真实账单
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100">
          <TrendingUp className="h-3 w-3" />
          YoY {stats.yoyPct >= 0 ? '+' : ''}
          {stats.yoyPct.toFixed(1)}%
        </span>
      </header>

      <div className="px-4 py-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-saas-text-mid">
              月度收益
            </div>
            <div className="mt-0.5 text-2xl font-bold tabular-nums text-saas-text-dark">
              ¥{(stats.monthlyRevenue / 1e4).toFixed(1)}万
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-saas-text-mid">
              单桩平均收入
            </div>
            <div className="mt-0.5 text-2xl font-bold tabular-nums text-saas-text-dark">
              ¥{stats.perPile.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        <div className="mt-3 h-32">
          <ReactECharts
            option={option}
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'canvas' }}
            notMerge
          />
        </div>

        <div className="mt-1 grid grid-cols-3 gap-2 text-[11px]">
          <Pill label="充电服务费">
            ¥{(stats.serviceFee / 1e4).toFixed(1)}万
          </Pill>
          <Pill label="电费收入">¥{(stats.energyRevenue / 1e4).toFixed(1)}万</Pill>
          <Pill label="政府补贴">¥{(stats.subsidy / 1e4).toFixed(1)}万</Pill>
        </div>
      </div>
    </section>
  )
}

function Pill({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-saas-border bg-saas-bg-alt/60 px-2 py-1.5">
      <div className="text-saas-text-light">{label}</div>
      <div className="mt-0.5 font-semibold tabular-nums text-saas-text-dark">
        {children}
      </div>
    </div>
  )
}

interface MockRevenue {
  monthlyRevenue: number
  perPile: number
  yoyPct: number
  serviceFee: number
  energyRevenue: number
  subsidy: number
  months: string[]
  values: number[]
}

function buildMockRevenue(operatorId: string, pileCount: number): MockRevenue {
  // Per-operator multiplier so big and small operators have plausibly
  // different revenue while staying deterministic in the demo.
  const base = pileCount * 18000 // ~¥18k per pile per month (mock)
  const seed = hash(operatorId)
  const yoyPct = 8 + (seed % 1200) / 100 // 8% .. 20%
  const months: string[] = []
  const values: number[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(2026, 3 - i, 1)
    months.push(`${d.getMonth() + 1}月`)
    const seasonal = 1 + 0.12 * Math.sin(((d.getMonth() + 1) / 12) * 2 * Math.PI)
    const noise = 1 + ((hash(`${operatorId}-${i}`) % 200) - 100) / 1000
    const growth = 1 + ((11 - i) / 11) * (yoyPct / 100)
    values.push(Math.round(base * seasonal * noise * growth))
  }
  const monthlyRevenue = values[values.length - 1]
  return {
    monthlyRevenue,
    perPile: pileCount > 0 ? Math.round(monthlyRevenue / pileCount) : 0,
    yoyPct,
    serviceFee: Math.round(monthlyRevenue * 0.55),
    energyRevenue: Math.round(monthlyRevenue * 0.32),
    subsidy: Math.round(monthlyRevenue * 0.13),
    months,
    values,
  }
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
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
