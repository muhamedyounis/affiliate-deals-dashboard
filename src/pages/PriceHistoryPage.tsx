import { Search } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { CategoryFocusControl } from '../components/CategoryFocusControl'
import { useCategoryFocus } from '../components/CategoryFocusContext'
import { DealDetailsDrawer } from '../components/DealDetailsDrawer'
import { FreshnessStatus } from '../components/FreshnessStatus'
import { ProductFamilyCard } from '../components/ProductFamilyCard'
import { Surface } from '../components/DesignPrimitives'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/StateViews'
import { useAsyncData } from '../hooks/useAsyncData'
import { fetchProductCatalogDeals, productsPageSize, type ProductCatalogFilters } from '../services/deals'
import type { Deal } from '../types/database'
import {
  groupDealsByFamily,
  rankFamiliesForHotNow,
  verifiedTime,
} from '../utils/dealPresentation'

const sortOptions = [
  { value: 'last_verified', label: 'Recently verified' },
  { value: 'best_price', label: 'Best current price' },
  { value: 'variants', label: 'Most observed variants' },
  { value: 'history', label: 'Best history signal' },
  { value: 'name', label: 'Product name' },
] as const

type SortValue = (typeof sortOptions)[number]['value']

function timeValue(value: string | null) {
  return value ? new Date(value).getTime() : 0
}

export function PriceHistoryPage() {
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortValue>('last_verified')
  const [page, setPage] = useState(0)
  const deferredSearch = useDeferredValue(search)
  const { focus } = useCategoryFocus()

  const filters = useMemo<ProductCatalogFilters>(() => ({
    categoryFocus: focus,
    search: deferredSearch,
    sort,
    page,
    pageSize: productsPageSize,
  }), [deferredSearch, focus, page, sort])
  const loader = useMemo(() => () => fetchProductCatalogDeals(filters), [filters])
  const { data, error, isLoading, isRefreshing, isConfigured, lastUpdated } = useAsyncData(loader, [loader], {
    refreshIntervalMs: 60000,
  })

  useEffect(() => {
    setPage(0)
  }, [focus, deferredSearch, sort])

  const families = useMemo(() => {
    const grouped = groupDealsByFamily(data?.deals ?? [])
    if (sort === 'variants') return grouped.sort((left, right) => right.deals.length - left.deals.length)
    return rankFamiliesForHotNow(grouped).sort((left, right) => timeValue(verifiedTime(right.primary)) - timeValue(verifiedTime(left.primary)))
  }, [data?.deals, sort])

  const pageStart = data?.deals.length ? page * productsPageSize + 1 : 0
  const pageEnd = data?.deals.length ? page * productsPageSize + data.deals.length : 0

  return (
    <>
      <PageHeader
        title="Products / Catalog"
        description="Family-aware product view from observed deal rows. Expand any family to inspect child ASINs without merging records."
        action={<FreshnessStatus lastUpdated={lastUpdated} isRefreshing={isRefreshing} error={error} />}
      />

      <Surface className="mb-5 p-4" tone="strong">
        <div className="mb-4">
          <CategoryFocusControl />
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <label className="relative block">
            <span className="sr-only">Search product catalog</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              size={17}
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search family, ASIN, or variant"
              className="min-h-11 w-full rounded-lg border border-white/[0.09] bg-black/20 pl-10 pr-3 text-sm text-white outline-none ring-cyan-300/20 placeholder:text-slate-500 focus:ring-2"
            />
          </label>
          <select
            aria-label="Sort product catalog"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortValue)}
            className="min-h-11 rounded-lg border border-white/[0.09] bg-[#081014] px-3 text-sm text-white outline-none ring-cyan-300/20 focus:ring-2"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </Surface>

      {!isConfigured ? (
        <EmptyState title="Supabase is not configured" message="Add Supabase environment variables to load the product catalog." />
      ) : null}
      {isLoading ? <LoadingSkeleton rows={5} /> : null}
      {error ? <ErrorState message={error.message} /> : null}
      {!isLoading && !error && isConfigured && families.length === 0 ? (
        <EmptyState title="No product families found" message="No observed deal rows match the current filters." />
      ) : null}

      {families.length > 0 ? (
        <>
          <div className="mb-3 text-sm text-slate-400">
            Showing {pageStart}-{pageEnd} of {data?.count ?? 0} observed child deal rows / {families.length} families on this page
          </div>
          <div className="space-y-1.5">
            {families.map((family) => (
              <ProductFamilyCard key={family.key} family={family} onOpen={setSelectedDeal} compact />
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between gap-3">
            <button type="button" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} className="min-h-10 rounded-lg border border-white/10 px-4 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:text-slate-600 hover:bg-white/5">
              Previous
            </button>
            <span className="text-sm text-slate-400">Page {page + 1}</span>
            <button type="button" disabled={!data?.hasMore} onClick={() => setPage((current) => current + 1)} className="min-h-10 rounded-lg border border-white/10 px-4 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:text-slate-600 hover:bg-white/5">
              Next
            </button>
          </div>
        </>
      ) : null}

      <DealDetailsDrawer deal={selectedDeal} onClose={() => setSelectedDeal(null)} onDealUpdated={setSelectedDeal} />
    </>
  )
}
