import { Activity, AlertTriangle, Clock } from 'lucide-react'
import { useEffect } from 'react'
import { FreshnessStatus } from '../components/FreshnessStatus'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/StateViews'
import { useAsyncData } from '../hooks/useAsyncData'
import { fetchWatcherHealth, subscribeToWatcherHealthChanges } from '../services/deals'
import type { WatcherHealth } from '../types/database'

function isStale(watcher: WatcherHealth) {
  if (!watcher.last_seen) return true
  return Date.now() - new Date(watcher.last_seen).getTime() > 15 * 60 * 1000
}

function watcherState(watcher: WatcherHealth) {
  if (watcher.status?.toLowerCase() === 'error' || watcher.last_error) return 'error'
  if (isStale(watcher)) return 'stale'
  return 'online'
}

function stateStyle(state: 'online' | 'stale' | 'error') {
  if (state === 'online') return 'border-emerald-300/24 bg-[#0b1317]/90 text-emerald-100 shadow-emerald-950/10'
  if (state === 'stale') return 'border-amber-300/24 bg-[#0b1317]/90 text-amber-100 shadow-amber-950/10'
  return 'border-rose-300/24 bg-[#0b1317]/90 text-rose-100 shadow-rose-950/10'
}

export function WatcherHealthPage() {
  const { data, error, isLoading, isRefreshing, isConfigured, lastUpdated, reload } = useAsyncData(fetchWatcherHealth, [], {
    refreshIntervalMs: 15000,
  })

  useEffect(() => {
    if (!isConfigured) return undefined
    return subscribeToWatcherHealthChanges(reload)
  }, [isConfigured, reload])

  return (
    <>
      <PageHeader
        title="Watcher Health"
        description="Live watcher status from Supabase. A watcher is stale when last_seen is more than 15 minutes old."
        action={<FreshnessStatus lastUpdated={lastUpdated} isRefreshing={isRefreshing} error={error} />}
      />

      {!isConfigured ? (
        <EmptyState title="Supabase is not configured" message="Add Supabase environment variables to load watcher health." />
      ) : null}
      {isLoading ? <LoadingSkeleton rows={4} /> : null}
      {error ? <ErrorState message={error.message} /> : null}
      {!isLoading && !error && isConfigured && data?.length === 0 ? (
        <EmptyState title="No watcher records visible" message="No watcher_health rows are visible to this user." />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(data ?? []).map((watcher) => {
          const state = watcherState(watcher)
          return (
            <section key={watcher.id} className={`rounded-lg border p-5 shadow-xl transition-colors hover:border-white/[0.16] ${stateStyle(state)}`}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-white">{watcher.id}</h3>
                <span className="inline-flex min-h-7 items-center gap-1 rounded-md border border-current/30 bg-black/15 px-2 text-xs font-semibold">
                  {state === 'online' ? <Activity size={14} /> : state === 'stale' ? <Clock size={14} /> : <AlertTriangle size={14} />}
                  {state}
                </span>
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide opacity-70">Status</dt>
                  <dd className="mt-1 text-slate-100">{watcher.status || '--'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide opacity-70">Last seen</dt>
                  <dd className="mt-1 text-slate-100">{watcher.last_seen || '--'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide opacity-70">Candidates</dt>
                  <dd className="mt-1 text-slate-100">{watcher.candidates ?? '--'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide opacity-70">Last error</dt>
                  <dd className="mt-1 break-words text-slate-100">{watcher.last_error || '--'}</dd>
                </div>
              </dl>
            </section>
          )
        })}
      </div>
    </>
  )
}
