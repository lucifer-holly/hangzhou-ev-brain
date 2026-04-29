import { PlaceholderPage } from '@/pages/PlaceholderPage'

export function SiteSelectionDetail() {
  return (
    <PlaceholderPage
      title="Site Selection · 选址决策支持 ⭐ 旗舰"
      subtitle="Map candidate-marker mode + SHAP explanation panel + ROI cards"
      spawn="Spawn 6 (Detail Pages)"
      notes={[
        'Algorithm: XGBoost regression + SHAP value attribution.',
        '12-feature input: lat/lng + 1km population + POI counts + existing piles + road class + operator.',
        'Output: 6-month expected utilisation + 95% CI + Top-3 SHAP contributors.',
      ]}
    />
  )
}
