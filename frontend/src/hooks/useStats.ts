import { useQuery } from '@tanstack/react-query'

import { getFaultTypes, getUtilization24h } from '@/api/stats'

export function useUtilization24h() {
  return useQuery({
    queryKey: ['stats', 'utilization-24h'],
    queryFn: getUtilization24h,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  })
}

export function useFaultTypes(hours = 24) {
  return useQuery({
    queryKey: ['stats', 'fault-types', hours],
    queryFn: () => getFaultTypes(hours),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
