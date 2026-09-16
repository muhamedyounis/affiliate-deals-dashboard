import { FreshnessStatus } from '../components/FreshnessStatus'
import { Surface } from '../components/DesignPrimitives'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/StateViews'
import { useAsyncData } from '../hooks/useAsyncData'
import {
  fetchDealsForSourceAnalytics,
  isDashboardOnlyStatus,
  isPostedStatus,
  isRejectedStatus,
  isTelegramAlertedStatus,
} from '../services/deals'

type QualityLabel = 'Strong' | 'Average' | 'Weak'

type SourceSummary = {
  source: string
  total: number
  dashboardOnly: number
  telegramAlerted: number
  posted: number
  rejected: number
  postRate: number
  averageDealScore: number | null
  averageSourceTrust: number | null
  quality: QualityLabel
  scores: Array<number | null>
  trusts: Array<number | null>
}

function average(values: Array<number | null>) {
  const usable = values.filter((value): value is number => typeof value === 'number')
  if (usable.length === 0) return null
  return Math.round(usable.reduce((sum, value) => sum + value, 0) / usable.length)
}

function qualityLabel(source: Pick<SourceSummary, 'postRate' | 'averageDealScore' | 'averageSourceTrust'>): QualityLabel {
  const score = source.postRate * 0.4 + (source.averageDealScore ?? 0) * 0.35 + (source.averageSourceTrust ?? 0) * 0.25
  if (score >= 70) return 'Strong'
  if (score >= 40) return 'Average'
  return 'Weak'
}

function qualityClass(label: QualityLabel) {
  if (label === 'Strong') return 'border-emerald-300/30 bg-emerald-400/15 text-emerald-100'
  if (label === 'Average') return 'border-amber-300/30 bg-amber-400/15 text-amber-100'
  return 'border-slate-300/20 bg-slate-400/10 text-slate-300'
}

export function SourcesPage() {
  const { data, error, isLoading, isRefreshing, isConfigured, lastUpdated } = useAsyncData(fetchDealsForSourceAnalytics, [], {
    refreshIntervalMs: 60000,
  })

  const summaries = Object.values(
    (data ?? []).reduce<Record<string, SourceSummary>>((accumulator, deal) => {
      const source = deal.source || 'Unknown source'
      const current =
        accumulator[source] ??
        {
          source,
          total: 0,
          dashboardOnly: 0,
          telegramAlerted: 0,
          posted: 0,
          rejected: 0,
          postRate: 0,
          averageDealScore: null,
          averageSourceTrust: null,
          quality: 'Weak',
          scores: [],
          trusts: [],
        }

      current.total += 1
      current.dashboardOnly += isDashboardOnlyStatus(deal.status) ? 1 : 0
      current.telegramAlerted += isTelegramAlertedStatus(deal.status) ? 1 : 0
      current.posted += isPostedStatus(deal.status) ? 1 : 0
      current.rejected += isRejectedStatus(deal.status) ? 1 : 0
      current.scores.push(deal.deal_score)
      current.trusts.push(deal.source_trust)
      current.postRate = current.total > 0 ? Math.round((current.posted / current.total) * 100) : 0
      current.averageDealScore = average(current.scores)
      current.averageSourceTrust = average(current.trusts)
      current.quality = qualityLabel(current)
      accumulator[source] = current
      return accumulator
    }, {}),
  ).sort((left, right) => {
    const leftQuality = left.postRate + (left.averageDealScore ?? 0) + (left.averageSourceTrust ?? 0)
    const rightQuality = right.postRate + (right.averageDealScore ?? 0) + (right.averageSourceTrust ?? 0)
    return rightQuality - leftQuality
  })

  return (
    <>
      <PageHeader
        title="Sources"
        description="Source quality analytics derived from visible rows in the deals table. No separate sources table is required."
        action={<FreshnessStatus lastUpdated={lastUpdated} isRefreshing={isRefreshing} error={error} />}
      />

      {!isConfigured ? (
        <EmptyState
          title="Supabase is not configured"
          message="Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your local .env file to calculate source analytics."
        />
      ) : null}
      {isLoading ? <LoadingSkeleton rows={4} /> : null}
      {error ? <ErrorState message={error.message} /> : null}

      {!isLoading && !error && isConfigured && summaries.length === 0 ? (
        <EmptyState title="No source data visible" message="No deals are visible to this user, or RLS is blocking reads from the deals table." />
      ) : null}

      {summaries.length > 0 ? (
        <Surface className="overflow-hidden" tone="strong">
          <div className="hidden grid-cols-[1.3fr_repeat(9,minmax(86px,1fr))] gap-3 border-b border-white/[0.08] bg-white/[0.025] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 xl:grid">
            <span>Source</span>
            <span>Total</span>
            <span>Dashboard</span>
            <span>Telegram</span>
            <span>Posted</span>
            <span>Rejected</span>
            <span>Post rate</span>
            <span>Avg score</span>
            <span>Avg trust</span>
            <span>Quality</span>
          </div>

          <div className="divide-y divide-white/10">
            {summaries.map((source) => (
              <div
                key={source.source}
                className="grid gap-3 px-4 py-4 text-sm text-slate-300 transition-colors hover:bg-white/[0.035] xl:grid-cols-[1.3fr_repeat(9,minmax(86px,1fr))]"
              >
                <p className="font-medium text-white">{source.source}</p>
                <p>Total: {source.total}</p>
                <p>Dashboard: {source.dashboardOnly}</p>
                <p>Telegram: {source.telegramAlerted}</p>
                <p>Posted: {source.posted}</p>
                <p>Rejected: {source.rejected}</p>
                <p>Post rate: {source.postRate}%</p>
                <p>Avg score: {source.averageDealScore ?? '--'}</p>
                <p>Avg trust: {source.averageSourceTrust ?? '--'}</p>
                <p>
                  <span className={`inline-flex min-h-7 items-center rounded-lg border px-2.5 text-xs font-semibold ${qualityClass(source.quality)}`}>
                    {source.quality}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </Surface>
      ) : null}
    </>
  )
}
