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

/* -------------------------- Site Selection Map -------------------------- */

/**
 * Candidate marker for the Site Selection page.
 *
 * `predictionLabel` is the formatted prediction string ("78.3%" / "loading…")
 * surfaced by the page state — kept as a string so the map components stay
 * dumb about the AI response shape.
 */
export interface SiteCandidate {
  id: string
  index: number
  lat: number
  lng: number
  predictionLabel?: string
}

export interface SiteMapProps {
  candidates: SiteCandidate[]
  /** Tiny grey reference dots for already-installed piles. */
  existingPiles: { id: string; lat: number; lng: number }[]
  /** Highlight the currently selected candidate (larger marker). */
  activeId: string | null
  onMapClick: (lat: number, lng: number) => void
  onCandidateClick: (id: string) => void
}

/** Reusable colour palette for up-to-5 candidate markers. */
export const CANDIDATE_COLORS = [
  '#22d3ee',
  '#fb923c',
  '#a855f7',
  '#10b981',
  '#f43f5e',
] as const
