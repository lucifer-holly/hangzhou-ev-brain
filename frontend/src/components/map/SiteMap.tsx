import { env } from '@/lib/env'

import { AMapSiteMap } from './AMapSiteMap'
import { OSMSiteMap } from './OSMSiteMap'
import type { SiteMapProps } from './types'

/**
 * Site Selection map — switches between AMap and OSM-Leaflet implementations
 * based on the `VITE_MAP_PROVIDER` env var. Both implementations expose the
 * same UX:
 *   - dark base tiles
 *   - dashed cyan region polygons + glow labels
 *   - tiny grey reference dots for existing piles
 *   - colored candidate markers (5 distinct colors), pulsing the active one
 *   - click anywhere → place a new candidate
 *   - click candidate → focus
 */
export function SiteMap(props: SiteMapProps) {
  if (env.mapProvider === 'amap') return <AMapSiteMap {...props} />
  return <OSMSiteMap {...props} />
}
