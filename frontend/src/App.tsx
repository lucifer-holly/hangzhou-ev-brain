import { lazy, Suspense } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { SplashScreen } from './components/SplashScreen'
import { Skeleton } from './components/ui/skeleton'

// Loaded eagerly: layout + landing page so the first paint is fast.
import { CityConsoleLayout } from './pages/city-console/Layout'
import { Home } from './pages/city-console/Home'
import { NotFound } from './pages/NotFound'

// Lazy: heavy detail pages and the operator/driver consoles. Each becomes
// its own chunk fetched on demand.
const HeatmapDetail = lazy(() =>
  import('./pages/city-console/HeatmapDetail').then((m) => ({ default: m.HeatmapDetail })),
)
const SiteSelectionDetail = lazy(() =>
  import('./pages/city-console/SiteSelectionDetail').then((m) => ({ default: m.SiteSelectionDetail })),
)
const GridCoordinationDetail = lazy(() =>
  import('./pages/city-console/GridCoordinationDetail').then((m) => ({ default: m.GridCoordinationDetail })),
)
const ComplianceDetail = lazy(() =>
  import('./pages/city-console/ComplianceDetail').then((m) => ({ default: m.ComplianceDetail })),
)
const EmergencyDetail = lazy(() =>
  import('./pages/city-console/EmergencyDetail').then((m) => ({ default: m.EmergencyDetail })),
)
const SubsidyDetail = lazy(() =>
  import('./pages/city-console/SubsidyDetail').then((m) => ({ default: m.SubsidyDetail })),
)
const PileDetail = lazy(() =>
  import('./pages/city-console/PileDetail').then((m) => ({ default: m.PileDetail })),
)
const OperatorDashboard = lazy(() =>
  import('./pages/operator/Dashboard').then((m) => ({ default: m.OperatorDashboard })),
)
const DriverApp = lazy(() =>
  import('./pages/driver/App').then((m) => ({ default: m.DriverApp })),
)

function RouteFallback() {
  return (
    <div className="flex h-full w-full flex-col gap-3 p-6">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-64 w-full" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  )
}

export function App() {
  const location = useLocation()
  return (
    <>
      <SplashScreen />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname.split('/').slice(0, 3).join('/')}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="h-full"
        >
          <Suspense fallback={<RouteFallback />}>
            <Routes location={location}>
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
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </>
  )
}
