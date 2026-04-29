import { useEffect } from 'react'
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import { pileStatusColor } from '@/design-tokens'
import { cn } from '@/lib/utils'

import { HZ_CENTER, type MapProps } from './types'

/** Imperatively re-centre the map when props change. */
function MapRecenter({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], zoom)
  }, [map, lat, lng, zoom])
  return null
}

/**
 * OpenStreetMap fallback (no API key required).
 *
 * Uses Carto's free dark/positron tiles to align with the IOC palette.
 * Note: Carto tiles are free for low-volume / non-commercial use; for
 * production the AMap provider is preferred.
 */
export function OSMMap({
  center = HZ_CENTER,
  zoom = 12,
  markers = [],
  onMarkerClick,
  theme = 'dark',
  className,
}: MapProps) {
  const tileUrl =
    theme === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

  return (
    <div className={cn('h-full w-full overflow-hidden rounded-md', className)}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        scrollWheelZoom
        className="h-full w-full bg-ioc-deep"
      >
        <TileLayer
          url={tileUrl}
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap contributors'
          subdomains={['a', 'b', 'c', 'd']}
        />
        <MapRecenter lat={center.lat} lng={center.lng} zoom={zoom} />
        {markers.map((m) => {
          const color = m.status ? pileStatusColor[m.status] : '#00D4FF'
          return (
            <CircleMarker
              key={m.id}
              center={[m.lat, m.lng]}
              radius={6}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.85,
                weight: 1.2,
              }}
              eventHandlers={{ click: () => onMarkerClick?.(m) }}
            >
              {m.label ? <Tooltip>{m.label}</Tooltip> : null}
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}
