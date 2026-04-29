import type { components } from '@/types/api'

import { apiClient } from './client'

export type Utilization24h = components['schemas']['Utilization24hResponse']
export type HourlyOccupancy = components['schemas']['HourlyOccupancy']
export type FaultTypes = components['schemas']['FaultTypesResponse']
export type FaultTypeBucket = components['schemas']['FaultTypeBucket']

export async function getUtilization24h(): Promise<Utilization24h> {
  const { data } = await apiClient.get<Utilization24h>('/api/stats/utilization-24h')
  return data
}

export async function getFaultTypes(hours = 24): Promise<FaultTypes> {
  const { data } = await apiClient.get<FaultTypes>('/api/stats/fault-types', {
    params: { hours },
  })
  return data
}
