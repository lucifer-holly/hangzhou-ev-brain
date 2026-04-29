import { useEffect, useMemo } from 'react'
import {
  CircleMarker,
  MapContainer,
  Polygon,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import type { Pile } from '@/api/piles'
import { ioc, pileStatusColor } from '@/design-tokens'
import { cn, formatPct } from '@/lib/utils'

import { CITY_REGIONS } from './regions'
import { HZ_CENTER } from './types'

interface Props {
  piles: Pile[]
  /** When true, treat occupancy as a forecast value (different palette). */
  predicted?: boolean
  onPileClick?: (pile: Pile) => void
  className?: string
}

const HEAT_GRADIENT = [
  { stop: 0.0, color: 'rgba(0, 212, 255, 0.0)' },
  { stop: 0.25, color: 'rgba(0, 212, 255, 0.25)' },
  { stop: 0.5, color: 'rgba(255, 184, 0, 0.30)' },
  { stop: 0.75, color: 'rgba(255, 107, 53, 0.40)' },
  { stop: 1.0, color: 'rgba(255, 107, 53, 0.55)' },
]

function heatColor(value: number): string {
  const v = Math.max(0, Math.min(1, value))
  for (let i = 1; i < HEAT_GRADIENT.length; i++) {
    if (v <= HEAT_GRADIENT[i].stop) return HEAT_GRADIENT[i].color
  }
  return HEAT_GRADIENT[HEAT_GRADIENT.length - 1].color
}

function MapRecenter({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], zoom)
  }, [map, lat, lng, zoom])
  return null
}

export function OSMCityMap({
  piles,
  predicted = false,
  onPileClick,
  className,
}: Props) {
  const center = HZ_CENTER

  const haloPoints = useMemo(() => {
    return piles
      .filter((p) => p.current_occupancy > 0.05)
      .map((p) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        occupancy: p.current_occupancy,
      }))
  }, [piles])

  return (
    <div className={cn('relative h-full w-full overflow-hidden rounded-md', className)}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={11}
        scrollWheelZoom
        zoomControl={false}
        className="h-full w-full bg-ioc-deep"
      >
        <MapRecenter lat={center.lat} lng={center.lng} zoom={11} />
        {/* OSM dark tiles via Carto */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; CARTO &copy; OpenStreetMap"
          subdomains={['a', 'b', 'c', 'd']}
        />

        {/* Region polygons */}
        {CITY_REGIONS.map((r) => (
          <Polygon
            key={r.id}
            positions={r.polygon}
            pathOptions={{
              color: ioc.accent.cyan,
              weight: 1.5,
              opacity: 0.55,
              fillColor: ioc.accent.cyan,
              fillOpacity: 0.05,
              dashArray: '6 4',
            }}
          >
            <Tooltip
              direction="center"
              permanent
              opacity={0.85}
              className="!border-none !bg-transparent !shadow-none"
            >
              <span
                className="font-title text-[11px] font-bold uppercase tracking-[0.25em]"
                style={{
                  color: ioc.accent.cyan,
                  textShadow:
                    '0 0 6px rgba(0,212,255,0.75), 0 0 12px rgba(0,212,255,0.4)',
                }}
              >
                {r.name_zh} · {r.name_en}
              </span>
            </Tooltip>
          </Polygon>
        ))}

        {/* Heat halos — translucent circles sized by occupancy. Multiple
            overlapping halos visually approximate a KDE heatmap without
            requiring leaflet.heat. */}
        {haloPoints.map((h) => (
          <CircleMarker
            key={`halo:${h.id}`}
            center={[h.lat, h.lng]}
            radius={6 + h.occupancy * 22}
            pathOptions={{
              stroke: false,
              fillColor: heatColor(h.occupancy),
              fillOpacity: 1,
            }}
            interactive={false}
          />
        ))}

        {/* Pile markers — click + hover tooltip */}
        {piles.map((p) => {
          const color = predicted ? ioc.accent.blue : pileStatusColor[p.current_status]
          return (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lng]}
              radius={4.5}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.95,
                weight: 1.5,
              }}
              eventHandlers={{ click: () => onPileClick?.(p) }}
            >
              <Tooltip
                direction="top"
                offset={[0, -6]}
                opacity={1}
                className="!rounded !border !border-ioc-cyan/50 !bg-ioc-deep/95 !text-ioc-text-primary"
              >
                <PileTooltip pile={p} predicted={predicted} />
              </Tooltip>
            </CircleMarker>
          )
        })}
      </MapContainer>

      {/* Legend overlay */}
      <div className="pointer-events-none absolute bottom-2 left-2 z-[1000] rounded-sm border border-ioc-border bg-ioc-deep/85 px-2 py-1.5 text-[10px] text-ioc-text-secondary">
        <div className="flex items-center gap-3">
          <LegendDot color={ioc.status.success} label="idle" />
          <LegendDot color={ioc.accent.cyan} label="charging" />
          <LegendDot color={ioc.status.warning} label="occupied" />
          <LegendDot color={ioc.status.danger} label="fault" />
          <LegendDot color={ioc.text.muted} label="offline" />
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span>Heat:</span>
          <span className="inline-block h-1.5 w-32 rounded-sm bg-gradient-to-r from-[rgba(0,212,255,0.25)] via-[rgba(255,184,0,0.4)] to-[rgba(255,107,53,0.55)]" />
          <span className="font-mono">low → high</span>
        </div>
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
      />
      <span>{label}</span>
    </span>
  )
}

function PileTooltip({ pile, predicted }: { pile: Pile; predicted: boolean }) {
  const status = pile.current_status
  const dotColor = pileStatusColor[status]
  return (
    <div className="min-w-[180px] p-2 text-[11px] leading-tight">
      <div className="flex items-center justify-between border-b border-ioc-border/40 pb-1">
        <span className="font-mono text-ioc-cyan">{pile.id.slice(0, 18)}</span>
        <span
          className="rounded px-1 py-0.5 text-[9px] uppercase"
          style={{
            background: `${dotColor}33`,
            color: dotColor,
          }}
        >
          {status}
        </span>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono">
        <Row k="op" v={pile.operator_id} />
        <Row k="region" v={pile.region_id.replace('_', ' ').slice(0, 12)} />
        <Row k="kW" v={pile.current_power.toFixed(1)} />
        <Row
          k={predicted ? 'occ↗' : 'occ'}
          v={formatPct(pile.current_occupancy, 0)}
        />
        <Row k="cap" v={`${pile.capacity_kw.toFixed(0)}kW`} />
        <Row k="V" v={pile.current_voltage.toFixed(0)} />
      </div>
      <div className="mt-1.5 text-center text-[10px] text-ioc-cyan opacity-80">
        click to drill in →
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <span>
      <span className="text-ioc-text-muted">{k}</span>{' '}
      <span className="text-ioc-text-primary">{v}</span>
    </span>
  )
}

