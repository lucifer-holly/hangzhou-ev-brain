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

export type SiteFeatures = components['schemas']['SiteFeatures']
export type SiteResponse = components['schemas']['SiteResponse']
export type ShapContribution = components['schemas']['ShapContributionOut']

export async function featuresForLocation(
  lat: number,
  lng: number,
  operator = 'state_grid',
): Promise<SiteFeatures> {
  const { data } = await apiClient.post<SiteFeatures>('/api/ai/features-for-location', {
    lat,
    lng,
    operator,
  })
  return data
}

export async function predictSite(features: SiteFeatures): Promise<SiteResponse> {
  const { data } = await apiClient.post<SiteResponse>('/api/ai/predict/site', features)
  return data
}

export type AnomalyResponse = components['schemas']['AnomalyResponse']

export async function checkAnomaly(pile_id: string): Promise<AnomalyResponse> {
  const { data } = await apiClient.get<AnomalyResponse>(`/api/ai/anomaly/${pile_id}`)
  return data
}

export type YoloResponse = components['schemas']['YoloResponse']

export async function detectYolo(file: File): Promise<YoloResponse> {
  const fd = new FormData()
  fd.append('image', file)
  const { data } = await apiClient.post<YoloResponse>('/api/ai/yolo/detect', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}
