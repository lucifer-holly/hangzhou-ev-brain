import { env } from '@/lib/env'

import { AMapMap } from './AMapMap'
import { OSMMap } from './OSMMap'
import type { MapProps } from './types'

export type { MapMarker, MapProps } from './types'
export { HZ_CENTER } from './types'

/**
 * Single entry point for "give me a map".
 *
 * Switches between AMap (high-quality, requires key) and OSM/Leaflet (zero
 * config) based on the `VITE_MAP_PROVIDER` env. Consumers don't care which
 * is in use; both implement the same `MapProps` contract.
 */
export function MapProvider(props: MapProps) {
  return env.mapProvider === 'amap' ? <AMapMap {...props} /> : <OSMMap {...props} />
}
