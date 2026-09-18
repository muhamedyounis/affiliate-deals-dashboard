import { Search } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { CategoryFocusControl } from '../components/CategoryFocusControl'
import { useCategoryFocus } from '../components/CategoryFocusContext'
import { DealAge } from '../components/DealAge'
import { CategoryBadge, GradeBadge, StatusBadge } from '../components/DealBadges'
import { DealDetailsDrawer } from '../components/DealDetailsDrawer'
import { FreshnessStatus } from '../components/FreshnessStatus'
import { ProductFamilyCard } from '../components/ProductFamilyCard'
import { ControlShell, ProductImageFrame, Surface } from '../components/DesignPrimitives'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/StateViews'
import { useAsyncData } from '../hooks/useAsyncData'
import { dealsPageSize, displayProductName, fetchAllDeals, fetchDealSources, normalizeGrade } from '../services/deals'
import type { Deal } from '../types/database'
import { formatCurrency, groupDealsByFamily, rankFamiliesForHotNow, realObservedDrop } from '../utils/dealPresentation'

const statusFilters = ['All Statuses', 'Dashboard Only', 'Telegram Alerted', 'Posted', 'Rejected', 'Legacy Pending'] as const
const gradeFilters = ['All Grades', 'HOT', 'GOOD', 'REVIEW', 'LOW'] as const

type StatusFilter = (typeof statusFilters)[number]
type GradeFilter = (typeof gradeFilters)[number]

export function DealsPage() {
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All Statuses')
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>('All Grades')
  const [sourceFilter, setSourceFilter] = useState('All Sources')
  const [minimumScore, setMinimumScore] = useState(0)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')
  const [groupByProduct, setGroupByProduct] = useState(false)
  const [page, setPage] = useState(0)
  const deferredSearch = useDeferredValue(search)
  const { focus } = useCategoryFocus()

  const sourceLoader = useMemo(() => fetchDealSources, [])
  const sources = useAsyncData(sourceLoader, [sourceLoader])
  const filters = useMemo(
    () => ({
      status: statusFilter,
      grade: gradeFilter,
      source: sourceFilter,
      categoryFocus: focus,
      minimumScore,
      startDate,
      endDate,
      search: deferredSearch,
      page,
      pageSize: dealsPageSize,
    }),
    [deferredSearch, endDate, focus, gradeFilter, minimumScore, page, sourceFilter, startDate, statusFilter],
  )
  const loader = useMemo(() => () => fetchAllDeals(filters), [filters])
  const { data, error, isLoading, isRefreshing, isConfigured, lastUpdated } = useAsyncData(loader, [loader], {
    refreshIntervalMs: 60000,
  })
  const sourceOptions = ['All Sources', ...(sources.data ?? [])]
  const families = useMemo(
    () => rankFamiliesForHotNow(groupDealsByFamily(data?.deals ?? [])),
    [data?.deals],
  )

  function resetPage() {
    setPage(0)
  }

  useEffect(() => {
    resetPage()
  }, [focus])

  return (
    <>
      <PageHeader
        title="Deals"
        description="Complete historical archive across every status. Use this for lookup, auditing, and older decisions."
        action={<FreshnessStatus lastUpdated={lastUpdated} isRefreshing={isRefreshing} error={error} />}
      />

      <Surface className="mb-5 p-4" tone="strong">
        <div className="mb-4">
          <CategoryFocusControl />
        </div>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[1fr_repeat(5,auto)]">
          <label className="relative block">
            <span className="sr-only">Search deals archive</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); resetPage() }}
              placeholder="Search product, ASIN, source, or status"
              className="min-h-11 w-full rounded-lg border border-white/[0.09] bg-black/20 pl-10 pr-3 text-sm text-white outline-none ring-cyan-300/20 placeholder:text-slate-500 focus:ring-2"
            />
          </label>
          <select aria-label="Status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as StatusFilter); resetPage() }} className="min-h-11 rounded-lg border border-white/[0.09] bg-[#081014] px-3 text-sm text-white outline-none ring-cyan-300/20 focus:ring-2">
            {statusFilters.map((status) => <option key={status}>{status}</option>)}
          </select>
          <select aria-label="Grade" value={gradeFilter} onChange={(event) => { setGradeFilter(event.target.value as GradeFilter); resetPage() }} className="min-h-11 rounded-lg border border-white/[0.09] bg-[#081014] px-3 text-sm text-white outline-none ring-cyan-300/20 focus:ring-2">
            {gradeFilters.map((grade) => <option key={grade}>{grade}</option>)}
          </select>
          <select aria-label="Source" value={sourceFilter} onChange={(event) => { setSourceFilter(event.target.value); resetPage() }} className="min-h-11 rounded-lg border border-white/[0.09] bg-[#081014] px-3 text-sm text-white outline-none ring-cyan-300/20 focus:ring-2">
            {sourceOptions.map((source) => <option key={source}>{source}</option>)}
          </select>
          <input aria-label="Start date" type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); resetPage() }} className="min-h-11 rounded-lg border border-white/[0.09] bg-[#081014] px-3 text-sm text-white outline-none ring-cyan-300/20 focus:ring-2" />
          <input aria-label="End date" type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); resetPage() }} className="min-h-11 rounded-lg border border-white/[0.09] bg-[#081014] px-3 text-sm text-white outline-none ring-cyan-300/20 focus:ring-2" />
        </div>
        <ControlShell className="mt-3 flex min-h-11 max-w-xs items-center gap-3 px-3 text-sm text-slate-300">
        <label className="contents">
          Min quality
          <input type="number" min="0" max="100" inputMode="numeric" value={minimumScore} onChange={(event) => { setMinimumScore(Number(event.target.value)); resetPage() }} className="w-20 bg-transparent font-mono text-white outline-none" />
        </label>
        </ControlShell>
        <label className="mt-3 inline-flex min-h-11 items-center gap-3 rounded-lg border border-white/[0.09] bg-black/20 px-3 text-sm font-medium text-slate-300">
          <input
            type="checkbox"
            checked={groupByProduct}
            onChange={(event) => setGroupByProduct(event.target.checked)}
            className="size-4 accent-cyan-300"
          />
          Group by product
        </label>
      </Surface>

      {!isConfigured ? <EmptyState title="Supabase is not configured" message="Add Supabase environment variables to load historical deals." /> : null}
      {isLoading ? <LoadingSkeleton rows={5} /> : null}
      {error ? <ErrorState message={error.message} /> : null}
      {!isLoading && !error && isConfigured && data?.deals.length === 0 ? <EmptyState title="No deals found" message="No visible rows match the current filters." /> : null}

      {data && data.deals.length > 0 ? (
        <>
          <div className="mb-3 text-sm text-slate-400">
            Showing {page * dealsPageSize + 1}-{page * dealsPageSize + data.deals.length} of {data.count} deals
            {groupByProduct ? ` / ${families.length} product families on this page` : ''}
          </div>
          {groupByProduct ? (
            <div className="space-y-1.5">
              {families.map((family) => (
                <ProductFamilyCard key={family.key} family={family} onOpen={setSelectedDeal} compact />
              ))}
            </div>
          ) : (
          <div className="overflow-hidden rounded-lg border border-white/[0.09] bg-[#0b1317]/88 shadow-xl shadow-black/12">
            <div className="hidden grid-cols-[2fr_120px_90px_105px_110px_110px_120px_110px_1fr] gap-3 border-b border-white/[0.08] bg-white/[0.025] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 xl:grid">
              <span>Product</span>
              <span>Category</span>
              <span>Age</span>
              <span>Status</span>
              <span>Price</span>
              <span>Real Drop</span>
              <span>Quality</span>
              <span>Confidence</span>
              <span>Source</span>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {data.deals.map((deal) => (
                <button key={deal.id} type="button" onClick={() => setSelectedDeal(deal)} className="grid w-full gap-3 px-4 py-3 text-left text-sm text-slate-300 transition-colors hover:bg-white/[0.045] xl:grid-cols-[2fr_120px_90px_105px_110px_110px_120px_110px_1fr] xl:items-center">
                  <span className="flex min-w-0 items-center gap-3">
                    <ProductImageFrame src={deal.product_image} alt={displayProductName(deal)} size="small" />
                    <span className="min-w-0">
                    <span className="line-clamp-2 font-medium text-white">{displayProductName(deal)}</span>
                    <span className="mt-1 block text-xs text-slate-500">{deal.asin || '--'}</span>
                    </span>
                  </span>
                  <span className="xl:block">
                    <CategoryBadge deal={deal} />
                  </span>
                  <DealAge createdAt={deal.created_at} compact />
                  <StatusBadge status={deal.status} />
                  <span className="font-mono tabular-nums text-white">{formatCurrency(deal.claimed_price)}</span>
                  <span className={realObservedDrop(deal) ? 'font-mono text-emerald-200' : 'font-mono text-slate-500'}>{realObservedDrop(deal) ? `-${realObservedDrop(deal)?.percent}%` : '--'}</span>
                  <span className="font-mono tabular-nums text-white">{deal.deal_score ?? '--'} <GradeBadge grade={normalizeGrade(deal.deal_grade)} /></span>
                  <span className="font-mono tabular-nums text-white">{deal.source_trust ?? '--'}</span>
                  <span className="truncate">{deal.source || '--'}</span>
                </button>
              ))}
            </div>
          </div>
          )}
          <div className="mt-5 flex items-center justify-between gap-3">
            <button type="button" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} className="min-h-10 rounded-lg border border-white/10 px-4 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:text-slate-600 hover:bg-white/5">
              Previous
            </button>
            <span className="text-sm text-slate-400">Page {page + 1}</span>
            <button type="button" disabled={!data.hasMore} onClick={() => setPage((current) => current + 1)} className="min-h-10 rounded-lg border border-white/10 px-4 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:text-slate-600 hover:bg-white/5">
              Next
            </button>
          </div>
        </>
      ) : null}

      <DealDetailsDrawer deal={selectedDeal} onClose={() => setSelectedDeal(null)} onDealUpdated={setSelectedDeal} />
    </>
  )
}
