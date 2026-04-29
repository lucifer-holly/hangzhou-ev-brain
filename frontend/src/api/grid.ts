import type { components } from '@/types/api'

import { apiClient } from './client'

export type GridStressRequest = components['schemas']['GridStressRequest']
export type GridStressResponse = components['schemas']['GridStressResponse']
export type OperatorAllocation = components['schemas']['OperatorAllocation']

export async function simulateGridStress(
  req: GridStressRequest,
): Promise<GridStressResponse> {
  const { data } = await apiClient.post<GridStressResponse>(
    '/api/grid/simulate-stress',
    req,
  )
  return data
}
