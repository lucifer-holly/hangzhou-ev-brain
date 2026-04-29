/**
 * Shared map types so AMap and OSM implementations are interchangeable.
 *
 * Keep this minimal: only fields needed by the IOC homepage + heatmap
 * detail. New use cases can extend MapMarker.
 */

import type { PileStatus } from '@/design-tokens'

export interface MapMarker {
  id: string
  lat: number
  lng: number
  status?: PileStatus
  /** Optional label shown in tooltips. */
  label?: string
}

export interface MapProps {
  /** Initial centre — Hangzhou Future Sci-Tech City by default. */
  center?: { lat: number; lng: number }
  zoom?: number
  markers?: MapMarker[]
  onMarkerClick?: (marker: MapMarker) => void
  /** Visual theme — only meaningful for AMap; OSM picks dark/light tile servers. */
  theme?: 'dark' | 'light'
  className?: string
}

/** Default centre = Hangzhou Future Sci-Tech City (Xixi / Alibaba campus). */
export const HZ_CENTER = { lat: 30.276, lng: 120.058 } as const
