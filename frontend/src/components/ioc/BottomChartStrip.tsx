import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'

import type { Operator } from '@/api/operators'
import { ioc } from '@/design-tokens/colors'
import { useFaultTypes, useUtilization24h } from '@/hooks/useStats'
import { cn } from '@/lib/utils'

import { TechBorder } from './TechBorder'

interface BottomChartStripProps {
  operators: Operator[]
  className?: string
}

const FAULT_LABELS: Record<string, string> = {
  voltage_anomaly: 'Voltage 电压异常',
  thermal_fault: 'Thermal 热故障',
  vibration_event: 'Vibration 撞桩',
  cable_fault: 'Cable 电缆',
  communication_loss: 'Comm 通信',
}

const FAULT_PALETTE = [
  ioc.status.danger,
  ioc.status.warning,
  ioc.accent.cyan,
  ioc.accent.blue,
  ioc.text.muted,
]

const ECHARTS_THEME = {
  textStyle: { color: ioc.text.secondary, fontFamily: 'Inter, "PingFang SC", sans-serif' },
}

function panelTitle(label: string, accent: string) {
  return (
    <div className="flex items-center justify-between border-b border-ioc-border/50 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-ioc-text-secondary">
      <span>{label}</span>
      <span className="font-mono text-[10px]" style={{ color: accent }}>
        live · 实时
      </span>
    </div>
  )
}

export function BottomChartStrip({ operators, className }: BottomChartStripProps) {
  const utilization = useUtilization24h()
  const faults = useFaultTypes(24)

  const operatorPie = useMemo(() => {
    const data = operators.map((op) => ({
      name: op.name_zh,
      value: op.pile_count ?? 0,
      itemStyle: { color: op.color },
    }))
    const total = data.reduce((s, d) => s + d.value, 0)
    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}<br/>{c} piles · {d}%',
        backgroundColor: ioc.bg.panelSolid,
        borderColor: ioc.accent.cyan,
        textStyle: { color: ioc.text.primary, fontSize: 12 },
      },
      legend: { show: false },
      series: [
        {
          type: 'pie',
          radius: ['52%', '78%'],
          center: ['50%', '52%'],
          avoidLabelOverlap: true,
          label: {
            show: true,
            color: ioc.text.secondary,
            fontSize: 11,
            formatter: '{b}\n{d}%',
            lineHeight: 14,
          },
          labelLine: {
            length: 6,
            length2: 8,
            lineStyle: { color: ioc.text.muted },
          },
          itemStyle: {
            borderColor: ioc.bg.deep,
            borderWidth: 2,
          },
          data,
        },
      ],
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: '46%',
          style: {
            text: String(total),
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 22,
            fontWeight: 700,
            fill: ioc.accent.cyan,
            textAlign: 'center',
          },
        },
        {
          type: 'text',
          left: 'center',
          top: '60%',
          style: {
            text: 'TOTAL · 总桩',
            fontFamily: 'Inter',
            fontSize: 9,
            fill: ioc.text.muted,
            textAlign: 'center',
          },
        },
      ],
    }
  }, [operators])

  const utilizationLine = useMemo(() => {
    const hourly = utilization.data?.hourly ?? []
    const xs = hourly.map((h) => `${String(h.hour).padStart(2, '0')}:00`)
    const ys = hourly.map((h) => +(h.avg_occupancy * 100).toFixed(1))
    const peak = ys.length > 0 ? Math.max(...ys) : 0
    const trough = ys.length > 0 ? Math.min(...ys) : 0
    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: ioc.bg.panelSolid,
        borderColor: ioc.accent.cyan,
        textStyle: { color: ioc.text.primary, fontSize: 12 },
        formatter: (params: { axisValueLabel: string; value: number }[]) => {
          const p = params[0]
          return `${p.axisValueLabel}<br/>占用率 ${p.value}%`
        },
      },
      grid: { left: 32, right: 12, top: 22, bottom: 22 },
      xAxis: {
        type: 'category',
        data: xs,
        axisLine: { lineStyle: { color: ioc.text.muted } },
        axisLabel: { color: ioc.text.muted, fontSize: 9, interval: 3 },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: Math.max(40, Math.ceil(peak / 5) * 5 + 5),
        axisLine: { lineStyle: { color: ioc.text.muted } },
        axisLabel: { color: ioc.text.muted, fontSize: 9, formatter: '{value}%' },
        splitLine: { lineStyle: { color: 'rgba(0,212,255,0.08)' } },
      },
      series: [
        {
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 5,
          data: ys,
          lineStyle: { color: ioc.accent.cyan, width: 2 },
          itemStyle: { color: ioc.accent.cyan },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(0,212,255,0.4)' },
                { offset: 1, color: 'rgba(0,212,255,0.02)' },
              ],
            },
          },
          markPoint: {
            symbol: 'pin',
            symbolSize: 30,
            label: { color: ioc.bg.deep, fontSize: 9, fontWeight: 700 },
            data: [
              { type: 'max', name: 'peak', itemStyle: { color: ioc.status.warning } },
              { type: 'min', name: 'trough', itemStyle: { color: ioc.status.success } },
            ],
          },
        },
      ],
      _trough: trough,
    }
  }, [utilization.data])

  const faultDonut = useMemo(() => {
    const buckets = faults.data?.buckets ?? []
    const data = buckets.map((b, i) => ({
      name: FAULT_LABELS[b.type] ?? b.type,
      value: b.count,
      itemStyle: { color: FAULT_PALETTE[i % FAULT_PALETTE.length] },
    }))
    const total = data.reduce((s, d) => s + d.value, 0)
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: ioc.bg.panelSolid,
        borderColor: ioc.accent.cyan,
        textStyle: { color: ioc.text.primary, fontSize: 12 },
        formatter: '{b}<br/>{c} 起 · {d}%',
      },
      legend: {
        bottom: 4,
        left: 'center',
        textStyle: { color: ioc.text.muted, fontSize: 10 },
        itemWidth: 8,
        itemHeight: 8,
      },
      series: [
        {
          type: 'pie',
          radius: ['44%', '64%'],
          center: ['50%', '42%'],
          avoidLabelOverlap: true,
          label: { show: false },
          labelLine: { show: false },
          itemStyle: { borderColor: ioc.bg.deep, borderWidth: 2 },
          data,
        },
      ],
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: '36%',
          style: {
            text: String(total),
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 20,
            fontWeight: 700,
            fill: ioc.status.warning,
            textAlign: 'center',
          },
        },
        {
          type: 'text',
          left: 'center',
          top: '49%',
          style: {
            text: '24h FAULTS',
            fontFamily: 'Inter',
            fontSize: 9,
            fill: ioc.text.muted,
            textAlign: 'center',
          },
        },
      ],
    }
  }, [faults.data])

  return (
    <div className={cn('grid grid-cols-1 gap-3 md:grid-cols-3', className)}>
      <TechBorder>
        <div className="h-[180px]">
          {panelTitle('Operator Share · 运营商占比', ioc.accent.cyan)}
          <ReactECharts
            theme={ECHARTS_THEME}
            option={operatorPie}
            style={{ height: 'calc(100% - 32px)', width: '100%' }}
            notMerge
            opts={{ renderer: 'canvas' }}
          />
        </div>
      </TechBorder>

      <TechBorder>
        <div className="h-[180px]">
          {panelTitle('24h Utilization · 利用率', ioc.accent.cyan)}
          {utilization.isLoading ? (
            <div className="flex h-[148px] items-center justify-center text-xs text-ioc-text-muted">
              loading · 加载中
            </div>
          ) : (
            <ReactECharts
              theme={ECHARTS_THEME}
              option={utilizationLine}
              style={{ height: 'calc(100% - 32px)', width: '100%' }}
              notMerge
              opts={{ renderer: 'canvas' }}
            />
          )}
        </div>
      </TechBorder>

      <TechBorder variant={(faults.data?.total ?? 0) > 30 ? 'warning' : 'cyan'}>
        <div className="h-[180px]">
          {panelTitle('Fault Distribution · 异常分布', ioc.status.warning)}
          {faults.isLoading ? (
            <div className="flex h-[148px] items-center justify-center text-xs text-ioc-text-muted">
              loading · 加载中
            </div>
          ) : (
            <ReactECharts
              theme={ECHARTS_THEME}
              option={faultDonut}
              style={{ height: 'calc(100% - 32px)', width: '100%' }}
              notMerge
              opts={{ renderer: 'canvas' }}
            />
          )}
        </div>
      </TechBorder>
    </div>
  )
}
