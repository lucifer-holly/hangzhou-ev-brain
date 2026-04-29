import { PlaceholderPage } from '@/pages/PlaceholderPage'

export function HeatmapDetail() {
  return (
    <PlaceholderPage
      title="Heatmap Detail · 全城供需热力图"
      subtitle="Hangzhou map + glowing pile dots + KDE region overlay + time slider"
      spawn="Spawn 6 (Detail Pages)"
      notes={[
        'Algorithm: kernel density estimation aggregating supply/demand ratios.',
        'Modes: realtime · historical · forecast (LSTM).',
        'Drill-down: hover for details · click → single pile page.',
      ]}
    />
  )
}
