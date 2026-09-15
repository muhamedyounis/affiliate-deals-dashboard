import { RefreshCw } from 'lucide-react'
import { freshnessInfo } from '../utils/dealPresentation'

export function FreshnessStatus({
  lastUpdated,
  isRefreshing,
  error,
  className = '',
}: {
  lastUpdated: Date | null
  isRefreshing?: boolean
  error?: Error | null
  className?: string
}) {
  const label = error
    ? 'Refresh failed'
    : isRefreshing
      ? 'Refreshing...'
      : lastUpdated
        ? `Updated ${freshnessInfo(lastUpdated.toISOString()).age}`
        : 'Waiting for data'

  return (
    <span
      className={[
        'inline-flex min-h-7 items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.035] px-2.5 text-xs font-medium text-slate-300',
        error ? 'text-rose-100' : isRefreshing ? 'text-cyan-100' : 'text-slate-300',
        className,
      ].join(' ')}
      aria-live="polite"
    >
      <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} aria-hidden="true" />
      {label}
    </span>
  )
}
