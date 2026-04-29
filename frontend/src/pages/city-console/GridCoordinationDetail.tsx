import { PlaceholderPage } from '@/pages/PlaceholderPage'

export function GridCoordinationDetail() {
  return (
    <PlaceholderPage
      title="Grid Coordination · 电网协同削峰"
      subtitle="Live grid load curve + warning line + 4-operator power split + LP-derived shed allocation"
      spawn="Spawn 6 (Detail Pages)"
      notes={[
        'Algorithm: scipy linear programming, min Σ(shed_pct × operator_weight).',
        'Constraints: total shed ≥ X · per-operator shed ≤ 30%.',
        'UX: simulate-emergency button → animate load pushed back below the line.',
      ]}
    />
  )
}
