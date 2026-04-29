import { useMemo, useState } from 'react'
import { Crosshair, Loader2, Sparkles, Star, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

import {
  featuresForLocation,
  predictSite,
  type ShapContribution,
  type SiteFeatures,
  type SiteResponse,
} from '@/api/ai'
import { Button } from '@/components/ui/button'
import { SiteMap } from '@/components/map/SiteMap'
import { CANDIDATE_COLORS, type SiteCandidate } from '@/components/map/types'
import { useOperators } from '@/hooks/useOperators'
import { usePiles } from '@/hooks/usePiles'
import { cn, formatPct } from '@/lib/utils'

import { DetailHeader } from './_shared/DetailHeader'
import { SaasCard } from './_shared/SaasCard'

const PILE_COUNT_PRESETS = [5, 10, 20] as const
type PileCount = (typeof PILE_COUNT_PRESETS)[number]

interface Candidate {
  id: string
  index: number
  lat: number
  lng: number
  operator: string
  pile_count: PileCount
  features: SiteFeatures | null
  prediction: SiteResponse | null
  loading: boolean
  error: string | null
}

const FEATURE_LABELS: Record<string, string> = {
  lat: '纬度',
  lng: '经度',
  pop_density_1km: '人口密度 1km',
  poi_mall_count: '商场数 1km',
  poi_office_count: '写字楼数 1km',
  poi_residential_count: '住宅数 1km',
  existing_pile_count_1km: '已有桩数 1km',
  avg_utilization_1km: '邻桩平均利用率',
  road_grade: '道路等级',
  operator_state_grid: '运营商:国网',
  operator_teld: '运营商:特来电',
  operator_starcharge: '运营商:星星',
}

let candidateCounter = 0

export function SiteSelectionDetail() {
  const piles = usePiles()
  const operators = useOperators()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [defaultOperator, setDefaultOperator] = useState<string>('state_grid')
  const defaultPileCount: PileCount = 10

  const active = useMemo(
    () => candidates.find((c) => c.id === activeId) ?? candidates[candidates.length - 1] ?? null,
    [candidates, activeId],
  )

  const onMapClick = (lat: number, lng: number) => {
    if (candidates.length >= 5) {
      toast.warning('最多 5 个候选点', {
        description: '清除一个候选位才能添加新点',
      })
      return
    }
    candidateCounter += 1
    const cand: Candidate = {
      id: `cand_${candidateCounter}`,
      index: candidates.length,
      lat,
      lng,
      operator: defaultOperator,
      pile_count: defaultPileCount,
      features: null,
      prediction: null,
      loading: true,
      error: null,
    }
    setCandidates((prev) => [...prev, cand])
    setActiveId(cand.id)
    runPrediction(cand)
  }

  const runPrediction = async (cand: Candidate) => {
    try {
      const features = await featuresForLocation(cand.lat, cand.lng, cand.operator)
      setCandidates((prev) =>
        prev.map((c) => (c.id === cand.id ? { ...c, features } : c)),
      )
      const prediction = await predictSite(features)
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === cand.id
            ? { ...c, prediction, loading: false, error: null }
            : c,
        ),
      )
      toast.success('AI 预测完成', {
        description: `候选 #${cand.index + 1} · 利用率 ${(prediction.predicted_utilization_6m * 100).toFixed(1)}%`,
        duration: 2500,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === cand.id ? { ...c, loading: false, error: msg } : c,
        ),
      )
      toast.error('AI 预测失败', { description: msg })
    }
  }

  const reRunForActive = (mutate: (c: Candidate) => Candidate) => {
    if (!active) return
    const next = mutate({ ...active, loading: true, prediction: null, error: null })
    setCandidates((prev) => prev.map((c) => (c.id === active.id ? next : c)))
    runPrediction(next)
  }

  const removeCandidate = (id: string) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id))
    if (activeId === id) setActiveId(null)
  }

  const clearAll = () => {
    setCandidates([])
    setActiveId(null)
  }

  // Pile count of "recommended" star — highest predicted util.
  const sortedRanking = useMemo(
    () =>
      [...candidates]
        .filter((c) => c.prediction)
        .sort(
          (a, b) =>
            (b.prediction?.predicted_utilization_6m ?? 0) -
            (a.prediction?.predicted_utilization_6m ?? 0),
        ),
    [candidates],
  )
  const topId = sortedRanking[0]?.id ?? null

  return (
    <div className="min-h-full bg-saas-bg-alt p-5 text-saas-text-dark">
      <DetailHeader
        eyebrow="02 · Site Selection ⭐"
        title="选址决策支持 · XGBoost + SHAP"
        subtitle="点击地图任意位置放置候选 → 12 维特征自动合成 → AI 预测 6 个月利用率 + SHAP 解释"
        right={
          <div className="flex items-center gap-2">
            <select
              value={defaultOperator}
              onChange={(e) => setDefaultOperator(e.target.value)}
              className="rounded-md border border-saas-border bg-white px-3 py-1.5 text-xs"
            >
              {operators.data?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name_zh}
                </option>
              )) ?? null}
            </select>
            {candidates.length > 0 ? (
              <Button variant="outline" size="sm" onClick={clearAll}>
                <Trash2 className="h-3.5 w-3.5" />
                清空
              </Button>
            ) : null}
          </div>
        }
      />

      <section className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
        {/* Map (left) */}
        <div className="overflow-hidden rounded-lg border border-ioc-border/40 bg-ioc-deep shadow-sm">
          <div className="flex items-center justify-between border-b border-ioc-border/40 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-ioc-text-secondary">
            <span className="flex items-center gap-2">
              <Crosshair className="h-3 w-3 text-ioc-cyan" />
              click anywhere · 点击地图放置候选 ({candidates.length}/5)
            </span>
            <span className="font-mono text-[10px] text-ioc-text-muted">
              existing {(piles.data ?? []).length} piles · grey reference dots
            </span>
          </div>
          <div className="h-[480px] w-full">
            <SiteMap
              candidates={candidates.map<SiteCandidate>((c) => ({
                id: c.id,
                index: c.index,
                lat: c.lat,
                lng: c.lng,
                predictionLabel: c.prediction
                  ? `${(c.prediction.predicted_utilization_6m * 100).toFixed(1)}%`
                  : c.loading
                    ? 'loading…'
                    : undefined,
              }))}
              existingPiles={piles.data ?? []}
              activeId={activeId}
              onMapClick={onMapClick}
              onCandidateClick={(id) => setActiveId(id)}
            />
          </div>
        </div>

        {/* Panel (right) */}
        <div className="flex flex-col gap-3">
          {active ? (
            <CandidatePanel
              candidate={active}
              isTop={active.id === topId}
              onChangeOperator={(op) =>
                reRunForActive((c) => ({ ...c, operator: op }))
              }
              onChangePileCount={(n) =>
                reRunForActive((c) => ({ ...c, pile_count: n }))
              }
              onRemove={() => removeCandidate(active.id)}
              operators={operators.data ?? []}
            />
          ) : (
            <SaasCard title="AI 推断面板 · Inference panel">
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-sm text-saas-text-light">
                <Sparkles className="h-8 w-8 text-saas-text-light/50" />
                点击地图放置首个候选位
              </div>
            </SaasCard>
          )}
        </div>
      </section>

      {/* Multi-candidate comparison */}
      {sortedRanking.length > 0 ? (
        <SaasCard
          className="mt-4"
          title="多候选对比 · Side-by-side ranking"
          accessory={
            <span className="text-[11px] text-saas-text-light">
              排序：predicted utilization (desc) · ⭐ = AI 推荐
            </span>
          }
          padded={false}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-saas-border text-left text-xs uppercase tracking-wider text-saas-text-mid">
                  <th className="px-4 py-2.5 font-medium">候选</th>
                  <th className="px-3 py-2.5 font-medium">坐标</th>
                  <th className="px-3 py-2.5 font-medium">运营商</th>
                  <th className="px-3 py-2.5 font-medium">桩数</th>
                  <th className="px-3 py-2.5 font-medium">预期 6m 利用率</th>
                  <th className="px-3 py-2.5 font-medium">95% CI</th>
                  <th className="px-3 py-2.5 font-medium">月均收入</th>
                  <th className="px-3 py-2.5 font-medium">ROI 回收</th>
                  <th className="px-4 py-2.5 text-right font-medium">决策</th>
                </tr>
              </thead>
              <tbody>
                {sortedRanking.map((c) => {
                  if (!c.prediction) return null
                  const util = c.prediction.predicted_utilization_6m
                  const [lo, hi] = c.prediction.confidence_interval_95
                  const monthlyRev = estimateMonthlyRevenueK(util, c.pile_count)
                  const payback = estimatePaybackMonths(util, c.pile_count)
                  const isTop = c.id === topId
                  const tone = util >= 0.7 ? 'top' : util >= 0.5 ? 'good' : 'warn'
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setActiveId(c.id)}
                      className={cn(
                        'cursor-pointer border-b border-saas-border/70 transition-colors',
                        c.id === activeId
                          ? 'bg-saas-accent/5'
                          : 'hover:bg-saas-bg-alt',
                      )}
                    >
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{
                              backgroundColor:
                                CANDIDATE_COLORS[c.index % CANDIDATE_COLORS.length],
                            }}
                          />
                          <span className="font-medium">#{c.index + 1}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px]">
                        {c.lat.toFixed(4)}, {c.lng.toFixed(4)}
                      </td>
                      <td className="px-3 py-2.5">
                        {operators.data?.find((o) => o.id === c.operator)?.name_zh ??
                          c.operator}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{c.pile_count}</td>
                      <td className="px-3 py-2.5 tabular-nums font-semibold">
                        {(util * 100).toFixed(1)}%
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-saas-text-mid">
                        [{(lo * 100).toFixed(1)}, {(hi * 100).toFixed(1)}]
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">¥{monthlyRev.toFixed(1)}k</td>
                      <td className="px-3 py-2.5 tabular-nums">{payback} mo</td>
                      <td className="px-4 py-2.5 text-right">
                        {isTop ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                            <Star className="h-3 w-3 fill-current" />
                            recommend
                          </span>
                        ) : tone === 'warn' ? (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-700">
                            ⚠ low
                          </span>
                        ) : (
                          <span className="text-saas-text-light">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SaasCard>
      ) : null}

      <p className="mt-3 text-[11px] leading-relaxed text-saas-text-light">
        Pipeline · 流水线: 点击地图 → POST /api/ai/features-for-location 合成 12 维
        特征 (POI / 人口 / 邻桩 prior) → POST /api/ai/predict/site → XGBoost 推断 +
        SHAP TreeExplainer 取 top-3 贡献。预期收入与 ROI 由 utilisation × 桩数 ×
        电价启发式估算（4.0 kWh / hour-per-pile · ¥0.95 / kWh net margin）。
      </p>
    </div>
  )
}

/* ----------------------------- panel ----------------------------- */

function CandidatePanel({
  candidate,
  isTop,
  onChangeOperator,
  onChangePileCount,
  onRemove,
  operators,
}: {
  candidate: Candidate
  isTop: boolean
  onChangeOperator: (op: string) => void
  onChangePileCount: (n: PileCount) => void
  onRemove: () => void
  operators: { id: string; name_zh: string }[]
}) {
  const color = CANDIDATE_COLORS[candidate.index % CANDIDATE_COLORS.length]
  const pred = candidate.prediction
  return (
    <SaasCard
      title={
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span>候选 #{candidate.index + 1}</span>
          {isTop ? (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
              <Star className="h-2.5 w-2.5 fill-current" />
              top
            </span>
          ) : null}
        </div>
      }
      accessory={
        <button
          onClick={onRemove}
          className="rounded p-1 text-saas-text-light hover:bg-saas-bg-alt hover:text-rose-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      }
    >
      <div className="mb-3 font-mono text-[11px] text-saas-text-mid">
        {candidate.lat.toFixed(4)}°N, {candidate.lng.toFixed(4)}°E
      </div>

      {candidate.loading ? (
        <div className="flex h-32 items-center justify-center gap-2 text-sm text-saas-text-mid">
          <Loader2 className="h-4 w-4 animate-spin text-saas-accent" />
          AI 推断中…
        </div>
      ) : candidate.error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          AI failed: {candidate.error}
        </div>
      ) : pred ? (
        <>
          <div className="rounded-lg border border-saas-accent/30 bg-saas-accent/5 p-4">
            <div className="text-xs uppercase tracking-wider text-saas-text-mid">
              预期 6 个月利用率
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-title text-4xl font-bold tabular-nums text-saas-accent">
                {(pred.predicted_utilization_6m * 100).toFixed(1)}%
              </span>
              <span className="text-xs text-saas-text-mid">
                95% CI [{(pred.confidence_interval_95[0] * 100).toFixed(1)},{' '}
                {(pred.confidence_interval_95[1] * 100).toFixed(1)}]
              </span>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-saas-text-mid">
              <Sparkles className="h-3 w-3" />
              SHAP top-3 影响 · base = {pred.shap_base_value.toFixed(3)}
            </div>
            <ShapBars top3={pred.shap_top3} />
          </div>

          {candidate.features ? (
            <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1 rounded-md border border-saas-border bg-saas-bg-alt/40 p-3 text-[11px] text-saas-text-mid">
              <Field
                k="人口密度"
                v={`${candidate.features.pop_density_1km.toFixed(0)}/km²`}
              />
              <Field k="商场" v={candidate.features.poi_mall_count.toString()} />
              <Field
                k="写字楼"
                v={candidate.features.poi_office_count.toString()}
              />
              <Field
                k="住宅"
                v={candidate.features.poi_residential_count.toString()}
              />
              <Field
                k="邻桩数"
                v={candidate.features.existing_pile_count_1km.toString()}
              />
              <Field
                k="邻利用率"
                v={formatPct(candidate.features.avg_utilization_1km)}
              />
              <Field
                k="路等级"
                v={
                  candidate.features.road_grade === 3
                    ? '主干道'
                    : candidate.features.road_grade === 2
                      ? '次干道'
                      : '支路'
                }
              />
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-saas-text-mid">
                运营商
              </label>
              <select
                value={candidate.operator}
                onChange={(e) => onChangeOperator(e.target.value)}
                className="mt-1 w-full rounded-md border border-saas-border bg-white px-2 py-1 text-xs"
              >
                {operators.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name_zh}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-saas-text-mid">
                桩数
              </label>
              <div className="mt-1 flex overflow-hidden rounded-md border border-saas-border bg-white">
                {PILE_COUNT_PRESETS.map((n) => (
                  <button
                    key={n}
                    onClick={() => onChangePileCount(n)}
                    className={cn(
                      'flex-1 py-1 text-xs font-medium transition-colors',
                      candidate.pile_count === n
                        ? 'bg-saas-accent text-white'
                        : 'text-saas-text-mid hover:bg-saas-bg-alt',
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-md border border-saas-border bg-saas-bg-alt/60 p-3 text-[11px] text-saas-text-mid">
            <div>
              月均收入 ≈{' '}
              <strong className="text-saas-accent">
                ¥{estimateMonthlyRevenueK(pred.predicted_utilization_6m, candidate.pile_count).toFixed(1)}k
              </strong>
            </div>
            <div>
              ROI 回收期 ≈{' '}
              <strong>
                {estimatePaybackMonths(pred.predicted_utilization_6m, candidate.pile_count)}
              </strong>{' '}
              月
            </div>
          </div>
        </>
      ) : null}
    </SaasCard>
  )
}

function ShapBars({ top3 }: { top3: ShapContribution[] }) {
  // Largest absolute SHAP for the bar scale.
  const max = Math.max(0.01, ...top3.map((s) => Math.abs(s.shap_contribution)))
  return (
    <div className="space-y-2">
      {top3.map((s) => {
        const pct = Math.abs(s.shap_contribution) / max
        const positive = s.shap_contribution >= 0
        const label = FEATURE_LABELS[s.feature] ?? s.feature
        return (
          <div key={s.feature} className="text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium">{label}</span>
              <span
                className={cn(
                  'font-mono text-[11px] tabular-nums',
                  positive ? 'text-emerald-600' : 'text-rose-600',
                )}
              >
                {positive ? '+' : ''}
                {(s.shap_contribution * 100).toFixed(2)} ppt
              </span>
            </div>
            <div className="mt-0.5 flex h-1.5 items-center">
              <div className="flex flex-1 justify-end pr-0.5">
                {!positive ? (
                  <div
                    className="h-full rounded-l-full bg-rose-400/80"
                    style={{ width: `${(pct * 100).toFixed(0)}%` }}
                  />
                ) : null}
              </div>
              <div className="h-full w-px bg-saas-text-light/40" />
              <div className="flex flex-1 pl-0.5">
                {positive ? (
                  <div
                    className="h-full rounded-r-full bg-emerald-400/80"
                    style={{ width: `${(pct * 100).toFixed(0)}%` }}
                  />
                ) : null}
              </div>
            </div>
            <div className="mt-0.5 text-[10px] text-saas-text-light">
              value = {Number(s.value).toFixed(2)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-saas-text-light">{k}</span>
      <span className="tabular-nums text-saas-text-dark">{v}</span>
    </div>
  )
}

/* ----------------------------- ROI heuristics ----------------------------- */

function estimateMonthlyRevenueK(util: number, pileCount: number): number {
  // 4 kWh average per pile-hour at full utilisation × ¥0.95 net margin / kWh.
  const monthlyKWh = util * pileCount * 4 * 24 * 30
  return (monthlyKWh * 0.95) / 1000
}

function estimatePaybackMonths(util: number, pileCount: number): number {
  // Capex ≈ ¥80k per pile (rough Hangzhou install all-in).
  const capex = pileCount * 80_000
  const monthlyRev = estimateMonthlyRevenueK(util, pileCount) * 1000
  if (monthlyRev < 1) return 999
  return Math.round(capex / monthlyRev)
}
