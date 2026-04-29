import {
  CircleMarker,
  MapContainer,
  Polygon,
  TileLayer,
  Tooltip,
  useMapEvents,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import { ioc } from '@/design-tokens/colors'

import { CITY_REGIONS } from './regions'
import {
  CANDIDATE_COLORS,
  HZ_CENTER,
  type SiteCandidate,
  type SiteMapProps,
} from './types'

/**
 * OSM/Leaflet implementation of the Site Selection map.
 * Active when `VITE_MAP_PROVIDER=osm` (or AMap key missing).
 */
export function OSMSiteMap({
  candidates,
  existingPiles,
  activeId,
  onMapClick,
  onCandidateClick,
}: SiteMapProps) {
  return (
    <MapContainer
      center={[HZ_CENTER.lat, HZ_CENTER.lng]}
      zoom={11}
      scrollWheelZoom
      zoomControl={false}
      className="h-full w-full bg-ioc-deep"
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution="&copy; CARTO &copy; OpenStreetMap"
        subdomains={['a', 'b', 'c', 'd']}
      />

      {CITY_REGIONS.map((r) => (
        <Polygon
          key={r.id}
          positions={r.polygon}
          pathOptions={{
            color: ioc.accent.cyan,
            weight: 1.2,
            opacity: 0.45,
            fillColor: ioc.accent.cyan,
            fillOpacity: 0.04,
            dashArray: '6 4',
          }}
        >
          <Tooltip direction="center" permanent opacity={0.85}>
            <span
              className="font-title text-[10px] font-bold uppercase tracking-[0.25em]"
              style={{ color: ioc.accent.cyan }}
            >
              {r.name_zh}
            </span>
          </Tooltip>
        </Polygon>
      ))}

      {existingPiles.map((p) => (
        <CircleMarker
          key={p.id}
          center={[p.lat, p.lng]}
          radius={2}
          interactive={false}
          pathOptions={{
            color: ioc.text.muted,
            fillColor: ioc.text.muted,
            fillOpacity: 0.6,
            weight: 0.5,
          }}
        />
      ))}

      {candidates.map((c: SiteCandidate) => (
        <CircleMarker
          key={c.id}
          center={[c.lat, c.lng]}
          radius={c.id === activeId ? 12 : 8}
          eventHandlers={{ click: () => onCandidateClick(c.id) }}
          pathOptions={{
            color: CANDIDATE_COLORS[c.index % CANDIDATE_COLORS.length],
            fillColor: CANDIDATE_COLORS[c.index % CANDIDATE_COLORS.length],
            fillOpacity: 0.7,
            weight: 2,
          }}
        >
          <Tooltip direction="top" offset={[0, -8]} opacity={1}>
            <span className="font-mono text-[11px]">
              candidate #{c.index + 1}
              {c.predictionLabel ? ` · ${c.predictionLabel}` : ''}
            </span>
          </Tooltip>
        </CircleMarker>
      ))}

      <ClickListener onMapClick={onMapClick} />
    </MapContainer>
  )
}

function ClickListener({
  onMapClick,
}: {
  onMapClick: (lat: number, lng: number) => void
}) {
  useMapEvents({
    click: (e) => onMapClick(e.latlng.lat, e.latlng.lng),
  })
  return null
}
