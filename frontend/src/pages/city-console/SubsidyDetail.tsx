import { PlaceholderPage } from '@/pages/PlaceholderPage'

export function SubsidyDetail() {
  return (
    <PlaceholderPage
      title="Subsidy Effectiveness · 补贴效果评估"
      subtitle="Scatter plot (subsidy × utilisation lift) + ROI per yuan + policy recommendations"
      spawn="Spawn 6 (Detail Pages)"
      notes={[
        'Algorithm: difference-in-differences (DID) causal inference.',
        'Synthetic data is pre-labelled with treatment/control groups.',
        'Filters: time window · operator drill-down.',
      ]}
    />
  )
}
