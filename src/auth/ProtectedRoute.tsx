import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'

export function ProtectedRoute() {
  const { loading, user } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="premium-grid grid min-h-screen place-items-center bg-[#05090c] px-5 text-slate-100">
        <div className="rounded-lg border border-white/[0.1] bg-[#0b1317]/90 p-6 text-sm font-medium text-slate-300 shadow-2xl shadow-black/25">
          Restoring session
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
