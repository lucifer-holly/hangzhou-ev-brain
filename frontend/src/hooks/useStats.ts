import { useQuery } from '@tanstack/react-query'

import {
  getFaultTypes,
  getOperatorCompliance,
  getSubsidyAnalysis,
  getUtilization24h,
  type ComplianceWindow,
} from '@/api/stats'

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

export function useOperatorCompliance(window: ComplianceWindow = '24h') {
  return useQuery({
    queryKey: ['stats', 'operator-compliance', window],
    queryFn: () => getOperatorCompliance(window),
    staleTime: 60_000,
  })
}

export function useSubsidyAnalysis(preDays = 23, postDays = 7) {
  return useQuery({
    queryKey: ['stats', 'subsidy-analysis', preDays, postDays],
    queryFn: () => getSubsidyAnalysis(preDays, postDays),
    staleTime: 5 * 60_000,
  })
}
