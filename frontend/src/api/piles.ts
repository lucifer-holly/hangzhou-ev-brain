import type { components } from '@/types/api'

import { apiClient } from './client'

export type Pile = components['schemas']['PileOut']
export type PileDetail = components['schemas']['PileDetail']
export type TelemetryPoint = components['schemas']['TelemetryPoint']

export interface PileListFilters {
  region?: string
  operator?: string
  status?: string
}

export async function listPiles(filters: PileListFilters = {}): Promise<Pile[]> {
  const { data } = await apiClient.get<Pile[]>('/api/piles', { params: filters })
  return data
}

export async function getPile(pileId: string): Promise<PileDetail> {
  const { data } = await apiClient.get<PileDetail>(`/api/piles/${pileId}`)
  return data
}

export interface TelemetryQuery {
  from?: string
  to?: string
  limit?: number
}

export async function getTelemetry(
  pileId: string,
  query: TelemetryQuery = {},
): Promise<TelemetryPoint[]> {
  const { data } = await apiClient.get<TelemetryPoint[]>(
    `/api/piles/${pileId}/telemetry`,
    { params: query },
  )
  return data
}
