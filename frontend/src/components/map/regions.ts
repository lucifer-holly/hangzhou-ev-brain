/**
 * Hangzhou anchor-region polygons used by the IOC city map.
 *
 * Coordinates are in [lat, lng] order to match Leaflet's `LatLngTuple`.
 * AMap consumers must swap to [lng, lat] when calling `new AMap.Polygon`.
 */

export interface CityRegion {
  id: string
  name_zh: string
  name_en: string
  /** Polygon vertices, [lat, lng]. Closed by Leaflet automatically. */
  polygon: [number, number][]
  /** Anchor point for the floating label. */
  labelAnchor: [number, number]
}

export const CITY_REGIONS: CityRegion[] = [
  {
    id: 'future_tech_city',
    name_zh: '未来科技城',
    name_en: 'Future Tech City',
    polygon: [
      [30.295, 119.985],
      [30.295, 120.06],
      [30.255, 120.06],
      [30.255, 119.985],
    ],
    labelAnchor: [30.297, 120.022],
  },
  {
    id: 'qiantang_new_area',
    name_zh: '钱塘新区',
    name_en: 'Qiantang New Area',
    polygon: [
      [30.33, 120.31],
      [30.33, 120.4],
      [30.27, 120.4],
      [30.27, 120.31],
    ],
    labelAnchor: [30.332, 120.355],
  },
]
