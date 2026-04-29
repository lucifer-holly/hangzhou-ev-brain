import { PlaceholderPage } from '@/pages/PlaceholderPage'

export function OperatorDashboard() {
  return (
    <PlaceholderPage
      title="Operator Console · 运营商工作台"
      subtitle="SLA dashboard · pile inventory · fault queue · pricing controls"
      spawn="Spawn 7 (Operator + Driver)"
      notes={[
        'Light SaaS theme using design-tokens/saas.* — see design-tokens/colors.ts.',
        'Reuses /api/piles + /api/events filtered by operator_id.',
      ]}
    />
  )
}
