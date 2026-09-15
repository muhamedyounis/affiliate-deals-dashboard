import { Activity, AlertTriangle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GradeBadge } from '../components/DealBadges'
import { DealAge } from '../components/DealAge'
import { DealDetailsDrawer } from '../components/DealDetailsDrawer'
import { FreshnessStatus } from '../components/FreshnessStatus'
import { HotNowSection } from '../components/HotNowSection'
import { useCategoryFocus } from '../components/CategoryFocusContext'
import { MetricTile, Surface } from '../components/DesignPrimitives'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/StateViews'
import { useAsyncData } from '../hooks/useAsyncData'
import {
  displayProductName,
  fetchDatabaseUsage,
  fetchOverviewData,
  isDashboardOnlyStatus,
  isPendingStatus,
  isPostedStatus,
  isRejectedStatus,
  isTelegramAlertedStatus,
  normalizeGrade,
  subscribeToDealChanges,
  subscribeToDashboardActionChanges,
  subscribeToWatcherHealthChanges,
} from '../services/deals'
import type { DatabaseUsage, Deal, WatcherHealth } from '../types/database'
import {
  allCategoryFocusValue,
  categoryLabel,
  focusLabel,
  normalizedDealCategory,
  subcategoryLabel,
} from '../utils/categories'
import { groupDealsByFamily, rankFamiliesForHotNow } from '../utils/dealPresentation'

const databaseQuotaMb = 500
const gradeOrder = ['HOT', 'GOOD', 'REVIEW', 'LOW'] as const

const gradeChartMeta = {
  HOT: { color: '#22d3ee', soft: 'bg-cyan-400/12 text-cyan-100', border: 'border-cyan-300/20' },
  GOOD: { color: '#34d399', soft: 'bg-emerald-400/15 text-emerald-100', border: 'border-emerald-300/25' },
  REVIEW: { color: '#fbbf24', soft: 'bg-amber-400/15 text-amber-100', border: 'border-amber-300/25' },
  LOW: { color: '#94a3b8', soft: 'bg-slate-400/10 text-slate-300', border: 'border-slate-300/20' },
}

function average(values: Array<number | null>) {
  const usable = values.filter((value): value is number => typeof value === 'number')
  if (usable.length === 0) return null
  return Math.round(usable.reduce((sum, value) => sum + value, 0) / usable.length)
}

function SummaryMetric({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value ?? '--'}</p>
    </div>
  )
}

function formatMb(value: number | null) {
  if (value === null || Number.isNaN(value)) return '--'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)
}

function usageStatus(percentUsed: number) {
  if (percentUsed >= 95) return 'Critical'
  if (percentUsed >= 85) return 'High'
  if (percentUsed >= 70) return 'Watch'
  return 'Healthy'
}

function usageStatusClass(status: string) {
  if (status === 'Critical') return 'border-rose-300/30 bg-rose-400/15 text-rose-100'
  if (status === 'High') return 'border-orange-300/30 bg-orange-400/15 text-orange-100'
  if (status === 'Watch') return 'border-amber-300/30 bg-amber-400/15 text-amber-100'
  if (status === 'Unavailable') return 'border-slate-300/20 bg-slate-400/10 text-slate-300'
  return 'border-emerald-300/30 bg-emerald-400/15 text-emerald-100'
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0%'
  return `${Math.round(value)}%`
}

function percentageOf(value: number, total: number) {
  if (total <= 0) return 0
  return (value / total) * 100
}

function rankedDistribution(
  deals: Array<Pick<Deal, 'category' | 'subcategory'>>,
  focusCategory: string,
) {
  const visibleDeals = focusCategory === 'TECH' ? deals.filter((deal) => deal.category === 'TECH') : deals
  const counts = new Map<string, number>()
  for (const deal of visibleDeals) {
    const key = focusCategory === 'TECH' && deal.subcategory ? deal.subcategory : normalizedDealCategory(deal)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .map(([key, count]) => ({
      key,
      label: focusCategory === 'TECH' ? subcategoryLabel(key) ?? categoryLabel(key) : categoryLabel(key),
      count,
      share: percentageOf(count, visibleDeals.length),
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5)
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value?: number; payload?: { share?: number } }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value ?? 0
  const share = payload[0]?.payload?.share ?? 0

  return (
    <div className="rounded-lg border border-white/10 bg-[#0b1518] px-3 py-2 shadow-xl shadow-black/30">
      <p className="text-xs font-semibold text-white">{label}</p>
      <p className="mt-1 text-xs text-slate-300">
        {value} deals - {formatPercent(share)} of today
      </p>
    </div>
  )
}

function DatabaseUsageCard({
  data,
  error,
  isLoading,
}: {
  data: DatabaseUsage | null
  error: Error | null
  isLoading: boolean
}) {
  const currentMb = typeof data?.database_mb === 'number' ? data.database_mb : null
  const percentUsed = currentMb === null ? null : Math.min(100, Math.max(0, (currentMb / databaseQuotaMb) * 100))
  const remainingMb = currentMb === null ? null : Math.max(0, databaseQuotaMb - currentMb)
  const status = percentUsed === null ? 'Unavailable' : usageStatus(percentUsed)

  return (
    <Surface className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Database Usage</h3>
          <p className="mt-2 text-sm text-slate-400">Postgres database usage</p>
        </div>
        <span className={`inline-flex min-h-7 items-center rounded-lg border px-2.5 text-xs font-semibold ${usageStatusClass(status)}`}>
          {status}
        </span>
      </div>

      {isLoading ? (
        <div className="mt-5 space-y-3">
          <div className="h-8 animate-pulse rounded-lg bg-white/10" />
          <div className="h-3 animate-pulse rounded-full bg-white/10" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
        </div>
      ) : error ? (
        <p className="mt-5 rounded-lg border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100">
          {error.message}
        </p>
      ) : currentMb === null || percentUsed === null ? (
        <p className="mt-5 rounded-lg border border-amber-300/20 bg-amber-400/10 p-3 text-sm text-amber-100">
          Database usage values are unavailable.
        </p>
      ) : (
        <>
          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-3xl font-semibold text-white">{formatMb(currentMb)} MB</p>
              <p className="mt-1 text-sm text-slate-400">of {databaseQuotaMb} MB total</p>
            </div>
            <p className="text-right text-sm text-slate-300">
              <span className="block text-lg font-semibold text-white">{Math.round(percentUsed)}%</span>
              used
            </p>
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-black/30 ring-1 ring-white/10">
            <div
              className="h-full rounded-full bg-cyan-300 transition-[width]"
              style={{ width: `${percentUsed}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-slate-400">{formatMb(remainingMb)} MB remaining</p>
        </>
      )}
    </Surface>
  )
}

function PipelineStage({
  name,
  value,
  total,
  color,
  detail,
}: {
  name: string
  value: number
  total: number
  color: string
  detail: string
}) {
  const percent = percentageOf(value, total)

  return (
    <div className="border-b border-white/[0.07] py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">{name}</p>
          <p className="mt-1 text-xs text-slate-400">{detail}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-white">{value}</p>
          <p className="text-xs text-slate-400">{formatPercent(percent)}</p>
        </div>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(2, Math.min(100, percent))}%`,
            background: color,
            opacity: value > 0 ? 1 : 0.35,
          }}
        />
      </div>
    </div>
  )
}

function isWatcherStale(watcher: WatcherHealth) {
  if (!watcher.last_seen) return true
  return Date.now() - new Date(watcher.last_seen).getTime() > 15 * 60 * 1000
}

function watcherState(watcher: WatcherHealth) {
  if (watcher.status?.toLowerCase() === 'error' || watcher.last_error) return 'error'
  if (isWatcherStale(watcher)) return 'stale'
  return 'online'
}

export function OverviewPage() {
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const { focus } = useCategoryFocus()
  const overviewLoader = useMemo(() => () => fetchOverviewData(focus), [focus])
  const { data, error, isLoading, isRefreshing, isConfigured, lastUpdated, reload } = useAsyncData(overviewLoader, [overviewLoader], {
    refreshIntervalMs: 30000,
  })
  const databaseUsage = useAsyncData(fetchDatabaseUsage, [])

  useEffect(() => {
    if (!isConfigured) return undefined
    const unsubscribeDeals = subscribeToDealChanges(reload)
    const unsubscribeActions = subscribeToDashboardActionChanges(reload)
    const unsubscribeWatcher = subscribeToWatcherHealthChanges(reload)
    return () => {
      unsubscribeDeals()
      unsubscribeActions()
      unsubscribeWatcher()
    }
  }, [isConfigured, reload])

  const summary = useMemo(() => {
    const todayDeals = data?.todayDeals ?? []
    const distribution = gradeOrder.map((grade) => {
      const count = todayDeals.filter((deal) => normalizeGrade(deal.deal_grade) === grade).length

      return {
        grade,
        count,
        share: percentageOf(count, todayDeals.length),
        fill: gradeChartMeta[grade].color,
      }
    })
    const sentToTelegramToday = todayDeals.filter((deal) => isTelegramAlertedStatus(deal.status)).length
    const dashboardOnlyToday = todayDeals.filter((deal) => isDashboardOnlyStatus(deal.status)).length
    const postedToday = todayDeals.filter((deal) => isPostedStatus(deal.status)).length

    return {
      dealsDetectedToday: todayDeals.length,
      sentToTelegramToday,
      dashboardOnlyToday,
      pendingReview: data?.pendingDeals.length ?? 0,
      hotDealsToday: todayDeals.filter((deal) => normalizeGrade(deal.deal_grade) === 'HOT').length,
      postedToday,
      rejectedToday: todayDeals.filter((deal) => isRejectedStatus(deal.status)).length,
      averageDealScore: average(todayDeals.map((deal) => deal.deal_score)),
      averageSourceTrust: average(todayDeals.map((deal) => deal.source_trust)),
      strongDealsToday: todayDeals.filter((deal) => normalizeGrade(deal.deal_grade) === 'GOOD').length,
      freshUnder1h: todayDeals.filter((deal) => {
        if (!deal.created_at) return false
        return Date.now() - new Date(deal.created_at).getTime() < 60 * 60 * 1000
      }).length,
      hotNowFamilies: rankFamiliesForHotNow(groupDealsByFamily(data?.hotNowDeals ?? [])).slice(0, 6),
      justInFamilies: rankFamiliesForHotNow(groupDealsByFamily((data?.pendingDeals ?? []).filter((deal) => {
        const discoveredAt = deal.created_at ? new Date(deal.created_at).getTime() : 0
        return discoveredAt > 0 && Date.now() - discoveredAt < 30 * 60 * 1000
      }))).slice(0, 6),
      needsAttention: rankFamiliesForHotNow(groupDealsByFamily(data?.recentHighScoringDeals ?? [])).slice(0, 4),
      categoryDistribution: rankedDistribution(data?.categoryDistributionDeals ?? [], focus.category),
      distribution,
      funnel: [
        { name: 'Detected', value: todayDeals.length, color: '#22d3ee', detail: 'New deals found today' },
        {
          name: 'Dashboard Only',
          value: dashboardOnlyToday,
          color: '#fbbf24',
          detail: 'Kept for review in the dashboard',
        },
        {
          name: 'Telegram Alerted',
          value: sentToTelegramToday,
          color: '#38bdf8',
          detail: 'Promoted to the alert channel',
        },
        { name: 'Posted', value: postedToday, color: '#34d399', detail: 'Published after approval' },
      ],
    }
  }, [data, focus.category])

  return (
    <>
      <PageHeader
        title="Overview"
        description={`Live read-only operations view from Supabase. Focus: ${focus.category === allCategoryFocusValue ? 'All Categories' : focusLabel(focus)}.`}
        action={<FreshnessStatus lastUpdated={lastUpdated} isRefreshing={isRefreshing} error={error} />}
      />

      {!isConfigured ? (
        <EmptyState
          title="Supabase is not configured"
          message="Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your local .env file to load live dashboard data."
        />
      ) : null}
      {isLoading ? <LoadingSkeleton rows={3} /> : null}
      {error ? <ErrorState message={error.message} /> : null}

      {data && !isLoading && !error ? (
        <>
          <div className="grid overflow-hidden rounded-lg border border-white/[0.09] bg-[#0b1317]/88 shadow-xl shadow-black/12 sm:grid-cols-2 xl:grid-cols-5">
            <MetricTile label="Detected" value={summary.dealsDetectedToday} tone="info" />
            <MetricTile label="Needs Review" value={summary.pendingReview} tone="warn" />
            <MetricTile label="Strong Deals" value={summary.strongDealsToday + summary.hotDealsToday} tone="good" />
            <MetricTile label="Telegram Alerts" value={summary.sentToTelegramToday} tone="info" />
            <MetricTile label="Posted" value={summary.postedToday} tone="good" />
          </div>

          <HotNowSection families={summary.hotNowFamilies} onOpen={setSelectedDeal} />

          <Surface className="mt-6 p-5" tone="strong">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-100">Just In</p>
                <h3 className="mt-1 text-sm font-semibold text-white">Newest interesting discoveries</h3>
              </div>
              <span className="rounded-md border border-white/[0.08] bg-black/20 px-3 py-2 text-xs font-semibold text-slate-300">Last 30 minutes</span>
            </div>
            <div className="mt-4 grid gap-2 xl:grid-cols-2">
              {summary.justInFamilies.map((family) => (
                <button key={family.key} type="button" onClick={() => setSelectedDeal(family.primary)} className="grid gap-3 rounded-lg border border-white/[0.06] bg-black/16 p-3 text-left transition-colors hover:bg-white/[0.045] sm:grid-cols-[1fr_auto]">
                  <span className="min-w-0">
                    <span className="line-clamp-1 text-sm font-medium text-white">{family.title}</span>
                    <span className="mt-1 block text-xs text-slate-500">Discovered <DealAge createdAt={family.primary.created_at} compact /> / verified <DealAge createdAt={family.primary.verified_at ?? family.primary.created_at} compact /></span>
                  </span>
                  <span className="flex items-center gap-2 text-right text-sm">
                    <GradeBadge grade={family.primary.deal_grade} />
                    <span className="font-mono font-semibold text-white">{family.primary.deal_score ?? '--'}</span>
                  </span>
                </button>
              ))}
              {summary.justInFamilies.length === 0 ? <p className="text-sm text-slate-500">No verified fresh discoveries in the last 30 minutes.</p> : null}
            </div>
          </Surface>

          <Surface className="mt-6 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Product and Action Summary</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Catalog coverage and pending backend work queued for n8n.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <SummaryMetric label="Total tracked products" value={data.productSummary.totalTrackedProducts} />
              <SummaryMetric label="Active products" value={data.productSummary.activeProducts} />
              <SummaryMetric label="Checked in last 24h" value={data.productSummary.checkedLast24Hours} />
              <SummaryMetric label="Pending dashboard actions" value={data.productSummary.pendingDashboardActions} />
              <SummaryMetric label="Failed dashboard actions" value={data.productSummary.failedDashboardActions} />
            </div>
          </Surface>

          <Surface className="mt-6 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Category Distribution</h3>
                <p className="mt-2 text-sm text-slate-400">Today&apos;s deal mix, kept compact for scanning.</p>
              </div>
              <p className="rounded-lg bg-black/10 px-3 py-2 text-sm text-slate-300">
                Total <span className="font-semibold text-white">{data.categoryDistributionDeals.length}</span>
              </p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {summary.categoryDistribution.map((category) => (
                <div key={category.key} className="rounded-lg border border-white/[0.06] bg-black/16 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-white">{category.label}</p>
                    <p className="font-mono text-sm text-slate-200">{formatPercent(category.share)}</p>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                    <div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.max(2, category.share)}%` }} />
                  </div>
                </div>
              ))}
              {summary.categoryDistribution.length === 0 ? <p className="text-sm text-slate-500">No category data visible today.</p> : null}
            </div>
          </Surface>

          <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <Surface className="p-5" tone="strong">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Deal Funnel Today</h3>
                  <p className="mt-2 text-sm text-slate-400">
                    How today&apos;s detections move from capture to alerting and posting.
                  </p>
                </div>
                <div className="rounded-lg border border-cyan-300/15 bg-cyan-400/10 px-3 py-2 text-right">
                  <p className="text-xs text-cyan-100/80">Telegram rate</p>
                  <p className="text-lg font-semibold text-white">
                    {formatPercent(percentageOf(summary.sentToTelegramToday, summary.dealsDetectedToday))}
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                {summary.funnel.map((stage) => (
                  <PipelineStage
                    key={stage.name}
                    name={stage.name}
                    value={stage.value}
                    total={summary.dealsDetectedToday}
                    color={stage.color}
                    detail={stage.detail}
                  />
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border border-white/[0.06] bg-black/16 p-3">
                  <p className="text-xs text-slate-400">Review hold</p>
                  <p className="mt-1 text-base font-semibold text-white">
                    {formatPercent(percentageOf(summary.dashboardOnlyToday, summary.dealsDetectedToday))}
                  </p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-black/16 p-3">
                  <p className="text-xs text-slate-400">Posted rate</p>
                  <p className="mt-1 text-base font-semibold text-white">
                    {formatPercent(percentageOf(summary.postedToday, summary.dealsDetectedToday))}
                  </p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-black/16 p-3">
                  <p className="text-xs text-slate-400">Pending total</p>
                  <p className="mt-1 text-base font-semibold text-white">{summary.pendingReview}</p>
                </div>
              </div>
            </Surface>

            <Surface className="p-5" tone="strong">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Deal-grade distribution</h3>
                  <p className="mt-2 text-sm text-slate-400">Count and quality mix for today&apos;s detections.</p>
                </div>
                <p className="rounded-lg bg-black/10 px-3 py-2 text-sm text-slate-300">
                  Total <span className="font-semibold text-white">{summary.dealsDetectedToday}</span>
                </p>
              </div>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.distribution} margin={{ top: 18, right: 12, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(148, 163, 184, 0.14)" vertical={false} />
                    <XAxis
                      dataKey="grade"
                      stroke="#94a3b8"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                    />
                    <YAxis
                      stroke="#64748b"
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                    />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.035)' }} content={<ChartTooltip />} />
                    <Bar dataKey="count" radius={[8, 8, 2, 2]} maxBarSize={92}>
                      {summary.distribution.map((entry) => (
                        <Cell key={entry.grade} fill={entry.fill} />
                      ))}
                      <LabelList dataKey="count" position="top" fill="#e2e8f0" fontSize={12} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {summary.distribution.map((grade) => (
                  <div
                    key={grade.grade}
                    className={`rounded-lg border p-3 ${gradeChartMeta[grade.grade].border} ${gradeChartMeta[grade.grade].soft}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold">{grade.grade}</p>
                      <p className="text-sm font-semibold">{grade.count}</p>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/25">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(2, Math.min(100, grade.share))}%`,
                          background: grade.fill,
                          opacity: grade.count > 0 ? 1 : 0.35,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-xs opacity-80">{formatPercent(grade.share)}</p>
                  </div>
                ))}
              </div>
            </Surface>
          </div>

          <Surface className="mt-6 p-5" tone="strong">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Needs attention now</h3>
                <p className="mt-2 text-sm text-slate-400">A short list of fresh, high-quality opportunities from the active review queue.</p>
              </div>
              <a href="/review-mode" className="inline-flex min-h-10 items-center rounded-lg bg-cyan-300 px-3 text-sm font-semibold text-cyan-950 shadow-lg shadow-cyan-950/20 transition-colors hover:bg-cyan-200">
                Review Mode
              </a>
            </div>
            <div className="mt-4 divide-y divide-white/10">
              {summary.needsAttention.map((family) => (
                <button key={family.key} type="button" className="flex w-full items-center justify-between gap-4 py-3 text-left" onClick={() => setSelectedDeal(family.primary)}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{family.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{family.deals.length} observed child ASIN{family.deals.length === 1 ? '' : 's'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <DealAge createdAt={family.primary.verified_at ?? family.primary.created_at} compact />
                    <GradeBadge grade={family.primary.deal_grade} />
                    <span className="text-sm font-semibold text-white">{family.hotScore}</span>
                  </div>
                </button>
              ))}
              {summary.needsAttention.length === 0 ? <p className="py-6 text-sm text-slate-500">No urgent active opportunities visible.</p> : null}
            </div>
          </Surface>

          <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <Surface className="p-5">
              <h3 className="text-sm font-semibold text-white">Watcher health</h3>
              <div className="mt-4 space-y-3">
                {data.watcherHealth.map((watcher) => {
                  const state = watcherState(watcher)
                  return (
                    <div key={watcher.id} className="rounded-lg border border-white/[0.06] bg-black/16 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-white">{watcher.id}</p>
                        <span className="inline-flex items-center gap-1 rounded-lg bg-white/[0.04] px-2 py-1 text-xs text-slate-300">
                          {state === 'online' ? <Activity size={13} /> : <AlertTriangle size={13} />}
                          {state}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">Last seen: {watcher.last_seen || '--'}</p>
                      <p className="mt-1 text-sm text-slate-400">Candidates: {watcher.candidates ?? '--'}</p>
                      <p className="mt-1 text-sm text-slate-400">Last error: {watcher.last_error || '--'}</p>
                    </div>
                  )
                })}
                {data.watcherHealth.length === 0 ? (
                  <p className="text-sm text-slate-500">No watcher health records visible.</p>
                ) : null}
              </div>
            </Surface>
          </div>

          <Surface className="mt-6 p-5">
            <h3 className="text-sm font-semibold text-white">Top deals waiting for review</h3>
            <div className="mt-4 divide-y divide-white/10">
              {data.recentHighScoringDeals.map((deal) => (
                <button
                  key={deal.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-4 py-3 text-left"
                  onClick={() => setSelectedDeal(deal)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{displayProductName(deal)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {deal.source || '--'} {isPendingStatus(deal.status) ? '| pending' : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <DealAge createdAt={deal.created_at} compact />
                    <GradeBadge grade={deal.deal_grade} />
                    <span className="text-sm font-semibold text-white">{deal.deal_score ?? '--'}</span>
                  </div>
                </button>
              ))}
              {data.recentHighScoringDeals.length === 0 ? (
                <p className="py-6 text-sm text-slate-500">No high-scoring deals visible yet.</p>
              ) : null}
            </div>
          </Surface>
        </>
      ) : null}

      {isConfigured ? (
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <DatabaseUsageCard
            data={databaseUsage.data}
            error={databaseUsage.error}
            isLoading={databaseUsage.isLoading}
          />
        </div>
      ) : null}

      <DealDetailsDrawer deal={selectedDeal} onClose={() => setSelectedDeal(null)} />
    </>
  )
}
