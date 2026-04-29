import { useQuery } from '@tanstack/react-query'

import { listOperators, listRegions } from '@/api/operators'

export function useOperators() {
  return useQuery({
    queryKey: ['operators'],
    queryFn: listOperators,
    staleTime: 5 * 60_000,
  })
}

export function useRegions() {
  return useQuery({
    queryKey: ['regions'],
    queryFn: listRegions,
    staleTime: 5 * 60_000,
  })
}
