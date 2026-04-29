import { useEffect, useRef } from 'react'
import AMapLoader from '@amap/amap-jsapi-loader'

import type { Pile } from '@/api/piles'
import { ioc, pileStatusColor } from '@/design-tokens'
import { env } from '@/lib/env'
import { cn, formatPct } from '@/lib/utils'

import { CITY_REGIONS } from './regions'
import { HZ_CENTER } from './types'

interface Props {
  piles: Pile[]
  predicted?: boolean
  onPileClick?: (pile: Pile) => void
  className?: string
}

const HEAT_COLORS = [
  'rgba(0, 212, 255, 0.10)',
  'rgba(0, 212, 255, 0.25)',
  'rgba(255, 184, 0, 0.30)',
  'rgba(255, 107, 53, 0.40)',
  'rgba(255, 107, 53, 0.55)',
]

function heatColor(v: number): string {
  const clamped = Math.max(0, Math.min(1, v))
  const idx = Math.min(HEAT_COLORS.length - 1, Math.floor(clamped * HEAT_COLORS.length))
  return HEAT_COLORS[idx]
}

function tooltipHtml(p: Pile, predicted: boolean): string {
  const dot = pileStatusColor[p.current_status]
  return `
    <div style="font-family:Inter,sans-serif;color:#fff;padding:6px 8px;font-size:11px;line-height:1.3;min-width:170px;background:${ioc.bg.deep};border:1px solid rgba(0,212,255,0.5);border-radius:3px">
      <div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(0,212,255,0.2);padding-bottom:3px;font-family:'JetBrains Mono',monospace">
        <span style="color:${ioc.accent.cyan}">${p.id.slice(0, 18)}</span>
        <span style="background:${dot}33;color:${dot};padding:1px 4px;border-radius:2px;font-size:9px;text-transform:uppercase">${p.current_status}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px 12px;margin-top:4px;font-family:'JetBrains Mono',monospace">
        <span><span style="color:${ioc.text.muted}">op</span> ${p.operator_id}</span>
        <span><span style="color:${ioc.text.muted}">region</span> ${p.region_id.replace('_', ' ').slice(0, 12)}</span>
        <span><span style="color:${ioc.text.muted}">kW</span> ${p.current_power.toFixed(1)}</span>
        <span><span style="color:${ioc.text.muted}">${predicted ? 'occ↗' : 'occ'}</span> ${formatPct(p.current_occupancy, 0)}</span>
        <span><span style="color:${ioc.text.muted}">cap</span> ${p.capacity_kw.toFixed(0)}kW</span>
        <span><span style="color:${ioc.text.muted}">V</span> ${p.current_voltage.toFixed(0)}</span>
      </div>
      <div style="margin-top:5px;text-align:center;color:${ioc.accent.cyan};opacity:0.8;font-size:10px">click to drill in →</div>
    </div>
  `
}

export function AMapCityMap({ piles, predicted = false, onPileClick, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const haloLayerRef = useRef<any[]>([])
  const markerLayerRef = useRef<any[]>([])
  const polygonLayerRef = useRef<any[]>([])
  const onPileClickRef = useRef(onPileClick)

  useEffect(() => {
    onPileClickRef.current = onPileClick
  }, [onPileClick])

  // Initial map load — once.
  useEffect(() => {
    if (!env.amapKey || !containerRef.current) return
    let cancelled = false

    AMapLoader.load({
      key: env.amapKey,
      version: '2.0',
      plugins: ['AMap.ToolBar', 'AMap.Polygon'],
    })
      .then((AMap: any) => {
        if (cancelled || !containerRef.current) return
        const map = new AMap.Map(containerRef.current, {
          center: [HZ_CENTER.lng, HZ_CENTER.lat],
          zoom: 11,
          mapStyle: 'amap://styles/grey',
          viewMode: '2D',
        })
        mapRef.current = map

        // Region polygons (drawn once)
        for (const r of CITY_REGIONS) {
          const path = r.polygon.map(([lat, lng]) => [lng, lat])
          const poly = new AMap.Polygon({
            path,
            strokeColor: ioc.accent.cyan,
            strokeWeight: 1.5,
            strokeOpacity: 0.55,
            strokeStyle: 'dashed',
            strokeDasharray: [6, 4],
            fillColor: ioc.accent.cyan,
            fillOpacity: 0.05,
          })
          poly.setMap(map)
          polygonLayerRef.current.push(poly)

          const text = new AMap.Text({
            text: `${r.name_zh} · ${r.name_en}`,
            position: [r.labelAnchor[1], r.labelAnchor[0]],
            anchor: 'center',
            style: {
              'background-color': 'transparent',
              'border-color': 'transparent',
              color: ioc.accent.cyan,
              'font-family': 'Orbitron, sans-serif',
              'font-size': '11px',
              'font-weight': '700',
              'letter-spacing': '0.25em',
              'text-transform': 'uppercase',
              'text-shadow': '0 0 8px rgba(0,212,255,0.6)',
            },
          })
          text.setMap(map)
          polygonLayerRef.current.push(text)
        }
      })
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('AMap load failed', err)
      })

    return () => {
      cancelled = true
      polygonLayerRef.current.forEach((l) => l?.setMap?.(null))
      polygonLayerRef.current = []
      haloLayerRef.current.forEach((l) => l?.setMap?.(null))
      haloLayerRef.current = []
      markerLayerRef.current.forEach((l) => l?.setMap?.(null))
      markerLayerRef.current = []
      mapRef.current?.destroy?.()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-render halos + pile markers whenever piles change.
  useEffect(() => {
    const map = mapRef.current
    const win = window as any
    const AMap = win.AMap
    if (!map || !AMap) return

    haloLayerRef.current.forEach((m) => m?.setMap?.(null))
    haloLayerRef.current = []
    markerLayerRef.current.forEach((m) => m?.setMap?.(null))
    markerLayerRef.current = []

    for (const p of piles) {
      if (p.current_occupancy > 0.05) {
        const halo = new AMap.CircleMarker({
          center: [p.lng, p.lat],
          radius: 6 + p.current_occupancy * 22,
          strokeWeight: 0,
          fillColor: heatColor(p.current_occupancy),
          fillOpacity: 1,
          bubble: true,
        })
        halo.setMap(map)
        haloLayerRef.current.push(halo)
      }

      const color = predicted ? ioc.accent.blue : pileStatusColor[p.current_status]
      const marker = new AMap.CircleMarker({
        center: [p.lng, p.lat],
        radius: 4.5,
        strokeColor: color,
        strokeWeight: 1.5,
        fillColor: color,
        fillOpacity: 0.95,
      })
      marker.on('mouseover', () => {
        map.setStatus({ cursor: 'pointer' })
        const html = tooltipHtml(p, predicted)
        map.openInfoWindow(
          new AMap.InfoWindow({ content: html, isCustom: true, offset: new AMap.Pixel(0, -10) }),
          [p.lng, p.lat],
        )
      })
      marker.on('mouseout', () => {
        map.setStatus({ cursor: 'default' })
        map.clearInfoWindow()
      })
      marker.on('click', () => onPileClickRef.current?.(p))
      marker.setMap(map)
      markerLayerRef.current.push(marker)
    }
  }, [piles, predicted])

  if (!env.amapKey) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center rounded-md border border-ioc-warning/40 bg-ioc-panel p-4 text-center text-xs text-ioc-warning',
          className,
        )}
      >
        AMap key missing · set <code className="mx-1 font-mono">VITE_AMAP_KEY</code>
        or <code className="mx-1 font-mono">VITE_MAP_PROVIDER=osm</code>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative h-full w-full overflow-hidden rounded-md bg-ioc-deep', className)}
    />
  )
}
