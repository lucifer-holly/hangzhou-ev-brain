import { PlaceholderPage } from '@/pages/PlaceholderPage'

export function DriverApp() {
  return (
    <PlaceholderPage
      title="Driver App · 司机端"
      subtitle="Find-a-pile · queue ETA · pre-book · live navigation"
      spawn="Spawn 7 (Operator + Driver)"
      notes={[
        'Mobile-first layout, light SaaS theme.',
        'Uses /api/piles (status=idle) + region filter; live status via WebSocket.',
      ]}
    />
  )
}
