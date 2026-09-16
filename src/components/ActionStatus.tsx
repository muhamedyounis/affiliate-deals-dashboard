import { AlertTriangle, CheckCircle2, Clock3, Loader2 } from 'lucide-react'
import type { DashboardAction, DashboardActionKind } from '../types/database'
import { dashboardActionErrorMessage, dashboardActionPriceChange, type DashboardActionUiState } from '../hooks/useDashboardAction'
import { formatCurrency } from '../utils/dealPresentation'

const actionNoun: Record<DashboardActionKind, string> = {
  POST: 'posting',
  REJECT: 'rejection',
  REGENERATE_CAPTION: 'caption regeneration',
}

function formatMaybeCurrency(value: string | number | null) {
  if (value === null || value === '') return '--'
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? formatCurrency(numericValue) : '--'
}

export function actionStateLabel(actionType: DashboardActionKind | null, state: DashboardActionUiState) {
  if (state === 'submitting') return 'Submitting...'
  if (state === 'queued') return actionType === 'POST' ? 'Queued for posting' : actionType === 'REJECT' ? 'Queued for rejection' : 'Queued'
  if (state === 'processing') return actionType === 'POST' ? 'Posting...' : actionType === 'REJECT' ? 'Rejecting...' : 'Regenerating...'
  if (state === 'success') return actionType === 'POST' ? 'Posted' : actionType === 'REJECT' ? 'Rejected' : 'Done'
  if (state === 'timeout') return 'Still waiting for the backend'
  if (state === 'failed') return 'Action failed'
  return ''
}

export function ActionStatus({
  action,
  state,
  error,
  onCheckAgain,
  onReviewDeal,
  compact = false,
}: {
  action: DashboardAction | null
  state: DashboardActionUiState
  error?: string | null
  onCheckAgain?: () => void
  onReviewDeal?: () => void
  compact?: boolean
}) {
  if (state === 'idle' || state === 'submitting' || state === 'success') return null

  const priceChange = dashboardActionPriceChange(action)
  const isWorking = state === 'queued' || state === 'processing'
  const title = priceChange ? 'Price changed before posting' : actionStateLabel(action?.action ?? null, state)
  const message = priceChange
    ? 'Amazon live verification found a different price before publishing.'
    : state === 'timeout'
      ? `The ${action?.action ? actionNoun[action.action] : 'action'} may still complete.`
      : state === 'failed'
        ? error || dashboardActionErrorMessage(action)
        : action?.status === 'PENDING'
          ? 'The backend processor has not picked it up yet.'
          : 'The backend processor is working on it.'

  return (
    <div
      className={[
        'rounded-lg border px-3 py-3',
        priceChange || state === 'timeout'
          ? 'border-amber-300/20 bg-amber-400/10 text-amber-50'
          : state === 'failed'
            ? 'border-rose-300/20 bg-rose-400/10 text-rose-50'
            : 'border-cyan-300/15 bg-cyan-300/[0.08] text-cyan-50',
      ].join(' ')}
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {isWorking ? (
          <Loader2 className="mt-0.5 shrink-0 animate-spin" size={16} aria-hidden="true" />
        ) : priceChange || state === 'timeout' ? (
          <AlertTriangle className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
        ) : (
          <CheckCircle2 className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          {message ? <p className="mt-1 text-xs leading-5 opacity-80">{message}</p> : null}
          {priceChange && !compact ? (
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <span className="rounded-md bg-black/15 p-2">
                <span className="block text-[10px] uppercase tracking-wide opacity-60">Approved</span>
                <span className="mt-1 block font-mono text-sm">{formatMaybeCurrency(priceChange.approvedPrice)}</span>
              </span>
              <span className="rounded-md bg-black/15 p-2">
                <span className="block text-[10px] uppercase tracking-wide opacity-60">Live</span>
                <span className="mt-1 block font-mono text-sm">{formatMaybeCurrency(priceChange.livePrice)}</span>
              </span>
              <span className="rounded-md bg-black/15 p-2">
                <span className="block text-[10px] uppercase tracking-wide opacity-60">Difference</span>
                <span className="mt-1 block font-mono text-sm">{priceChange.differencePercent ?? '--'}%</span>
              </span>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {state === 'timeout' ? (
              <button type="button" onClick={onCheckAgain} className="inline-flex min-h-8 items-center gap-2 rounded-md bg-white/10 px-3 text-xs font-semibold hover:bg-white/15">
                <Clock3 size={13} aria-hidden="true" />
                Check again
              </button>
            ) : null}
            {priceChange ? (
              <button type="button" onClick={onReviewDeal} className="inline-flex min-h-8 items-center rounded-md bg-white/10 px-3 text-xs font-semibold hover:bg-white/15">
                Review updated deal
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
