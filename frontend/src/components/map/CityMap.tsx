import type { Pile } from '@/api/piles'
import { env } from '@/lib/env'

import { AMapCityMap } from './AMapCityMap'
import { OSMCityMap } from './OSMCityMap'

interface CityMapProps {
  piles: Pile[]
  /** When true, the map is rendering predicted (LSTM) occupancy not realtime. */
  predicted?: boolean
  onPileClick?: (pile: Pile) => void
  className?: string
}

/**
 * IOC city map — switches between AMap and OSM-Leaflet implementations
 * based on the `VITE_MAP_PROVIDER` env var.
 *
 * Both implementations render the SAME visual layers in the SAME order:
 *   1. dark base tiles (AMap "grey" / Carto dark_all)
 *   2. region polygons + glow labels (Future Tech City + Qiantang New Area)
 *   3. heat halos — translucent circles per pile, sized + tinted by occupancy
 *   4. pile markers — colored by status (or blue when predicted), clickable
 *      with a rich hover tooltip (id / op / region / kW / occ / capacity / V)
 *   5. legend overlay (status dots + heat gradient)
 */
export function CityMap({ piles, predicted, onPileClick, className }: CityMapProps) {
  if (env.mapProvider === 'amap') {
    return (
      <AMapCityMap
        piles={piles}
        predicted={predicted}
        onPileClick={onPileClick}
        className={className}
      />
    )
  }
  return (
    <OSMCityMap
      piles={piles}
      predicted={predicted}
      onPileClick={onPileClick}
      className={className}
    />
  )
}
