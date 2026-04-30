import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Loader2,
  ShieldAlert,
} from 'lucide-react'
import { toast } from 'sonner'

import { checkAnomaly, detectYolo, type AnomalyResponse, type YoloResponse } from '@/api/ai'
import { useEvents } from '@/hooks/useEvents'
import { useOperators, useRegions } from '@/hooks/useOperators'
import { usePile, useTelemetry } from '@/hooks/usePiles'
import { saas } from '@/design-tokens/colors'
import { Button } from '@/components/ui/button'
import { cn, formatPct } from '@/lib/utils'

import { DetailHeader } from './_shared/DetailHeader'
import { SaasCard } from './_shared/SaasCard'

const STATUS_COLORS: Record<string, string> = {
  idle: '#10b981',
  charging: '#0ea5e9',
  occupied: '#f59e0b',
  fault: '#f43f5e',
  offline: '#94a3b8',
}

export function PileDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const pile = usePile(id)
  const telemetry = useTelemetry(id, 720)
  const events = useEvents({ pile_id: id, limit: 200 })
  const operators = useOperators()
  const regions = useRegions()

  const [anomaly, setAnomaly] = useState<AnomalyResponse | null>(null)
  const [anomalyLoading, setAnomalyLoading] = useState(false)
  const [yolo, setYolo] = useState<YoloResponse | null>(null)
  const [yoloLoading, setYoloLoading] = useState(false)
  const yoloImgRef = useRef<HTMLImageElement | null>(null)
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)

  // Run anomaly check on mount.
  useEffect(() => {
    if (!id) return
    setAnomaly(null)
    setAnomalyLoading(true)
    checkAnomaly(id)
      .then(setAnomaly)
      .catch((e) => toast.error('Anomaly check failed', { description: String(e) }))
      .finally(() => setAnomalyLoading(false))
  }, [id])

  const opName = useMemo(() => {
    if (!pile.data) return ''
    return (
      operators.data?.find((o) => o.id === pile.data?.operator_id)?.name_zh ??
      pile.data.operator_id
    )
  }, [pile.data, operators.data])

  const regionName = useMemo(() => {
    if (!pile.data) return ''
    return (
      regions.data?.find((r) => r.id === pile.data?.region_id)?.name_zh ??
      pile.data.region_id
    )
  }, [pile.data, regions.data])

  const runYolo = async () => {
    setYoloLoading(true)
    setYolo(null)
    try {
      const res = await fetch('/sample-parking.jpg')
      if (!res.ok) throw new Error(`fetch sample image: ${res.status}`)
      const blob = await res.blob()
      const file = new File([blob], 'sample-parking.jpg', { type: blob.type })
      const out = await detectYolo(file)
      setYolo(out)
      toast.success('YOLO 推断完成', {
        description: `${out.vehicle_count} vehicles · ${out.inference_ms.toFixed(1)} ms`,
        duration: 3000,
      })
    } catch (e) {
      toast.error('YOLO 推断失败', { description: String(e) })
    } finally {
      setYoloLoading(false)
    }
  }

  if (!id) {
    return (
      <div className="p-5 text-saas-text-mid">no pile id</div>
    )
  }

  return (
    <div className="min-h-full bg-saas-bg-alt p-5 text-saas-text-dark">
      <DetailHeader
        eyebrow="Pile detail"
        title={pile.data ? `单桩详情 · ${id}` : `Loading · ${id}`}
        subtitle={
          pile.data
            ? `${opName} · ${regionName} · ${pile.data.capacity_kw.toFixed(0)} kW · ${pile.data.connector_type}`
            : '从 /api/piles/{id} 拉取数据'
        }
        right={
          <Button variant="outline" size="sm" onClick={() => navigate('/city')}>
            <ArrowLeft className="h-3.5 w-3.5" />
            返回首页
          </Button>
        }
      />

      {pile.isError ? (
        <div className="mt-8 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Failed to load pile: {String(pile.error)}
        </div>
      ) : null}

      {pile.data ? (
        <>
          {/* Pile metadata strip */}
          <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <MetaCell label="Status" value={pile.data.current_status}
              tone={STATUS_COLORS[pile.data.current_status]} />
            <MetaCell
              label="Power"
              value={`${pile.data.current_power.toFixed(1)} kW`}
              sub={`occ ${formatPct(pile.data.current_occupancy, 0)}`}
            />
            <MetaCell
              label="Voltage / Current"
              value={`${pile.data.current_voltage.toFixed(0)} V`}
              sub={`${pile.data.current_current.toFixed(1)} A`}
            />
            <MetaCell
              label="Subsidy"
              value={`¥${pile.data.subsidy_amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
              sub={pile.data.subsidy_group}
            />
            <MetaCell
              label="Coordinates"
              value={`${pile.data.lat.toFixed(4)}°N`}
              sub={`${pile.data.lng.toFixed(4)}°E`}
            />
          </section>

          {/* 24h telemetry + anomaly + summary */}
          <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_1fr]">
            <SaasCard
              title="24h 遥测 · 4-channel timeline"
              accessory={
                <span className="font-mono text-[11px] text-saas-text-light">
                  {telemetry.data?.length ?? 0} points · 1h cadence
                </span>
              }
            >
              {telemetry.isLoading ? (
                <div className="flex h-72 items-center justify-center text-sm text-saas-text-mid">
                  loading…
                </div>
              ) : (
                <TelemetryChart points={telemetry.data ?? []} />
              )}
            </SaasCard>

            <div className="flex flex-col gap-3">
              <SaasCard
                title="异常检测 · Autoencoder"
                accessory={
                  <span className="font-mono text-[11px] text-saas-text-light">
                    /api/ai/anomaly/{id.slice(0, 14)}
                  </span>
                }
              >
                {anomalyLoading ? (
                  <div className="flex h-32 items-center justify-center gap-2 text-sm text-saas-text-mid">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AI inference…
                  </div>
                ) : anomaly ? (
                  <AnomalyView anomaly={anomaly} />
                ) : (
                  <div className="text-xs text-saas-text-light">no result</div>
                )}
              </SaasCard>

              <SaasCard
                title="占位识别 · YOLOv8 demo"
                accessory={
                  <Button
                    variant="solid"
                    size="sm"
                    onClick={runYolo}
                    disabled={yoloLoading}
                  >
                    <Camera className="h-3.5 w-3.5" />
                    {yoloLoading ? '推断中…' : '运行检测'}
                  </Button>
                }
              >
                <YoloPanel
                  yolo={yolo}
                  loading={yoloLoading}
                  imgRef={yoloImgRef}
                  imgSize={imgSize}
                  setImgSize={setImgSize}
                />
              </SaasCard>
            </div>
          </section>

          {/* Event history */}
          <SaasCard
            className="mt-4"
            title="事件历史 · Event log"
            accessory={
              <span className="font-mono text-[11px] text-saas-text-light">
                {events.data?.length ?? 0} events · newest first
              </span>
            }
            padded={false}
          >
            <EventLog events={events.data ?? []} />
          </SaasCard>
        </>
      ) : (
        <div className="mt-8 flex h-40 items-center justify-center text-sm text-saas-text-mid">
          loading pile…
        </div>
      )}
    </div>
  )
}

/* ----------------------------- meta ----------------------------- */

function MetaCell({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: string
}) {
  return (
    <div className="rounded-lg border border-saas-border bg-white p-3 shadow-sm">
      <div className="text-[10px] uppercase tracking-wider text-saas-text-mid">
        {label}
      </div>
      <div
        className="mt-1 font-mono text-base font-semibold tabular-nums"
        style={tone ? { color: tone } : undefined}
      >
        {value}
      </div>
      {sub ? <div className="text-[11px] text-saas-text-light">{sub}</div> : null}
    </div>
  )
}

/* ----------------------------- telemetry chart ----------------------------- */

function TelemetryChart({
  points,
}: {
  points: { ts: string; voltage: number; current: number; power: number; occupancy_rate: number }[]
}) {
  const option = useMemo(() => {
    const data = [...points]
      .map((p) => ({
        t: new Date(p.ts).getTime(),
        voltage: p.voltage,
        current: p.current,
        power: p.power,
        occ: p.occupancy_rate * 100,
      }))
      .sort((a, b) => a.t - b.t)
    return {
      animation: false,
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#fff',
        borderColor: saas.border,
        textStyle: { color: saas.text.dark, fontSize: 12 },
      },
      legend: {
        data: ['Voltage (V)', 'Current (A)', 'Power (kW)', 'Occupancy (%)'],
        top: 0,
        textStyle: { color: saas.text.mid, fontSize: 11 },
      },
      grid: { left: 56, right: 56, top: 36, bottom: 32 },
      xAxis: {
        type: 'time',
        axisLabel: { color: saas.text.mid, fontSize: 10 },
        axisLine: { lineStyle: { color: saas.border } },
        splitLine: { show: false },
      },
      yAxis: [
        {
          type: 'value',
          axisLabel: { color: saas.text.mid, fontSize: 10 },
          axisLine: { lineStyle: { color: saas.border } },
          splitLine: { lineStyle: { color: saas.border, type: 'dashed' } },
        },
        {
          type: 'value',
          name: '%',
          axisLabel: { color: saas.text.mid, fontSize: 10 },
          axisLine: { lineStyle: { color: saas.border } },
          splitLine: { show: false },
          max: 100,
          min: 0,
        },
      ],
      series: [
        {
          name: 'Voltage (V)',
          type: 'line',
          showSymbol: false,
          smooth: true,
          data: data.map((p) => [p.t, p.voltage]),
          lineStyle: { color: '#0ea5e9', width: 1.6 },
        },
        {
          name: 'Current (A)',
          type: 'line',
          showSymbol: false,
          smooth: true,
          data: data.map((p) => [p.t, p.current]),
          lineStyle: { color: '#f59e0b', width: 1.6 },
        },
        {
          name: 'Power (kW)',
          type: 'line',
          showSymbol: false,
          smooth: true,
          data: data.map((p) => [p.t, p.power]),
          lineStyle: { color: saas.accent, width: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(37,99,235,0.20)' },
                { offset: 1, color: 'rgba(37,99,235,0.02)' },
              ],
            },
          },
        },
        {
          name: 'Occupancy (%)',
          type: 'line',
          yAxisIndex: 1,
          showSymbol: false,
          smooth: true,
          data: data.map((p) => [p.t, p.occ]),
          lineStyle: { color: '#10b981', width: 1.4, type: 'dashed' },
        },
      ],
    }
  }, [points])

  return (
    <ReactECharts
      option={option}
      notMerge
      style={{ width: '100%', height: 280 }}
      opts={{ renderer: 'canvas' }}
    />
  )
}

/* ----------------------------- anomaly view ----------------------------- */

function AnomalyView({ anomaly }: { anomaly: AnomalyResponse }) {
  const ratio = Math.min(1, anomaly.reconstruction_error / anomaly.threshold)
  return (
    <>
      <div className="flex items-center gap-3">
        {anomaly.is_anomaly ? (
          <ShieldAlert className="h-9 w-9 text-rose-500" />
        ) : (
          <CheckCircle2 className="h-9 w-9 text-emerald-500" />
        )}
        <div>
          <div className="text-xs uppercase tracking-wider text-saas-text-mid">
            状态
          </div>
          <div
            className={cn(
              'font-title text-xl font-bold',
              anomaly.is_anomaly ? 'text-rose-600' : 'text-emerald-600',
            )}
          >
            {anomaly.is_anomaly ? 'ANOMALY DETECTED' : 'NORMAL'}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-xs">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-saas-text-mid">Reconstruction error</span>
            <span className="font-mono tabular-nums">
              {anomaly.reconstruction_error.toFixed(5)}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-saas-bg-alt">
            <div
              className={cn(
                'h-full transition-all',
                anomaly.is_anomaly ? 'bg-rose-500' : 'bg-emerald-500',
              )}
              style={{ width: `${(ratio * 100).toFixed(0)}%` }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-saas-text-mid">Threshold</span>
          <span className="font-mono tabular-nums">
            {anomaly.threshold.toFixed(5)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-saas-text-mid">Margin ratio</span>
          <span className="font-mono tabular-nums">
            {(anomaly.margin_ratio * 100).toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="mt-3 rounded-md border border-saas-border bg-saas-bg-alt/60 p-2 text-[11px] text-saas-text-mid">
        Cloud autoencoder (8→32→8 latent) checks the latest 60s telemetry window. Edge
        TFLite Micro variant runs same architecture on ESP32-S3.
      </div>
    </>
  )
}

/* ----------------------------- yolo panel ----------------------------- */

function YoloPanel({
  yolo,
  loading,
  imgRef,
  imgSize,
  setImgSize,
}: {
  yolo: YoloResponse | null
  loading: boolean
  imgRef: React.RefObject<HTMLImageElement>
  imgSize: { w: number; h: number } | null
  setImgSize: React.Dispatch<React.SetStateAction<{ w: number; h: number } | null>>
}) {
  return (
    <div>
      {!yolo && !loading ? (
        <div className="rounded-md border border-dashed border-saas-border bg-saas-bg-alt/40 p-4 text-center text-xs text-saas-text-mid">
          点击右上角 “运行检测” 上传 sample 停车场图像 →
          /api/ai/yolo/detect (Ultralytics YOLOv8n)
        </div>
      ) : null}

      {loading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-saas-text-mid">
          <Loader2 className="h-4 w-4 animate-spin" />
          推断中…
        </div>
      ) : null}

      {yolo ? (
        <>
          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            <div className="rounded-md border border-saas-border bg-white p-2">
              <div className="text-saas-text-mid">车辆数</div>
              <div className="font-title text-lg font-bold">
                {yolo.vehicle_count}
              </div>
            </div>
            <div className="rounded-md border border-saas-border bg-white p-2">
              <div className="text-saas-text-mid">推断耗时</div>
              <div className="font-title text-lg font-bold">
                {yolo.inference_ms.toFixed(0)} ms
              </div>
            </div>
            <div className="rounded-md border border-saas-border bg-white p-2">
              <div className="text-saas-text-mid">分辨率</div>
              <div className="font-mono text-xs">
                {yolo.image_width}×{yolo.image_height}
              </div>
            </div>
          </div>
          <div className="relative mt-3 overflow-hidden rounded-md border border-saas-border bg-black">
            <img
              ref={imgRef}
              src="/sample-parking.jpg"
              alt="sample parking lot"
              loading="lazy"
              decoding="async"
              className="block h-auto w-full"
              onLoad={(e) =>
                setImgSize({
                  w: e.currentTarget.naturalWidth,
                  h: e.currentTarget.naturalHeight,
                })
              }
            />
            {imgSize && yolo.boxes.length > 0
              ? yolo.boxes.map((b, i) => {
                  const left = (b.x1 / yolo.image_width) * 100
                  const top = (b.y1 / yolo.image_height) * 100
                  const w = ((b.x2 - b.x1) / yolo.image_width) * 100
                  const h = ((b.y2 - b.y1) / yolo.image_height) * 100
                  return (
                    <div
                      key={i}
                      className="pointer-events-none absolute border-2 border-emerald-400/80"
                      style={{
                        left: `${left}%`,
                        top: `${top}%`,
                        width: `${w}%`,
                        height: `${h}%`,
                      }}
                    >
                      <span className="absolute -top-4 left-0 rounded bg-emerald-500 px-1 py-0.5 text-[9px] font-bold text-black">
                        {b.class_name} {(b.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  )
                })
              : null}
          </div>
          {yolo.boxes.length === 0 ? (
            <p className="mt-2 text-[11px] text-saas-text-light">
              No detections in this sample frame — try with a different stock image.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

/* ----------------------------- event log ----------------------------- */

function EventLog({
  events,
}: {
  events: {
    id: number
    ts: string
    type: string
    severity: string
    message: string
    duration_minutes: number
    resolved: boolean
  }[]
}) {
  const sevTone: Record<string, string> = {
    info: 'bg-slate-100 text-slate-700',
    warning: 'bg-amber-100 text-amber-700',
    critical: 'bg-rose-100 text-rose-700',
  }
  if (events.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-saas-text-light">
        no events recorded
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-saas-border text-left text-xs uppercase tracking-wider text-saas-text-mid">
            <th className="px-4 py-2 font-medium">Time</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Severity</th>
            <th className="px-3 py-2 font-medium">Duration</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Message</th>
          </tr>
        </thead>
        <tbody>
          {events.slice(0, 30).map((e) => (
            <tr key={e.id} className="border-b border-saas-border/60">
              <td className="px-4 py-2 font-mono text-[11px] text-saas-text-mid">
                {new Date(e.ts).toLocaleString('zh-CN', { hour12: false })}
              </td>
              <td className="px-3 py-2">
                <span className="rounded-full bg-saas-bg-alt px-2 py-0.5 text-[11px] font-medium">
                  {e.type}
                </span>
              </td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase',
                    sevTone[e.severity] ?? 'bg-slate-100 text-slate-700',
                  )}
                >
                  {e.severity}
                </span>
              </td>
              <td className="px-3 py-2 tabular-nums">{e.duration_minutes.toFixed(1)} min</td>
              <td className="px-3 py-2">
                {e.resolved ? (
                  <span className="text-emerald-600">resolved</span>
                ) : (
                  <span className="text-amber-600">open</span>
                )}
              </td>
              <td className="px-3 py-2 max-w-[320px] truncate text-saas-text-mid">
                {e.message}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

