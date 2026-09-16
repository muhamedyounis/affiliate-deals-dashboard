import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { DashboardLayout } from './components/DashboardLayout'
import { RouteErrorBoundary } from './components/RouteErrorBoundary'
import { DealsPage } from './pages/DealsPage'
import { LoginPage } from './pages/LoginPage'
import { OverviewPage } from './pages/OverviewPage'
import { PriceHistoryPage } from './pages/PriceHistoryPage'
import { ReviewModePage } from './pages/ReviewModePage'
import { ReviewQueuePage } from './pages/ReviewQueuePage'
import { SettingsPage } from './pages/SettingsPage'
import { SourcesPage } from './pages/SourcesPage'
import { WatcherHealthPage } from './pages/WatcherHealthPage'

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<RouteErrorBoundary><DashboardLayout /></RouteErrorBoundary>}>
          <Route index element={<Navigate to="/overview" replace />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="review-queue" element={<ReviewQueuePage />} />
          <Route path="review-mode" element={<ReviewModePage />} />
          <Route path="deals" element={<DealsPage />} />
          <Route path="products" element={<PriceHistoryPage />} />
          <Route path="sources" element={<SourcesPage />} />
          <Route path="watcher-health" element={<WatcherHealthPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Routes>
  )
}
