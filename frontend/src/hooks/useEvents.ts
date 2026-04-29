import { useQuery } from '@tanstack/react-query'

import { listEvents, type EventFilters } from '@/api/events'

export function useEvents(filters: EventFilters = {}) {
  return useQuery({
    queryKey: ['events', filters],
    queryFn: () => listEvents(filters),
    staleTime: 5_000,
  })
}
