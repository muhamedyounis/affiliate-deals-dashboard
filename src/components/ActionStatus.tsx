import { AlertTriangle, CheckCircle2, Clock3, Loader2 } from 'lucide-react'
import type { DashboardAction, DashboardActionKind, Deal, Json } from '../types/database'
import { dashboardActionErrorMessage, dashboardActionPriceChange, type DashboardActionUiState } from '../hooks/useDashboardAction'
import { formatCurrency } from '../utils/dealPresentation'

const actionNoun: Record<DashboardActionKind, string> = {
  POST: 'posting',
  REJECT: 'rejection',
  REGENERATE_CAPTION: 'caption regeneration',
}

function formatMaybeCurrency(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return null
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? formatCurrency(numericValue) : null
}

function resultObject(result: Json | null) {
  return result && typeof result === 'object' && !Array.isArray(result) ? result : null
}

function resultValue(result: Record<string, Json | undefined> | null, keys: string[]) {
  for (const key of keys) {
    const value = result?.[key]
    if (typeof value === 'string' || typeof value === 'number') return value
  }
  return null
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
  deal,
  action,
  state,
  error,
  onCheckAgain,
  onRetry,
  onReviewDeal,
  compact = false,
}: {
  deal: Deal
  action: DashboardAction | null
  state: DashboardActionUiState
  error?: string | null
  onCheckAgain?: () => void
  onRetry?: () => void
  onReviewDeal?: () => void
  compact?: boolean
}) {
  if (state === 'idle' || state === 'submitting' || state === 'success') return null

  const postVerificationCode = action?.action === 'POST' && state === 'failed'
    ? deal.post_verification_code?.trim().toUpperCase()
    : null
  if (action?.action === 'POST' && state === 'failed' && postVerificationCode === 'VERIFIED') return null

  const result = resultObject(action?.result ?? null)
  const priceChange = dashboardActionPriceChange(action, postVerificationCode)
  const approvedPrice = formatMaybeCurrency(priceChange?.approvedPrice ?? (postVerificationCode === 'LIVE_PRICE_UNAVAILABLE' ? resultValue(result, ['approved_price']) ?? deal.claimed_price : null))
  const livePrice = formatMaybeCurrency(priceChange?.livePrice)
  const differencePercent = priceChange?.differencePercent
  const hasBothPrices = Boolean(approvedPrice && livePrice)
  const availabilityMessage = deal.post_verification_message
  const expectedAsin = resultValue(result, ['expected_asin', 'expectedAsin'])
  const liveAsin = resultValue(result, ['live_asin', 'liveAsin', 'returned_asin', 'returnedAsin'])
  const isWorking = state === 'queued' || state === 'processing'
  const title = postVerificationCode === 'PRICE_CHANGED'
    ? 'Price changed before posting'
    : postVerificationCode === 'LIVE_PRICE_UNAVAILABLE'
      ? 'Live price could not be verified'
      : postVerificationCode === 'PRODUCT_UNAVAILABLE'
        ? 'Product currently unavailable'
        : postVerificationCode === 'WRONG_VARIANT'
          ? 'Amazon returned a different variant'
          : postVerificationCode === 'VERIFICATION_FAILED'
            ? 'Amazon verification failed'
            : actionStateLabel(action?.action ?? null, state)
  const message = postVerificationCode === 'PRICE_CHANGED'
    ? 'Amazon live verification found a different price before publishing.'
    : postVerificationCode === 'LIVE_PRICE_UNAVAILABLE'
      ? 'Amazon did not return a valid live price during the latest check.'
      : postVerificationCode === 'PRODUCT_UNAVAILABLE'
        ? availabilityMessage
        : postVerificationCode === 'WRONG_VARIANT'
          ? null
          : postVerificationCode === 'VERIFICATION_FAILED'
            ? availabilityMessage
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
          {postVerificationCode === 'WRONG_VARIANT' && (expectedAsin || liveAsin) ? (
            <div className="mt-2 space-y-1 text-xs opacity-80">
              {expectedAsin ? <p>Expected ASIN: <span className="font-mono">{expectedAsin}</span></p> : null}
              {liveAsin ? <p>Live ASIN: <span className="font-mono">{liveAsin}</span></p> : null}
            </div>
          ) : null}
          {priceChange && !compact && hasBothPrices ? (
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <span className="rounded-md bg-black/15 p-2">
                <span className="block text-[10px] uppercase tracking-wide opacity-60">Approved</span>
                <span className="mt-1 block font-mono text-sm">{approvedPrice}</span>
              </span>
              <span className="rounded-md bg-black/15 p-2">
                <span className="block text-[10px] uppercase tracking-wide opacity-60">Live</span>
                <span className="mt-1 block font-mono text-sm">{livePrice}</span>
              </span>
              {differencePercent !== null && differencePercent !== undefined && differencePercent !== '' ? (
                <span className="rounded-md bg-black/15 p-2">
                  <span className="block text-[10px] uppercase tracking-wide opacity-60">Difference</span>
                  <span className="mt-1 block font-mono text-sm">{differencePercent}%</span>
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {state === 'timeout' || postVerificationCode === 'LIVE_PRICE_UNAVAILABLE' || postVerificationCode === 'VERIFICATION_FAILED' ? (
              <button type="button" onClick={onCheckAgain} className="inline-flex min-h-8 items-center gap-2 rounded-md bg-white/10 px-3 text-xs font-semibold hover:bg-white/15">
                <Clock3 size={13} aria-hidden="true" />
                {postVerificationCode ? 'Verify Again' : 'Check again'}
              </button>
            ) : null}
            {state === 'timeout' && onRetry ? (
              <button type="button" onClick={onRetry} className="inline-flex min-h-8 items-center rounded-md bg-white/10 px-3 text-xs font-semibold hover:bg-white/15">
                Retry
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
