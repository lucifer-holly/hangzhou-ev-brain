import type { components } from '@/types/api'

import { apiClient } from './client'

export type Operator = components['schemas']['OperatorOut']
export type Region = components['schemas']['RegionOut']

export async function listOperators(): Promise<Operator[]> {
  const { data } = await apiClient.get<Operator[]>('/api/operators')
  return data
}

export async function listRegions(): Promise<Region[]> {
  const { data } = await apiClient.get<Region[]>('/api/regions')
  return data
}
