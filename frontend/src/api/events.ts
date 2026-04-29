import type { components } from '@/types/api'

import { apiClient } from './client'

export type Event = components['schemas']['EventOut']

export interface EventFilters {
  type?: string
  severity?: string
  pile_id?: string
  since?: string
  limit?: number
}

export async function listEvents(filters: EventFilters = {}): Promise<Event[]> {
  const { data } = await apiClient.get<Event[]>('/api/events', { params: filters })
  return data
}
