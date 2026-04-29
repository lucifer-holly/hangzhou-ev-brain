import { Navigate, Route, Routes } from 'react-router-dom'

import { CityConsoleLayout } from './pages/city-console/Layout'
import { Home } from './pages/city-console/Home'
import { HeatmapDetail } from './pages/city-console/HeatmapDetail'
import { SiteSelectionDetail } from './pages/city-console/SiteSelectionDetail'
import { GridCoordinationDetail } from './pages/city-console/GridCoordinationDetail'
import { ComplianceDetail } from './pages/city-console/ComplianceDetail'
import { EmergencyDetail } from './pages/city-console/EmergencyDetail'
import { SubsidyDetail } from './pages/city-console/SubsidyDetail'
import { PileDetail } from './pages/city-console/PileDetail'
import { OperatorDashboard } from './pages/operator/Dashboard'
import { DriverApp } from './pages/driver/App'
import { NotFound } from './pages/NotFound'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/city" replace />} />
      <Route path="/city" element={<CityConsoleLayout />}>
        <Route index element={<Home />} />
        <Route path="heatmap" element={<HeatmapDetail />} />
        <Route path="site-selection" element={<SiteSelectionDetail />} />
        <Route path="grid" element={<GridCoordinationDetail />} />
        <Route path="compliance" element={<ComplianceDetail />} />
        <Route path="emergency" element={<EmergencyDetail />} />
        <Route path="subsidy" element={<SubsidyDetail />} />
        <Route path="piles/:id" element={<PileDetail />} />
      </Route>
      <Route path="/operator" element={<OperatorDashboard />} />
      <Route path="/driver" element={<DriverApp />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
