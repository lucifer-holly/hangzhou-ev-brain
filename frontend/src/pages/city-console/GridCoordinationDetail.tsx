import { useEffect, useMemo, useRef, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { AlertTriangle, Check, RotateCw, Zap } from 'lucide-react'
import { toast } from 'sonner'

import type { GridStressResponse, OperatorAllocation } from '@/api/grid'
import { simulateGridStress } from '@/api/grid'
import { Button } from '@/components/ui/button'
import { useOperators } from '@/hooks/useOperators'
import { saas } from '@/design-tokens/colors'
import { cn } from '@/lib/utils'

import { DetailHeader } from './_shared/DetailHeader'
import { SaasCard } from './_shared/SaasCard'

interface LoadPoint {
  ts: number
  load_mw: number
  is_stressed: boolean
}

const WARN_LINE_MW = 9.0
const HIGH_LINE_MW = 8.0
const HIST_POINTS = 36
const TICK_MS = 1500

function generateLoadHistory(): LoadPoint[] {
  const out: LoadPoint[] = []
  const now = Date.now()
  for (let i = HIST_POINTS - 1; i >= 0; i--) {
    const ts = now - i * TICK_MS
    // Sinusoidal load 5..8 MW with light noise
    const phase = (ts / 60_000) * 0.7
    const base = 6.5 + 1.2 * Math.sin(phase) + 0.3 * Math.sin(phase * 2.4)
    const noise = (Math.random() - 0.5) * 0.2
    out.push({ ts, load_mw: base + noise, is_stressed: false })
  }
  return out
}

export function GridCoordinationDetail() {
  const operators = useOperators()
  const [history, setHistory] = useState<LoadPoint[]>(() => generateLoadHistory())
  const [stressMode, setStressMode] = useState<'normal' | 'stressed' | 'curtailed'>(
    'normal',
  )
  const [target, setTarget] = useState<number>(1.5)
  const [plan, setPlan] = useState<GridStressResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [revealedCount, setRevealedCount] = useState(0)
  const stressRampRef = useRef<{ start: number; offset: number } | null>(null)
  const curtailRampRef = useRef<{ start: number; reduction: number } | null>(null)

  // Live tick — extend the history with a new point each TICK_MS.
  useEffect(() => {
    const id = window.setInterval(() => {
      setHistory((prev) => {
        const ts = Date.now()
        const phase = (ts / 60_000) * 0.7
        let base = 6.5 + 1.2 * Math.sin(phase) + 0.3 * Math.sin(phase * 2.4)

        if (stressMode === 'stressed' && stressRampRef.current) {
          // Ramp up to ~+3.5 MW over 5 s.
          const elapsed = (ts - stressRampRef.current.start) / 5000
          const ramp = Math.min(1, elapsed)
          base += stressRampRef.current.offset * ramp
        } else if (stressMode === 'curtailed' && curtailRampRef.current) {
          // Sustained stress AND apply curtailment over 5 s.
          const stressOffset =
            stressRampRef.current?.offset ?? 0
          base += stressOffset
          const elapsed = (ts - curtailRampRef.current.start) / 5000
          const ramp = Math.min(1, elapsed)
          base -= curtailRampRef.current.reduction * ramp
        }

        const next: LoadPoint = {
          ts,
          load_mw: base + (Math.random() - 0.5) * 0.15,
          is_stressed: base > WARN_LINE_MW,
        }
        return [...prev.slice(-HIST_POINTS + 1), next]
      })
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [stressMode])

  const curLoad = history[history.length - 1]?.load_mw ?? 0
  const stressPct = (curLoad / WARN_LINE_MW) * 100

  const triggerStress = () => {
    stressRampRef.current = { start: Date.now(), offset: 3.6 }
    curtailRampRef.current = null
    setStressMode('stressed')
    setPlan(null)
    setRevealedCount(0)
    toast.warning('电网告急 · Grid stress simulated', {
      description: '负荷正在突破警戒线，启动 LP 削峰分配',
      duration: 4000,
    })
  }

  const recoverNormal = () => {
    setStressMode('normal')
    setPlan(null)
    setRevealedCount(0)
    stressRampRef.current = null
    curtailRampRef.current = null
    toast.success('已恢复正常', { duration: 2000 })
  }

  const runLp = async () => {
    setLoading(true)
    try {
      const res = await simulateGridStress({
        target_curtailment_mw: target,
        max_per_operator_pct: 0.3,
      })
      setPlan(res)
      setRevealedCount(0)
      // Animate operator cards revealing one by one.
      let idx = 0
      const interval = window.setInterval(() => {
        idx += 1
        setRevealedCount(idx)
        if (idx >= res.operator_allocations.length) window.clearInterval(interval)
      }, 280)
    } catch (e) {
      toast.error('LP 求解失败', { description: String(e) })
    } finally {
      setLoading(false)
    }
  }

  const applyCurtailment = () => {
    if (!plan) return
    curtailRampRef.current = { start: Date.now(), reduction: plan.achieved_curtailment_mw }
    setStressMode('curtailed')
    toast.success('指令已下发 · LP curtailment applied', {
      description: `100 桩接收降功率指令，预计削峰 ${plan.achieved_curtailment_mw.toFixed(2)} MW`,
      duration: 4500,
    })
  }

  const opMeta = useMemo(() => {
    const m = new Map<string, { color: string }>()
    for (const o of operators.data ?? []) m.set(o.id, { color: o.color })
    return m
  }, [operators.data])

  return (
    <div className="min-h-full bg-saas-bg-alt p-5 text-saas-text-dark">
      <DetailHeader
        eyebrow="03 · Grid Coordination"
        title="电网协同削峰 · Linear Programming"
        subtitle="实时负荷曲线 + 警戒红线 + LP 多运营商削峰分配 + 错峰定价激励"
        right={
          <div className="flex items-center gap-2">
            {stressMode === 'normal' ? (
              <Button variant="danger" size="sm" onClick={triggerStress}>
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>模拟电网告急</span>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={recoverNormal}>
                <RotateCw className="h-3.5 w-3.5" />
                <span>恢复正常</span>
              </Button>
            )}
          </div>
        }
      />

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="当前负荷"
          value={`${curLoad.toFixed(2)} MW`}
          sub={`${stressPct.toFixed(0)}% of cap`}
          tone={curLoad > WARN_LINE_MW ? 'danger' : curLoad > HIGH_LINE_MW ? 'warning' : 'default'}
        />
        <KpiTile
          label="警戒线"
          value={`${WARN_LINE_MW.toFixed(1)} MW`}
          sub={`high ${HIGH_LINE_MW.toFixed(1)} MW · max 9.5 MW`}
        />
        <KpiTile
          label="LP 目标削峰"
          value={`${target.toFixed(2)} MW`}
          sub={plan ? `achieved ${plan.achieved_curtailment_mw.toFixed(2)} MW` : 'not run yet'}
          tone={plan ? 'accent' : 'default'}
        />
        <KpiTile
          label="状态"
          value={
            stressMode === 'normal'
              ? '正常'
              : stressMode === 'stressed'
                ? '告急'
                : '已削峰'
          }
          sub={
            stressMode === 'curtailed'
              ? 'LP-driven shedding active'
              : stressMode === 'stressed'
                ? 'over warning threshold'
                : 'within bounds'
          }
          tone={
            stressMode === 'normal'
              ? 'default'
              : stressMode === 'curtailed'
                ? 'accent'
                : 'danger'
          }
        />
      </section>

      <SaasCard
        className="mt-4"
        title="实时电网负荷 · Live grid load"
        accessory={
          <span className="text-[11px] text-saas-text-light">
            history {HIST_POINTS} pts · 1.5s tick · synthetic
          </span>
        }
      >
        <LoadCurveChart history={history} />
      </SaasCard>

      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <SaasCard
          title="LP 削峰分配 · Curtailment plan"
          accessory={
            stressMode !== 'normal' ? (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 font-mono text-[10px] text-rose-700">
                triggered
              </span>
            ) : (
              <span className="text-[11px] text-saas-text-light">trigger 告急 first</span>
            )
          }
        >
          {stressMode === 'normal' ? (
            <div className="flex h-32 items-center justify-center text-sm text-saas-text-light">
              电网负荷正常，无削峰需求。点击 “模拟电网告急” 体验 LP 流程。
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col text-xs text-saas-text-mid">
                  目标削峰量
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="range"
                      min={0.5}
                      max={4.0}
                      step={0.1}
                      value={target}
                      onChange={(e) => setTarget(Number(e.target.value))}
                      className="w-48 accent-saas-accent"
                    />
                    <span className="font-mono text-sm text-saas-text-dark">
                      {target.toFixed(2)} MW
                    </span>
                  </div>
                </label>
                <Button variant="solid" size="sm" onClick={runLp} disabled={loading}>
                  <Zap className="h-3.5 w-3.5" />
                  <span>{loading ? 'solving…' : '运行 LP'}</span>
                </Button>
                {plan ? (
                  <Button variant="default" size="sm" onClick={applyCurtailment}>
                    <Check className="h-3.5 w-3.5" />
                    <span>Apply 模拟下发</span>
                  </Button>
                ) : null}
              </div>

              {plan ? (
                <div className="mt-4 space-y-2">
                  {plan.operator_allocations.map((a, i) => (
                    <AllocationBar
                      key={a.operator_id}
                      alloc={a}
                      revealed={i < revealedCount}
                      color={opMeta.get(a.operator_id)?.color ?? saas.text.mid}
                    />
                  ))}
                  <div className="mt-3 rounded-md border border-saas-accent/40 bg-saas-accent/5 p-3 text-xs">
                    <div className="font-semibold text-saas-text-dark">
                      Σ saved = {plan.achieved_curtailment_mw.toFixed(3)} MW{' '}
                      <span className="text-saas-text-mid">
                        / target {plan.target_curtailment_mw.toFixed(2)} MW (
                        {(plan.achieved_pct_of_target * 100).toFixed(0)}%)
                      </span>
                      {plan.achieved_pct_of_target >= 0.999 ? (
                        <span className="ml-2 text-emerald-600">✓</span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-saas-text-mid">
                      LP weights ∝ market share — 国网 (50% 份额) 是“政治成本最高”的
                      最后选择。
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </SaasCard>

        <SaasCard title="动态定价 · Dynamic pricing nudge">
          {plan ? (
            <PricingPanel plan={plan} />
          ) : (
            <div className="flex h-32 items-center justify-center text-sm text-saas-text-light">
              run LP first to see pricing recommendation
            </div>
          )}
        </SaasCard>
      </section>

      <p className="mt-3 text-[11px] text-saas-text-light">
        LP formulation: minimise Σ_i weight_i · cut_i · power_i · subject to Σ_i cut_i ·
        power_i ≥ target ; 0 ≤ cut_i ≤ {30}%. Weight uses 0.5 + market_share so larger
        operators are reluctantly curtailed last (real-world political reality of
        grid coordination negotiations).
      </p>
    </div>
  )
}

function LoadCurveChart({ history }: { history: LoadPoint[] }) {
  const option = useMemo(() => {
    const data = history.map((p) => [p.ts, p.load_mw])
    return {
      animation: false,
      grid: { left: 56, right: 24, top: 24, bottom: 36 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#fff',
        borderColor: saas.border,
        textStyle: { color: saas.text.dark, fontSize: 12 },
        formatter: (params: { value: [number, number] }[]) => {
          const p = params[0]
          if (!p) return ''
          const t = new Date(p.value[0]).toLocaleTimeString('zh-CN', { hour12: false })
          return `<strong>${t}</strong><br/>${p.value[1].toFixed(3)} MW`
        },
      },
      xAxis: {
        type: 'time',
        axisLabel: {
          color: saas.text.mid,
          formatter: (v: number) =>
            new Date(v).toLocaleTimeString('zh-CN', {
              hour12: false,
              minute: '2-digit',
              second: '2-digit',
            }),
        },
        axisLine: { lineStyle: { color: saas.border } },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: 'MW',
        nameLocation: 'middle',
        nameGap: 36,
        min: 4,
        max: 11,
        axisLabel: { color: saas.text.mid },
        axisLine: { lineStyle: { color: saas.border } },
        splitLine: { lineStyle: { color: saas.border, type: 'dashed' } },
      },
      series: [
        {
          name: 'Grid load',
          type: 'line',
          showSymbol: false,
          smooth: true,
          data,
          lineStyle: { color: saas.accent, width: 2.4 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(37,99,235,0.30)' },
                { offset: 1, color: 'rgba(37,99,235,0.02)' },
              ],
            },
          },
          markLine: {
            silent: true,
            symbol: 'none',
            label: { color: saas.text.mid, fontSize: 10 },
            data: [
              {
                yAxis: WARN_LINE_MW,
                lineStyle: { color: '#FF6B35', type: 'dashed', width: 1.5 },
                label: { formatter: '⚠ 警戒 9 MW', position: 'end' },
              },
              {
                yAxis: HIGH_LINE_MW,
                lineStyle: { color: '#FFB800', type: 'dashed', width: 1.2 },
                label: { formatter: 'high 8 MW', position: 'end' },
              },
            ],
          },
        },
      ],
    }
  }, [history])

  return (
    <ReactECharts
      option={option}
      notMerge
      style={{ width: '100%', height: 240 }}
      opts={{ renderer: 'canvas' }}
    />
  )
}

function AllocationBar({
  alloc,
  revealed,
  color,
}: {
  alloc: OperatorAllocation
  revealed: boolean
  color: string
}) {
  const cutPct = alloc.curtailment_pct * 100
  return (
    <div
      className={cn(
        'rounded-md border border-saas-border bg-white p-3 transition-all',
        revealed ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0',
      )}
    >
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="font-medium">{alloc.operator_name}</span>
          <span className="text-[11px] text-saas-text-light">
            {alloc.pile_count} 桩 · {alloc.current_power_kw.toFixed(0)} kW
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-saas-text-mid">cut</span>
          <span
            className={cn(
              'font-semibold tabular-nums',
              cutPct === 0 ? 'text-emerald-600' : 'text-saas-accent',
            )}
          >
            {cutPct.toFixed(1)}%
          </span>
          <span className="font-mono text-[11px] text-saas-text-mid">
            -{alloc.saved_kw.toFixed(0)} kW
          </span>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-saas-bg-alt">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${cutPct.toFixed(1)}%`,
            backgroundColor: color,
            opacity: 0.85,
          }}
        />
      </div>
    </div>
  )
}

function KpiTile({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'accent' | 'warning' | 'danger'
}) {
  const toneCls = {
    default: 'border-saas-border bg-white',
    accent: 'border-saas-accent/40 bg-saas-accent/5',
    warning: 'border-amber-300 bg-amber-50',
    danger: 'border-rose-300 bg-rose-50',
  }[tone]
  return (
    <div className={cn('rounded-lg border p-4 shadow-sm', toneCls)}>
      <div className="text-xs uppercase tracking-wider text-saas-text-mid">{label}</div>
      <div className="mt-1 font-title text-2xl font-bold tabular-nums">{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-saas-text-light">{sub}</div> : null}
    </div>
  )
}

function PricingPanel({ plan }: { plan: GridStressResponse }) {
  const discount = plan.pricing_discount_pct * 100
  const response = plan.expected_response_rate * 100
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-saas-text-mid">推荐错峰折扣</div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="font-title text-3xl font-bold text-saas-accent">
            -{discount.toFixed(1)}%
          </span>
          <span className="text-xs text-saas-text-mid">off-peak charging</span>
        </div>
      </div>
      <div>
        <div className="text-xs text-saas-text-mid">预计响应率</div>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-saas-bg-alt">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${response.toFixed(1)}%` }}
            />
          </div>
          <span className="font-mono text-sm tabular-nums">{response.toFixed(1)}%</span>
        </div>
      </div>
      <div className="rounded-md border border-saas-border bg-saas-bg-alt/60 p-3 text-[11px] leading-relaxed text-saas-text-mid">
        基于价格弹性曲线的启发式建议——折扣越大需求转移率越高，但弹性递减。
        实际投放需结合当下时段的弹性系数与运营商激励池。
      </div>
    </div>
  )
}

