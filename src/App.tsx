import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { DashboardLayout } from './components/DashboardLayout'
import { RouteErrorBoundary } from './components/RouteErrorBoundary'
import { LoadingSkeleton } from './components/StateViews'

const DealsPage = lazy(() => import('./pages/DealsPage').then((module) => ({ default: module.DealsPage })))
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })))
const OverviewPage = lazy(() => import('./pages/OverviewPage').then((module) => ({ default: module.OverviewPage })))
const PriceHistoryPage = lazy(() => import('./pages/PriceHistoryPage').then((module) => ({ default: module.PriceHistoryPage })))
const ReviewModePage = lazy(() => import('./pages/ReviewModePage').then((module) => ({ default: module.ReviewModePage })))
const ReviewQueuePage = lazy(() => import('./pages/ReviewQueuePage').then((module) => ({ default: module.ReviewQueuePage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const SourcesPage = lazy(() => import('./pages/SourcesPage').then((module) => ({ default: module.SourcesPage })))
const WatcherHealthPage = lazy(() => import('./pages/WatcherHealthPage').then((module) => ({ default: module.WatcherHealthPage })))

function RouteFallback() {
  return <LoadingSkeleton rows={3} />
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
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
    </Suspense>
  )
}
