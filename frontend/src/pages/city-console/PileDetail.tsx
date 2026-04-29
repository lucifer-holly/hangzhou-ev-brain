import { useParams } from 'react-router-dom'

import { PlaceholderPage } from '@/pages/PlaceholderPage'

export function PileDetail() {
  const { id } = useParams()
  return (
    <PlaceholderPage
      title={`Pile · ${id ?? '?'}`}
      subtitle="Single pile drill-down: live telemetry, 24h summary, faults, operator metadata"
      spawn="Spawn 6 (Detail Pages)"
      notes={[
        'Charts: voltage / current / power timelines from /api/piles/{id}/telemetry.',
        'Live updates via WebSocket fan-out (filter by pile_id).',
      ]}
    />
  )
}
