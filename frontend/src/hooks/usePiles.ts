import { useQuery } from '@tanstack/react-query'

import { getPile, getTelemetry, listPiles, type PileListFilters } from '@/api/piles'

export function usePiles(filters: PileListFilters = {}) {
  return useQuery({
    queryKey: ['piles', filters],
    queryFn: () => listPiles(filters),
    staleTime: 15_000,
  })
}

export function usePile(pileId: string | undefined) {
  return useQuery({
    queryKey: ['pile', pileId],
    queryFn: () => getPile(pileId as string),
    enabled: Boolean(pileId),
    staleTime: 5_000,
  })
}

export function useTelemetry(pileId: string | undefined, limit = 500) {
  return useQuery({
    queryKey: ['telemetry', pileId, limit],
    queryFn: () => getTelemetry(pileId as string, { limit }),
    enabled: Boolean(pileId),
  })
}
