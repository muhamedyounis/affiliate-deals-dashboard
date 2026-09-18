import { Filter, Search } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DealDetailsDrawer } from '../components/DealDetailsDrawer'
import { FreshnessStatus } from '../components/FreshnessStatus'
import { ProductFamilyCard } from '../components/ProductFamilyCard'
import { CategoryFocusControl } from '../components/CategoryFocusControl'
import { useCategoryFocus } from '../components/CategoryFocusContext'
import { ControlShell, MetricTile, Pill, Surface } from '../components/DesignPrimitives'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/StateViews'
import { useAsyncData } from '../hooks/useAsyncData'
import { fetchReviewQueueData, reviewPageSize, type FreshnessFilter, type ReviewQueueFilters } from '../services/deals'
import type { Deal } from '../types/database'
import { groupDealsByFamily, rankFamiliesForHotNow } from '../utils/dealPresentation'

const freshnessOptions: Array<{ value: FreshnessFilter; label: string }> = [
  { value: '1h', label: 'Last 1 hour' },
  { value: '6h', label: 'Last 6 hours' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '3d', label: 'Last 3 days' },
  { value: 'all', label: 'All active' },
]
const routeFilters = [
  { value: 'all', label: 'All Active' },
  { value: 'alerted', label: 'Telegram Alerted' },
  { value: 'dashboard', label: 'Dashboard Only' },
] as const
const gradeFilters = ['all', 'HOT', 'GOOD', 'REVIEW', 'LOW'] as const
const sortOptions = [
  { value: 'best', label: 'Best deal' },
  { value: 'newest', label: 'Newest discovered' },
  { value: 'verified', label: 'Recently verified' },
  { value: 'discount', label: 'Biggest observed drop' },
  { value: 'price', label: 'Lowest price' },
  { value: 'trust', label: 'Highest confidence' },
] as const
const pageSizeOptions = [20, 40, 100] as const

type RouteValue = (typeof routeFilters)[number]['value']
type GradeValue = (typeof gradeFilters)[number]
type SortValue = (typeof sortOptions)[number]['value']

export function ReviewQueuePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const listHeaderRef = useRef<HTMLDivElement | null>(null)
  const [routeFilter, setRouteFilter] = useState<RouteValue>((searchParams.get('route') as RouteValue) || 'all')
  const [gradeFilter, setGradeFilter] = useState<GradeValue>((searchParams.get('grade') as GradeValue) || 'all')
  const [minimumScore, setMinimumScore] = useState(Number(searchParams.get('min') ?? 0))
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [sort, setSort] = useState<SortValue>((searchParams.get('sort') as SortValue) || 'best')
  const [freshness, setFreshness] = useState<FreshnessFilter>((searchParams.get('freshness') as FreshnessFilter) || '24h')
  const [page, setPage] = useState(Math.max(0, Number(searchParams.get('page') ?? 1) - 1))
  const [pageSize, setPageSize] = useState<(typeof pageSizeOptions)[number]>(() => {
    const parsed = Number(searchParams.get('pageSize') ?? reviewPageSize)
    return pageSizeOptions.includes(parsed as (typeof pageSizeOptions)[number]) ? parsed as (typeof pageSizeOptions)[number] : reviewPageSize
  })
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const deferredSearch = useDeferredValue(search)
  const { focus } = useCategoryFocus()

  const filters = useMemo<ReviewQueueFilters>(
    () => ({
      freshness,
      search: deferredSearch,
      route: routeFilter,
      grade: gradeFilter,
      minimumScore,
      sort,
      categoryFocus: focus,
      page,
      pageSize,
    }),
    [deferredSearch, focus, freshness, gradeFilter, minimumScore, page, pageSize, routeFilter, sort],
  )
  const loader = useMemo(() => () => fetchReviewQueueData(filters), [filters])
  const { data, error, isLoading, isRefreshing, isConfigured, lastUpdated, reload } = useAsyncData(loader, [loader], {
    refreshIntervalMs: 25000,
  })
  const pendingActionByDealId = useMemo(
    () => new Map((data?.pendingActions ?? []).map((action) => [action.deal_id, action])),
    [data?.pendingActions],
  )
  const families = useMemo(
    () => rankFamiliesForHotNow(groupDealsByFamily(data?.deals ?? [])),
    [data?.deals],
  )

  useEffect(() => {
    resetPage()
  }, [focus])


  useEffect(() => {
    const next = new URLSearchParams()
    if (search) next.set('q', search)
    if (freshness !== '24h') next.set('freshness', freshness)
    if (routeFilter !== 'all') next.set('route', routeFilter)
    if (gradeFilter !== 'all') next.set('grade', gradeFilter)
    if (minimumScore > 0) next.set('min', String(minimumScore))
    if (sort !== 'best') next.set('sort', sort)
    if (page > 0) next.set('page', String(page + 1))
    if (pageSize !== reviewPageSize) next.set('pageSize', String(pageSize))
    setSearchParams(next, { replace: true })
  }, [freshness, gradeFilter, minimumScore, page, pageSize, routeFilter, search, setSearchParams, sort])

  function resetPage() {
    setPage(0)
  }

  function changePage(nextPage: number) {
    setPage(Math.max(0, nextPage))
    window.setTimeout(() => listHeaderRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 0)
  }

  function clearFilters() {
    setRouteFilter('all')
    setGradeFilter('all')
    setMinimumScore(0)
    setSearch('')
    setSort('best')
    setFreshness('24h')
    resetPage()
  }

  const activeFilterCount = [
    search.trim(),
    freshness !== '24h',
    routeFilter !== 'all',
    gradeFilter !== 'all',
    minimumScore > 0,
    sort !== 'best',
  ].filter(Boolean).length
  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / pageSize))
  const pageStart = data?.deals.length ? page * pageSize + 1 : 0
  const pageEnd = data?.deals.length ? page * pageSize + data.deals.length : 0
  const filterChips = [
    search.trim() ? `Search: ${search.trim()}` : null,
    freshness !== '24h' ? freshnessOptions.find((option) => option.value === freshness)?.label : null,
    routeFilter !== 'all' ? routeFilters.find((option) => option.value === routeFilter)?.label : null,
    gradeFilter !== 'all' ? gradeFilter : null,
    minimumScore > 0 ? `Quality >= ${minimumScore}` : null,
    sort !== 'best' ? `Sort: ${sortOptions.find((option) => option.value === sort)?.label}` : null,
  ].filter(Boolean)

  const pagination = (
    <Surface as="div" className="flex flex-wrap items-center justify-between gap-3 px-3 py-2" tone="subtle">
      <button type="button" disabled={page === 0} onClick={() => changePage(page - 1)} className="min-h-10 rounded-lg border border-white/[0.1] px-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:text-slate-600">
        Previous
      </button>
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
        <span>Page <span className="font-mono text-white">{page + 1}</span> of <span className="font-mono text-white">{totalPages}</span></span>
        <span className="hidden sm:inline">Showing {pageStart}-{pageEnd} of {data?.count ?? 0}</span>
        <label className="inline-flex items-center gap-2">
          Rows
          <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value) as (typeof pageSizeOptions)[number]); changePage(0) }} className="min-h-9 rounded-md border border-white/[0.09] bg-[#081014] px-2 text-xs text-white outline-none ring-cyan-300/20 focus:ring-2">
            {pageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </div>
      <button type="button" disabled={!data?.hasMore} onClick={() => changePage(page + 1)} className="min-h-10 rounded-lg border border-white/[0.1] px-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:text-slate-600">
        Next
      </button>
    </Surface>
  )

  return (
    <>
      <PageHeader
        title="Review Queue"
        description="Fresh actionable opportunities only. Posted and rejected deals live in the historical Deals archive."
      />

      <Surface className="mb-5 p-4" tone="strong">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-3xl font-semibold tabular-nums text-white">{data?.counts.waiting ?? 0}</p>
            <p className="mt-1 text-sm text-slate-400">
              {families.length} product families / {data?.counts.waiting ?? 0} child deals waiting
            </p>
          </div>
          <a
            href="/review-mode"
            className="inline-flex min-h-11 items-center rounded-lg bg-cyan-300 px-4 text-sm font-semibold text-cyan-950 shadow-lg shadow-cyan-950/20 transition-colors hover:bg-cyan-200"
          >
            Open Review Mode
          </a>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <FreshnessStatus lastUpdated={lastUpdated} isRefreshing={isRefreshing} error={error} />
          {activeFilterCount ? (
            <button type="button" onClick={clearFilters} className="min-h-8 rounded-md border border-white/[0.09] px-2.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/[0.055] hover:text-white">
              Clear filters ({activeFilterCount})
            </button>
          ) : null}
        </div>
        <div className="mt-4 grid divide-white/[0.07] overflow-hidden rounded-lg border border-white/[0.08] bg-black/18 sm:grid-cols-2 xl:grid-cols-5 xl:divide-x">
          <MetricTile label="Telegram Alerts" value={data?.counts.alerted ?? 0} tone="info" />
          <MetricTile label="Dashboard Only" value={data?.counts.dashboardOnly ?? 0} />
          <MetricTile label="Hot" value={data?.counts.exceptional ?? 0} tone="good" />
          <MetricTile label="Strong" value={data?.counts.strong ?? 0} tone="good" />
          <MetricTile label="Fresh <1h" value={data?.counts.freshUnder1h ?? 0} tone="warn" />
        </div>
      </Surface>

      <Surface className="sticky top-[132px] z-[8] mb-5 p-4 lg:top-[76px]" tone="strong">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Filter size={16} aria-hidden="true" />
            Queue command bar
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {filterChips.map((chip) => <Pill key={chip} tone="info">{chip}</Pill>)}
            {filterChips.length === 0 ? <span className="text-xs font-medium text-slate-500">Default live queue</span> : null}
          </div>
        </div>
        <div className="mt-4">
          <CategoryFocusControl />
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_repeat(4,auto)]">
          <label className="relative block">
            <span className="sr-only">Search review queue</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                resetPage()
              }}
              placeholder="Search product, ASIN, or source"
              className="min-h-11 w-full rounded-lg border border-white/[0.09] bg-black/20 pl-10 pr-3 text-sm text-white outline-none ring-cyan-300/20 placeholder:text-slate-500 focus:ring-2"
            />
          </label>
          <select aria-label="Freshness" value={freshness} onChange={(event) => { setFreshness(event.target.value as FreshnessFilter); resetPage() }} className="min-h-11 rounded-lg border border-white/[0.09] bg-[#081014] px-3 text-sm text-white outline-none ring-cyan-300/20 focus:ring-2">
            {freshnessOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select aria-label="Route" value={routeFilter} onChange={(event) => { setRouteFilter(event.target.value as RouteValue); resetPage() }} className="min-h-11 rounded-lg border border-white/[0.09] bg-[#081014] px-3 text-sm text-white outline-none ring-cyan-300/20 focus:ring-2">
            {routeFilters.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select aria-label="Grade" value={gradeFilter} onChange={(event) => { setGradeFilter(event.target.value as GradeValue); resetPage() }} className="min-h-11 rounded-lg border border-white/[0.09] bg-[#081014] px-3 text-sm text-white outline-none ring-cyan-300/20 focus:ring-2">
            {gradeFilters.map((grade) => <option key={grade} value={grade}>{grade === 'all' ? 'All Grades' : grade}</option>)}
          </select>
          <select aria-label="Sort" value={sort} onChange={(event) => { setSort(event.target.value as SortValue); resetPage() }} className="min-h-11 rounded-lg border border-white/[0.09] bg-[#081014] px-3 text-sm text-white outline-none ring-cyan-300/20 focus:ring-2">
            {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <ControlShell className="mt-3 flex min-h-11 max-w-xs items-center gap-3 px-3 text-sm text-slate-300">
        <label className="contents">
          Min quality
          <input
            type="number"
            min="0"
            max="100"
            value={minimumScore}
            onChange={(event) => { setMinimumScore(Number(event.target.value)); resetPage() }}
            inputMode="numeric"
            className="w-20 bg-transparent font-mono text-white outline-none"
          />
        </label>
        </ControlShell>
      </Surface>

      {!isConfigured ? <EmptyState title="Supabase is not configured" message="Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to load the review queue." /> : null}
      {isLoading ? <LoadingSkeleton rows={4} /> : null}
      {error ? <ErrorState message={error.message} /> : null}
      {!isLoading && !error && isConfigured && families.length === 0 ? (
        <EmptyState title="No active deals match this view" message="Try a wider freshness window or loosen the quality filters." />
      ) : null}

      {data && data.count > 0 ? <div className="mb-4">{pagination}</div> : null}

      <div ref={listHeaderRef} className="mb-2 hidden grid-cols-[52px_minmax(260px,1.7fr)_112px_130px_112px_112px_156px_178px] gap-4 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 lg:grid">
        <span />
        <span>Product</span>
        <span>Best Price</span>
        <span>History</span>
        <span>Quality</span>
        <span>Confidence</span>
        <span>Freshness</span>
        <span className="text-right">Actions</span>
      </div>
      <div className="space-y-1.5">
        {families.map((family) => (
          <ProductFamilyCard
            key={family.key}
            family={family}
            pendingActionByDealId={pendingActionByDealId}
            onOpen={setSelectedDeal}
            onActionCreated={reload}
          />
        ))}
      </div>

      {data && data.count > 0 ? <div className="mt-5">{pagination}</div> : null}

      <DealDetailsDrawer deal={selectedDeal} onClose={() => setSelectedDeal(null)} onDealUpdated={setSelectedDeal} />
    </>
  )
}


