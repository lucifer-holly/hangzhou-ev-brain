import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Cloud,
  Flag,
  Music2,
  Truck,
  X,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import type { Pile } from '@/api/piles'
import { useOperators } from '@/hooks/useOperators'
import { usePiles } from '@/hooks/usePiles'
import { CityMap } from '@/components/map/CityMap'
import { HowItWorksCard } from '@/components/HowItWorksCard'
import { TechBorder } from '@/components/ioc/TechBorder'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { DetailHeader } from './_shared/DetailHeader'
import { SaasCard } from './_shared/SaasCard'

interface EmergencyAction {
  id: string
  label: string
  detail: string
  recommended: boolean
}

interface EmergencyEvent {
  id: string
  name: string
  englishName: string
  icon: LucideIcon
  centerLat: number
  centerLng: number
  radiusKm: number
  description: string
  expectedImpact: string
  actions: EmergencyAction[]
}

const EVENTS: EmergencyEvent[] = [
  {
    id: 'asian_games',
    name: '亚运会开幕式',
    englishName: 'Asian Games Opening Ceremony',
    icon: Flag,
    centerLat: 30.275,
    centerLng: 120.03,
    radiusKm: 3.5,
    description: '场馆周边瞬时车流暴增，需在开幕前 2h 完成桩位预约清理',
    expectedImpact: '半径 3.5 km 内 60+ 桩 · 预计利用率冲至 95%+',
    actions: [
      {
        id: 'pricing',
        label: '动态涨价 +30%',
        detail: '主会场半径内桩点临时涨价，引流至次场馆',
        recommended: true,
      },
      {
        id: 'mobile_chargers',
        label: '调度临时移动充电车 ×3',
        detail: '从余杭备用车队调 3 辆 80 kW 移动桩进场',
        recommended: true,
      },
      {
        id: 'limit_session',
        label: '限制单次会话 ≤ 30 min',
        detail: '降低单桩占用时长，提升周转',
        recommended: true,
      },
      {
        id: 'green_lane',
        label: '预约绿色通道',
        detail: '工作人员凭证优先充电',
        recommended: false,
      },
    ],
  },
  {
    id: 'concert',
    name: '万人演唱会',
    englishName: 'Stadium Concert',
    icon: Music2,
    centerLat: 30.295,
    centerLng: 120.36,
    radiusKm: 2.0,
    description: '钱塘新区奥体中心晚 19:00-22:30 · 散场后 30 分钟内集中需求',
    expectedImpact: '半径 2 km 内 30+ 桩 · 散场峰值利用率 90%',
    actions: [
      {
        id: 'pricing',
        label: '动态涨价 +20%',
        detail: '场馆周边桩点散场期溢价',
        recommended: true,
      },
      {
        id: 'preheat',
        label: '提前开放快充',
        detail: '17:30 起所有 120 kW 快充进入待命态',
        recommended: true,
      },
      {
        id: 'shuttle_info',
        label: 'App 推送地铁建议',
        detail: '向 driver app 推送公共交通替代方案',
        recommended: false,
      },
    ],
  },
  {
    id: 'spring_festival',
    name: '春节返乡潮',
    englishName: 'Spring Festival Migration',
    icon: Calendar,
    centerLat: 30.285,
    centerLng: 120.18,
    radiusKm: 8.0,
    description: '高速服务区 + 城市出入口 · 单次充电需求长（>60 min）',
    expectedImpact: '全城 100 桩 · 单桩平均会话翻倍',
    actions: [
      {
        id: 'long_session_fee',
        label: '超时阶梯计费',
        detail: '60 min 后每分钟 1 元，引导按需停充',
        recommended: true,
      },
      {
        id: 'queue_app',
        label: '排队预约 app 强提醒',
        detail: '预测等待时间，转移 30% 用户',
        recommended: true,
      },
      {
        id: 'overtime_staff',
        label: '运营商加班响应',
        detail: '4 运营商各加 2 名 7×24 维护工程师',
        recommended: false,
      },
    ],
  },
  {
    id: 'typhoon',
    name: '台风暴雨黄色预警',
    englishName: 'Typhoon Warning',
    icon: Cloud,
    centerLat: 30.27,
    centerLng: 120.16,
    radiusKm: 12.0,
    description: '杭州气象局发布台风预警 · 下沉式车库桩进入高水位风险',
    expectedImpact: '半径 12 km 全市 · 风险桩 18 个（地下停车场）',
    actions: [
      {
        id: 'shutdown_underground',
        label: '紧急停用地下桩',
        detail: '所有 -2 层及以下桩远程切电待命',
        recommended: true,
      },
      {
        id: 'monitor_voltage',
        label: '提升监测频率到 1Hz',
        detail: '电压电流采样从 60s 提至 1s',
        recommended: true,
      },
      {
        id: 'reroute',
        label: '推送替代桩位',
        detail: 'driver app 推送地面 / 多层地上桩',
        recommended: true,
      },
    ],
  },
]

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function EmergencyDetail() {
  const piles = usePiles()
  const operators = useOperators()
  const [active, setActive] = useState<EmergencyEvent | null>(null)
  const [pulse, setPulse] = useState(0)
  const [appliedActions, setAppliedActions] = useState<Set<string>>(new Set())
  const pulseRef = useRef<number | null>(null)

  // Restart pulse when event changes.
  useEffect(() => {
    setPulse(0)
    setAppliedActions(new Set())
    if (pulseRef.current) window.clearInterval(pulseRef.current)
    if (!active) return
    pulseRef.current = window.setInterval(() => {
      setPulse((p) => (p + 1) % 60)
    }, 80)
    return () => {
      if (pulseRef.current) window.clearInterval(pulseRef.current)
    }
  }, [active])

  // Pre-select recommended actions whenever active changes.
  useEffect(() => {
    if (!active) return
    const initial = new Set(active.actions.filter((a) => a.recommended).map((a) => a.id))
    setAppliedActions(initial)
  }, [active])

  // Highlight piles inside the affected radius.
  const affectedIds = useMemo(() => {
    if (!active) return new Set<string>()
    const set = new Set<string>()
    for (const p of piles.data ?? []) {
      const km = haversineKm(active.centerLat, active.centerLng, p.lat, p.lng)
      if (km <= active.radiusKm) set.add(p.id)
    }
    return set
  }, [active, piles.data])

  // For map visual: turn affected piles into "fault" tone so the
  // existing map renders them red. For non-affected piles, dim.
  const displayPiles: Pile[] = useMemo(() => {
    const list = piles.data ?? []
    if (!active) return list
    return list.map((p) => {
      if (affectedIds.has(p.id)) {
        return {
          ...p,
          current_status: 'fault',
          current_occupancy: Math.min(0.95, (p.current_occupancy ?? 0) + 0.3),
        }
      }
      return { ...p, current_occupancy: (p.current_occupancy ?? 0) * 0.4 }
    })
  }, [piles.data, active, affectedIds])

  const dispatchActions = () => {
    if (!active) return
    const labels = [...appliedActions]
      .map((id) => active.actions.find((a) => a.id === id)?.label ?? id)
      .join(' · ')
    toast.success('应急预案已下发', {
      description: `${active.name} · ${appliedActions.size} 项动作 · ${labels}`,
      duration: 5000,
    })
  }

  const dismiss = () => {
    setActive(null)
    toast('事件已解除', { duration: 1500 })
  }

  return (
    <div className="min-h-full bg-saas-bg-alt p-5 text-saas-text-dark">
      <DetailHeader
        eyebrow="05 · Emergency"
        title="应急响应 · Event-driven Playbooks"
        subtitle="点击事件触发器 → 影响范围动画 + 处置预案下发"
        right={
          active ? (
            <Button variant="outline" size="sm" onClick={dismiss}>
              <X className="h-3.5 w-3.5" />
              解除事件
            </Button>
          ) : null
        }
      />

      {/* Event triggers */}
      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {EVENTS.map((e) => (
          <button
            key={e.id}
            onClick={() => setActive(e)}
            className={cn(
              'group relative overflow-hidden rounded-lg border bg-white p-4 text-left shadow-sm transition-all',
              active?.id === e.id
                ? 'border-rose-400 ring-2 ring-rose-200'
                : 'border-saas-border hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-md',
            )}
          >
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-saas-text-mid">
              <e.icon className="h-3.5 w-3.5" />
              <span>{e.englishName}</span>
            </div>
            <div className="mt-1 text-base font-semibold text-saas-text-dark">{e.name}</div>
            <p className="mt-2 line-clamp-2 text-[11px] text-saas-text-mid">
              {e.description}
            </p>
            <div className="mt-3 flex items-center justify-between text-[11px]">
              <span className="text-saas-text-light">
                radius {e.radiusKm} km
              </span>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 font-mono text-[10px]',
                  active?.id === e.id
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-saas-bg-alt text-saas-text-mid group-hover:bg-rose-50 group-hover:text-rose-600',
                )}
              >
                {active?.id === e.id ? 'active' : 'trigger →'}
              </span>
            </div>
          </button>
        ))}
      </section>

      {/* Active event details */}
      {active ? (
        <section className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-[1.5fr_1fr]">
          <TechBorder variant={pulse > 30 ? 'danger' : 'warning'}>
            <div className="relative flex h-[480px] flex-col">
              <div className="flex items-center justify-between border-b border-ioc-border/50 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-ioc-text-secondary">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-ioc-warning" />
                  影响地图 · {active.name}
                </span>
                <span className="font-mono text-[10px] text-ioc-warning">
                  radius {active.radiusKm} km · {affectedIds.size} piles affected
                </span>
              </div>
              <div className="min-h-0 flex-1">
                <CityMap piles={displayPiles} />
              </div>
              {/* Pulse overlay for the impact polygon */}
              <div
                className="pointer-events-none absolute inset-0 mix-blend-screen"
                style={{
                  background: `radial-gradient(circle at 60% 50%, rgba(255,107,53,${
                    0.18 + 0.12 * Math.sin((pulse / 60) * Math.PI * 2)
                  }) 0%, transparent 55%)`,
                  transition: 'background 80ms linear',
                }}
              />
            </div>
          </TechBorder>

          <SaasCard
            title="处置预案 · Playbook"
            accessory={
              <span className="rounded-full bg-rose-100 px-2 py-0.5 font-mono text-[10px] text-rose-700">
                event active
              </span>
            }
          >
            <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3 text-[11px] leading-relaxed text-amber-900">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider">
                Expected impact
              </div>
              {active.expectedImpact}
            </div>

            <div className="mt-4 space-y-2">
              {active.actions.map((a) => (
                <ActionRow
                  key={a.id}
                  action={a}
                  applied={appliedActions.has(a.id)}
                  onToggle={() =>
                    setAppliedActions((prev) => {
                      const next = new Set(prev)
                      if (next.has(a.id)) next.delete(a.id)
                      else next.add(a.id)
                      return next
                    })
                  }
                />
              ))}
            </div>

            <Button
              variant="solid"
              className="mt-4 w-full"
              onClick={dispatchActions}
              disabled={appliedActions.size === 0}
            >
              <Truck className="h-3.5 w-3.5" />
              <span>一键下发 · {appliedActions.size} actions</span>
            </Button>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-saas-border pt-3 text-[11px] text-saas-text-mid">
              <div>
                <div className="text-saas-text-light">运营商可用</div>
                <div className="font-mono text-saas-text-dark">
                  {operators.data?.length ?? 0}
                </div>
              </div>
              <div>
                <div className="text-saas-text-light">影响桩位</div>
                <div className="font-mono text-rose-600">{affectedIds.size}</div>
              </div>
            </div>
          </SaasCard>
        </section>
      ) : (
        <section className="mt-5 rounded-lg border border-dashed border-saas-border bg-white/50 p-12 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-saas-text-light" />
          <p className="mt-3 text-sm text-saas-text-mid">
            选择上方任一事件触发场景。地图会高亮影响区域，右侧自动加载推荐动作清单。
          </p>
        </section>
      )}

      <HowItWorksCard
        className="mt-4"
        icon={<span aria-hidden>🚨</span>}
        title="应急响应预案 · How it works"
        description="选择事件类型后，规则引擎自动激活对应预案：识别影响区域、推荐处置动作（动态定价、限制单次会话、调度移动充电车），并预测未来需求走势。一键下发把多家运营商串成一致行动。"
        techBadges={['Rule Engine', 'LSTM']}
      />
    </div>
  )
}

function ActionRow({
  action,
  applied,
  onToggle,
}: {
  action: EmergencyAction
  applied: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'flex w-full items-start gap-2.5 rounded-md border px-3 py-2 text-left transition-colors',
        applied
          ? 'border-saas-accent bg-saas-accent/5'
          : 'border-saas-border hover:bg-saas-bg-alt',
      )}
    >
      <div
        className={cn(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
          applied
            ? 'border-saas-accent bg-saas-accent text-white'
            : 'border-saas-border bg-white',
        )}
      >
        {applied ? <CheckCircle2 className="h-3 w-3" /> : null}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span>{action.label}</span>
          {action.recommended ? (
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-700">
              recommended
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 text-[11px] text-saas-text-mid">{action.detail}</div>
      </div>
    </button>
  )
}
