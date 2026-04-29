import type { components } from '@/types/api'

import { apiClient } from './client'

export type DemandResponse = components['schemas']['DemandResponse']
export type DemandRequest = components['schemas']['DemandRequest']
export type PredictedUtilization = components['schemas']['PredictedUtilizationResponse']
export type PilePrediction = components['schemas']['PilePrediction']

export async function predictDemand(
  pile_id: string,
  hours_ahead = 1,
): Promise<DemandResponse> {
  const { data } = await apiClient.post<DemandResponse>('/api/ai/predict/demand', {
    pile_id,
    hours_ahead,
  })
  return data
}

/**
 * Batched LSTM forecast across every pile, in a single round-trip.
 * Backend builds the input window matrix once and runs one (N, 24, 8)
 * forward pass — ~2 s warm, ~20 s cold for 100 piles.
 */
export async function predictAllPiles(hours_ahead = 1): Promise<PredictedUtilization> {
  const { data } = await apiClient.get<PredictedUtilization>(
    '/api/stats/predicted-utilization',
    { params: { hours_ahead } },
  )
  return data
}
