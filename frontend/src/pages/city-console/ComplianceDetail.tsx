import { PlaceholderPage } from '@/pages/PlaceholderPage'

export function ComplianceDetail() {
  return (
    <PlaceholderPage
      title="Compliance · 运营商合规仪表盘"
      subtitle="4-operator side-by-side scorecard + A/B/C/D rating + drill-down"
      spawn="Spawn 6 (Detail Pages)"
      notes={[
        'Metrics: SLA availability · MTTR · price anomaly count · complaints · composite score.',
        'Algorithm: z-score detecting price deviations >2σ from city median.',
        'Export: PDF report.',
      ]}
    />
  )
}
