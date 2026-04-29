import { useEffect, useRef } from 'react'
import AMapLoader from '@amap/amap-jsapi-loader'

import { ioc } from '@/design-tokens/colors'
import { env } from '@/lib/env'
import { cn } from '@/lib/utils'

import { CITY_REGIONS } from './regions'
import {
  CANDIDATE_COLORS,
  HZ_CENTER,
  type SiteCandidate,
  type SiteMapProps,
} from './types'

/**
 * AMap (高德 JS API 2.0) implementation of the Site Selection map.
 * Active when `VITE_MAP_PROVIDER=amap` and `VITE_AMAP_KEY` is set.
 */
export function AMapSiteMap({
  candidates,
  existingPiles,
  activeId,
  onMapClick,
  onCandidateClick,
}: SiteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<unknown>(null)
  const candidateLayerRef = useRef<unknown[]>([])
  const existingLayerRef = useRef<unknown[]>([])
  const regionLayerRef = useRef<unknown[]>([])
  const onMapClickRef = useRef(onMapClick)
  const onCandidateClickRef = useRef(onCandidateClick)

  // Keep latest handlers without re-initialising the map.
  useEffect(() => {
    onMapClickRef.current = onMapClick
    onCandidateClickRef.current = onCandidateClick
  }, [onMapClick, onCandidateClick])

  // ---- Map init (once) ----
  useEffect(() => {
    if (!env.amapKey || !containerRef.current) return
    let cancelled = false

    if (env.amapSecurity) {
      const w = window as unknown as {
        _AMapSecurityConfig?: { securityJsCode: string }
      }
      w._AMapSecurityConfig = { securityJsCode: env.amapSecurity }
    }

    AMapLoader.load({
      key: env.amapKey,
      version: '2.0',
      plugins: ['AMap.ToolBar'],
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

        // Region polygons + glow labels
        for (const r of CITY_REGIONS) {
          const path = r.polygon.map(([lat, lng]) => [lng, lat])
          const polygon = new AMap.Polygon({
            path,
            strokeColor: ioc.accent.cyan,
            strokeOpacity: 0.45,
            strokeWeight: 1.2,
            strokeStyle: 'dashed',
            fillColor: ioc.accent.cyan,
            fillOpacity: 0.04,
          })
          polygon.setMap(map)
          regionLayerRef.current.push(polygon)

          const lats = r.polygon.map(([lat]) => lat)
          const lngs = r.polygon.map(([, lng]) => lng)
          const center: [number, number] = [
            (Math.min(...lngs) + Math.max(...lngs)) / 2,
            (Math.min(...lats) + Math.max(...lats)) / 2,
          ]
          const text = new AMap.Text({
            text: r.name_zh,
            position: center,
            anchor: 'center',
            style: {
              background: 'transparent',
              border: 'none',
              color: ioc.accent.cyan,
              fontFamily:
                'Geist, Manrope, "PingFang SC", system-ui, sans-serif',
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              textShadow: `0 0 8px ${ioc.accent.cyan}`,
            },
          })
          text.setMap(map)
          regionLayerRef.current.push(text)
        }

        // Click → add candidate
        map.on('click', (e: { lnglat: { getLat: () => number; getLng: () => number } }) => {
          onMapClickRef.current(e.lnglat.getLat(), e.lnglat.getLng())
        })
      })
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('AMap site-map load failed', err)
      })

    return () => {
      cancelled = true
      const map = mapRef.current as { destroy?: () => void } | null
      map?.destroy?.()
      mapRef.current = null
      regionLayerRef.current = []
      existingLayerRef.current = []
      candidateLayerRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Existing piles (mostly static) ----
  useEffect(() => {
    const map = mapRef.current as any
    if (!map) return
    const win = window as unknown as { AMap?: any }
    const AMap = win.AMap
    if (!AMap) return

    existingLayerRef.current.forEach((m) => (m as any).setMap?.(null))
    existingLayerRef.current = []

    for (const p of existingPiles) {
      const dot = new AMap.CircleMarker({
        center: [p.lng, p.lat],
        radius: 2,
        strokeColor: ioc.text.muted,
        strokeWeight: 0.5,
        fillColor: ioc.text.muted,
        fillOpacity: 0.6,
        bubble: true,
      })
      dot.setMap(map)
      existingLayerRef.current.push(dot)
    }
  }, [existingPiles])

  // ---- Candidates (re-render whenever list/active changes) ----
  useEffect(() => {
    const map = mapRef.current as any
    if (!map) return
    const win = window as unknown as { AMap?: any }
    const AMap = win.AMap
    if (!AMap) return

    candidateLayerRef.current.forEach((m) => (m as any).setMap?.(null))
    candidateLayerRef.current = []

    candidates.forEach((c: SiteCandidate) => {
      const color = CANDIDATE_COLORS[c.index % CANDIDATE_COLORS.length]
      const radius = c.id === activeId ? 12 : 8
      const marker = new AMap.CircleMarker({
        center: [c.lng, c.lat],
        radius,
        strokeColor: color,
        strokeWeight: 2,
        fillColor: color,
        fillOpacity: 0.7,
        cursor: 'pointer',
      })
      marker.setMap(map)
      marker.on('click', (e: { originEvent?: Event }) => {
        e.originEvent?.stopPropagation?.()
        onCandidateClickRef.current(c.id)
      })

      const labelText = `candidate #${c.index + 1}${c.predictionLabel ? ` · ${c.predictionLabel}` : ''}`
      const label = new AMap.Text({
        text: labelText,
        position: [c.lng, c.lat],
        anchor: 'bottom-center',
        offset: new AMap.Pixel(0, -radius - 4),
        style: {
          background: 'rgba(10,14,26,0.92)',
          border: `1px solid ${color}`,
          borderRadius: '3px',
          color: '#fff',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '11px',
          padding: '2px 6px',
        },
      })
      label.setMap(map)

      candidateLayerRef.current.push(marker, label)
    })
  }, [candidates, activeId])

  if (!env.amapKey) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center rounded-md border border-ioc-warning/40 bg-ioc-panel p-6 text-center text-sm text-ioc-warning',
        )}
      >
        AMap key missing · set <code className="mx-1 font-mono">VITE_AMAP_KEY</code> or
        switch <code className="mx-1 font-mono">VITE_MAP_PROVIDER=osm</code>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden rounded-md bg-ioc-deep"
    />
  )
}
