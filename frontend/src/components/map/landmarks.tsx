/**
 * Curated set of Hangzhou landmarks plotted on the City Map at zoom ≥ 12.
 *
 * Purpose: visual anchoring — a viewer who's never been to Hangzhou can
 * immediately tell "ah, this is around West Lake / Future Sci-Tech City".
 * Coordinates are AMap GCJ-02 (good enough for a synthetic demo; the real
 * AMap loader does coordinate conversion server-side).
 *
 * Drawn behind pile markers with low opacity so they never compete for
 * attention with the actual data layer.
 */

export interface Landmark {
  id: string
  name: string
  pinyin: string
  lat: number
  lng: number
  /** Single emoji used as the marker glyph. */
  icon: string
  /** Tint color used for the marker pill background. */
  color: string
}

export const HANGZHOU_LANDMARKS: readonly Landmark[] = [
  {
    id: 'west-lake',
    name: '西湖',
    pinyin: 'West Lake',
    lat: 30.2429,
    lng: 120.1503,
    icon: '🏞️',
    color: '#10B981',
  },
  {
    id: 'alibaba-xixi',
    name: '阿里西溪园区',
    pinyin: 'Alibaba Xixi Campus',
    lat: 30.2754,
    lng: 120.0123,
    icon: '🏢',
    color: '#FF6900',
  },
  {
    id: 'netease',
    name: '网易杭州研究院',
    pinyin: 'NetEase HZ HQ',
    lat: 30.2806,
    lng: 120.0356,
    icon: '🎮',
    color: '#DC143C',
  },
  {
    id: 'asian-games-village',
    name: '亚运村',
    pinyin: 'Asian Games Village',
    lat: 30.2196,
    lng: 120.2087,
    icon: '🏟️',
    color: '#FFD700',
  },
  {
    id: 'hangzhou-east-station',
    name: '杭州东站',
    pinyin: 'Hangzhou East Railway',
    lat: 30.2906,
    lng: 120.2128,
    icon: '🚄',
    color: '#4A90E2',
  },
] as const

export const LANDMARK_MIN_ZOOM = 12
