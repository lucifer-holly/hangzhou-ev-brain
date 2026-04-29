import { useEffect, useRef } from 'react'
import AMapLoader from '@amap/amap-jsapi-loader'

import { pileStatusColor } from '@/design-tokens'
import { env } from '@/lib/env'
import { cn } from '@/lib/utils'

import { HZ_CENTER, type MapProps } from './types'

/** Use AMap's built-in dark "amap://styles/grey" or light style. */
const STYLE = {
  dark: 'amap://styles/grey',
  light: 'amap://styles/light',
}

/**
 * AMap (高德地图 JS API 2.0) implementation.
 *
 * Requires `VITE_AMAP_KEY` to be set. When missing, this component renders
 * a guidance card instead of crashing — the OSM fallback is preferred in
 * that case (set `VITE_MAP_PROVIDER=osm`).
 */
export function AMapMap({
  center = HZ_CENTER,
  zoom = 12,
  markers = [],
  onMarkerClick,
  theme = 'dark',
  className,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<unknown>(null)
  const markerLayerRef = useRef<unknown[]>([])

  useEffect(() => {
    if (!env.amapKey || !containerRef.current) return
    let cancelled = false

    AMapLoader.load({
      key: env.amapKey,
      version: '2.0',
      plugins: ['AMap.ToolBar'],
    })
      .then((AMap: any) => {
        if (cancelled || !containerRef.current) return
        const map = new AMap.Map(containerRef.current, {
          center: [center.lng, center.lat],
          zoom,
          mapStyle: STYLE[theme],
          viewMode: '2D',
        })
        mapRef.current = map
      })
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('AMap load failed', err)
      })

    return () => {
      cancelled = true
      const map = mapRef.current as { destroy?: () => void } | null
      map?.destroy?.()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-render markers whenever the marker list changes.
  useEffect(() => {
    const map = mapRef.current as any
    if (!map) return
    markerLayerRef.current.forEach((m) => (m as any).setMap?.(null))
    markerLayerRef.current = []
    const win = window as unknown as { AMap?: any }
    const AMap = win.AMap
    if (!AMap) return

    markers.forEach((m) => {
      const color = m.status ? pileStatusColor[m.status] : '#00D4FF'
      const marker = new AMap.CircleMarker({
        center: [m.lng, m.lat],
        radius: 6,
        strokeColor: color,
        fillColor: color,
        fillOpacity: 0.85,
        strokeWeight: 1.2,
      })
      marker.setMap(map)
      if (onMarkerClick) marker.on('click', () => onMarkerClick(m))
      markerLayerRef.current.push(marker)
    })
  }, [markers, onMarkerClick])

  if (!env.amapKey) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center rounded-md border border-ioc-warning/40 bg-ioc-panel p-6 text-center text-sm text-ioc-warning',
          className,
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
      className={cn('h-full w-full overflow-hidden rounded-md bg-ioc-deep', className)}
    />
  )
}
