import { useMemo } from 'react'

import type { Pile } from '@/api/piles'
import { MapProvider, type MapMarker } from '@/components/map/MapProvider'

interface CityMapProps {
  piles: Pile[]
  onPileClick?: (pile: Pile) => void
  className?: string
}

/**
 * Composed city map — Phase B/C/D-aware overlay layer over MapProvider.
 *
 * Phase B: pile markers + click-to-navigate (this stub).
 * Phase C: + region polygons + heatmap overlay + hover tooltip.
 * Phase D: + mode-aware coloring (predicted utilization).
 */
export function CityMap({ piles, onPileClick, className }: CityMapProps) {
  const markers: MapMarker[] = useMemo(
    () =>
      piles.map((p) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        status: p.current_status,
        label: `${p.id.slice(0, 14)} · ${p.current_status} · ${(p.current_occupancy * 100).toFixed(0)}%`,
      })),
    [piles],
  )

  return (
    <div className={className}>
      <MapProvider
        markers={markers}
        theme="dark"
        onMarkerClick={(m) => {
          const pile = piles.find((p) => p.id === m.id)
          if (pile) onPileClick?.(pile)
        }}
      />
    </div>
  )
}
