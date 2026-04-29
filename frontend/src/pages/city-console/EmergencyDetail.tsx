import { PlaceholderPage } from '@/pages/PlaceholderPage'

export function EmergencyDetail() {
  return (
    <PlaceholderPage
      title="Emergency Response · 应急响应"
      subtitle="Trigger events (Asian Games / concert / Spring Festival / typhoon) → red alert overlay + playbook modal"
      spawn="Spawn 6 (Detail Pages)"
      notes={[
        'Algorithm: YAML playbook + rule engine + LSTM forecast for impact radius.',
        'Animation: trigger event → watch the map evolve + recommended actions surface.',
      ]}
    />
  )
}
