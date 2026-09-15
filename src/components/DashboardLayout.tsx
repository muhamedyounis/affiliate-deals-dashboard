import {
  Activity,
  BarChart3,
  Database,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Radio,
  Settings,
  ShieldCheck,
  SquareStack,
  UserCircle,
} from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useAsyncData } from '../hooks/useAsyncData'
import { fetchReviewCounts } from '../services/deals'
import { FreshnessStatus } from './FreshnessStatus'
import { CategoryFocusControl } from './CategoryFocusControl'
import { CategoryFocusProvider, useCategoryFocus } from './CategoryFocusContext'

const navItems = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/review-queue', label: 'Review Queue', icon: ShieldCheck, countKey: 'waiting' },
  { to: '/review-mode', label: 'Review Mode', icon: SquareStack, countKey: 'waiting' },
  { to: '/deals', label: 'Deals', icon: BarChart3 },
  { to: '/products', label: 'Products', icon: History },
  { to: '/sources', label: 'Sources', icon: Database },
  { to: '/watcher-health', label: 'Watcher Health', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function DashboardLayout() {
  return (
    <CategoryFocusProvider>
      <DashboardLayoutInner />
    </CategoryFocusProvider>
  )
}

function DashboardLayoutInner() {
  const { signOut, user } = useAuth()
  const { focus } = useCategoryFocus()
  const countsLoader = () => fetchReviewCounts('24h', focus)
  const counts = useAsyncData(countsLoader, [focus], { refreshIntervalMs: 30000 })

  useEffect(() => {
    window.addEventListener('dashboard-counts-refresh', counts.reload)
    return () => window.removeEventListener('dashboard-counts-refresh', counts.reload)
  }, [counts.reload])

  return (
    <div className="premium-grid min-h-screen bg-[#05090c] text-slate-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-cyan-300 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-cyan-950"
      >
        Skip to main content
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-[248px] border-r border-white/[0.08] bg-[#081014]/95 px-3 py-4 shadow-2xl shadow-black/30 backdrop-blur lg:block">
        <div className="flex items-center gap-3 px-2">
          <div className="grid size-10 place-items-center rounded-lg bg-cyan-300/12 text-cyan-100 ring-1 ring-cyan-300/25">
            <Radio size={18} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Affiliate Ops</p>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Decision cockpit</p>
          </div>
        </div>

        <nav className="mt-7 space-y-1">
          {navItems.filter((item) => item.to !== '/settings').map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-200',
                  isActive
                    ? 'bg-cyan-300/10 text-cyan-50 ring-1 ring-cyan-300/15 before:absolute before:left-0 before:top-2 before:h-6 before:w-0.5 before:rounded-full before:bg-cyan-300'
                    : 'text-slate-400 hover:bg-white/[0.045] hover:text-slate-100',
                ].join(' ')
              }
            >
              <item.icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
              {item.countKey && counts.data?.waiting ? (
                <span className="ml-auto rounded-md bg-cyan-300/12 px-1.5 py-0.5 font-mono text-[11px] text-cyan-100">
                  {counts.data.waiting}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        <div className="absolute inset-x-3 bottom-4 space-y-2">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
                [
                'relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-200',
                isActive
                  ? 'bg-cyan-300/10 text-cyan-50 ring-1 ring-cyan-300/15 before:absolute before:left-0 before:top-2 before:h-6 before:w-0.5 before:rounded-full before:bg-cyan-300'
                  : 'text-slate-400 hover:bg-white/[0.045] hover:text-slate-100',
              ].join(' ')
            }
          >
            <Settings size={18} aria-hidden="true" />
            Settings
          </NavLink>
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-2">
          <p className="truncate px-1 text-xs text-slate-500">{user?.email}</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg text-xs font-semibold text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <LogOut size={15} aria-hidden="true" />
            Sign Out
          </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-10 border-b border-white/[0.08] bg-[#05090c]/90 px-4 py-3 shadow-lg shadow-black/10 backdrop-blur md:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Menu className="text-slate-500 lg:hidden" size={18} aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Operations</p>
                <p className="mt-0.5 truncate text-sm font-medium text-slate-100">Live deal command center</p>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <div className="hidden min-w-0 xl:block">
                <CategoryFocusControl compact />
              </div>
              <span className="hidden min-h-8 items-center rounded-md border border-emerald-300/20 bg-emerald-400/10 px-2.5 text-xs font-semibold text-emerald-100 sm:inline-flex">
                Watcher online
              </span>
              <FreshnessStatus lastUpdated={counts.lastUpdated} isRefreshing={counts.isRefreshing} error={counts.error} className="hidden md:inline-flex" />
              <span className="hidden max-w-44 truncate text-xs text-slate-500 md:inline">{user?.email}</span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="inline-flex size-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
                aria-label="Sign out"
                title="Sign out"
              >
                <UserCircle size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-cyan-300/10 text-cyan-50 ring-1 ring-cyan-300/15'
                      : 'bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] hover:text-slate-100',
                  ].join(' ')
                }
              >
                <item.icon size={16} aria-hidden="true" />
                <span>{item.label}</span>
                {item.countKey && counts.data?.waiting ? (
                  <span className="rounded-md bg-cyan-300/10 px-1.5 py-0.5 font-mono text-[11px] text-cyan-100">
                    {counts.data.waiting}
                  </span>
                ) : null}
              </NavLink>
            ))}
          </nav>
          <div className="mt-3 xl:hidden">
            <CategoryFocusControl compact />
          </div>
        </header>

        <main id="main-content" className="mx-auto w-full max-w-[1680px] px-4 py-5 md:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
