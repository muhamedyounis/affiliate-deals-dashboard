import { supabase } from '../lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DashboardAction,
  DashboardActionKind,
  DatabaseUsage,
  Deal,
  DealSighting,
  ProductCatalogItem,
  WatcherHealth,
  Database,
} from '../types/database'
import {
  allCategoryFocusValue,
  uncategorizedCategoryValue,
  type CategoryFocus,
} from '../utils/categories'
import { displayDealName } from '../utils/dealPresentation'

export const reviewStatuses = ['REVIEW', 'PENDING_APPROVAL', 'PENDING', 'NEW'] as const
export const pendingStatuses = reviewStatuses
export const reviewPageSize = 20
export const reviewModeBatchSize = 20
export const dealsPageSize = 40
export const productsPageSize = 40

const postedStatuses = ['POSTED']
const rejectedStatuses = ['REJECTED']
const unprocessedActionStatuses = ['PENDING', 'PROCESSING'] as const

const dealListSelect = `
  id,
  created_at,
  source,
  original_amazon_url,
  amazon_url,
  affiliate_url,
  asin,
  parent_asin,
  product_family_key,
  canonical_product_name,
  variant_label,
  variant_count,
  telegram_url,
  telegram_date,
  product_name,
  product_name_guess,
  product_image,
  price,
  claimed_price,
  claimed_discount,
  verified_title,
  verified_price,
  verified_at,
  verified_availability,
  verified_image,
  verification_status,
  post_verification_code,
  post_verification_message,
  caption,
  generated_caption,
  status,
  published_message_id,
  source_trust,
  deal_score,
  quality_score,
  confidence_score,
  deal_grade,
  score_reasons,
  risk_flags,
  category,
  subcategory,
  amazon_price_drop_percent`
const dealDetailSelect = `${dealListSelect}, source_message_id, source_text, category_confidence, category_source`
const dashboardActionSelect = 'id, deal_id, action, requested_by, status, note, result, created_at, processed_at, processing_started_at, finished_at'

function requireSupabase() {
  if (!supabase) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY')
  }

  return supabase
}

export function displayProductName(deal: Deal) {
  return displayDealName(deal)
}

export function normalizeGrade(grade: string | null | undefined) {
  const normalized = grade?.trim().toUpperCase()
  if (normalized === 'HOT' || normalized === 'GOOD' || normalized === 'REVIEW' || normalized === 'LOW') {
    return normalized
  }

  return 'REVIEW'
}

export function isPendingStatus(status: string | null) {
  return Boolean(status && reviewStatuses.includes(status.toUpperCase() as (typeof reviewStatuses)[number]))
}

export function isTelegramAlertedStatus(status: string | null) {
  return status?.toUpperCase() === 'PENDING_APPROVAL'
}

export function isDashboardOnlyStatus(status: string | null) {
  return status?.toUpperCase() === 'REVIEW'
}

export function isPostedStatus(status: string | null) {
  return Boolean(status && postedStatuses.includes(status.toUpperCase()))
}

export function isRejectedStatus(status: string | null) {
  return Boolean(status && rejectedStatuses.includes(status.toUpperCase()))
}

export function statusLabel(status: string | null) {
  const normalized = status?.toUpperCase()
  if (normalized === 'PENDING_APPROVAL') return 'Telegram Alerted'
  if (normalized === 'REVIEW') return 'Dashboard Only'
  if (normalized === 'POSTED') return 'Posted'
  if (normalized === 'REJECTED') return 'Rejected'
  if (normalized === 'NEW' || normalized === 'PENDING') return 'Legacy Pending'
  return status || 'Unknown'
}

export type FreshnessFilter = '1h' | '6h' | '24h' | '3d' | 'all'

export type ReviewQueueFilters = {
  freshness?: FreshnessFilter
  search?: string
  route?: 'all' | 'alerted' | 'dashboard'
  grade?: 'all' | 'HOT' | 'GOOD' | 'REVIEW' | 'LOW'
  minimumScore?: number
  sort?: 'best' | 'newest' | 'verified' | 'discount' | 'price' | 'trust' | 'score'
  categoryFocus?: CategoryFocus
  page?: number
  pageSize?: number
}

export type ReviewCursor = {
  createdAt: string
  id: number
}

export type DealsArchiveFilters = {
  status?: string
  grade?: string
  source?: string
  categoryFocus?: CategoryFocus
  minimumScore?: number
  startDate?: string
  endDate?: string
  search?: string
  page?: number
  pageSize?: number
}

export type HotNowFilters = {
  categoryFocus?: CategoryFocus
  limit?: number
}

export type ProductCatalogFilters = {
  categoryFocus?: CategoryFocus
  search?: string
  sort?: 'last_verified' | 'best_price' | 'variants' | 'history' | 'name'
  page?: number
  pageSize?: number
}
function freshnessCutoff(freshness: FreshnessFilter | undefined) {
  const value = freshness ?? '24h'
  if (value === 'all') return null

  const hours = value === '1h' ? 1 : value === '6h' ? 6 : value === '3d' ? 72 : 24
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

function applyDealSearch(query: any, search: string | undefined) {
  const trimmed = search?.trim()
  if (!trimmed) return query

  const escaped = trimmed.replaceAll('%', '\\%').replaceAll(',', ' ')
  return query.or(
    `product_name.ilike.%${escaped}%,product_name_guess.ilike.%${escaped}%,verified_title.ilike.%${escaped}%,canonical_product_name.ilike.%${escaped}%,variant_label.ilike.%${escaped}%,asin.ilike.%${escaped}%,parent_asin.ilike.%${escaped}%,source.ilike.%${escaped}%`,
  )
}

function applyCategoryFocus(query: any, focus: CategoryFocus | undefined) {
  if (!focus || focus.category === allCategoryFocusValue) return query
  if (focus.category === uncategorizedCategoryValue) return query.is('category', null)

  let next = query.eq('category', focus.category)
  if (focus.subcategory) next = next.eq('subcategory', focus.subcategory)
  return next
}

function applyReviewFilters(query: any, filters: ReviewQueueFilters) {
  let next = query.in('status', [...reviewStatuses])
  const cutoff = freshnessCutoff(filters.freshness)

  if (cutoff) next = next.gte('created_at', cutoff)
  if (filters.route === 'alerted') next = next.eq('status', 'PENDING_APPROVAL')
  if (filters.route === 'dashboard') next = next.eq('status', 'REVIEW')
  if (filters.grade && filters.grade !== 'all') next = next.eq('deal_grade', filters.grade)
  if (filters.minimumScore && filters.minimumScore > 0) next = next.gte('deal_score', filters.minimumScore)
  next = applyCategoryFocus(next, filters.categoryFocus)

  return applyDealSearch(next, filters.search)
}

function orderReviewQuery(
  query: any,
  sort: ReviewQueueFilters['sort'],
) {
  if (sort === 'best' || sort === 'score') {
    return query
      .order('deal_score', { ascending: false, nullsFirst: false })
      .order('source_trust', { ascending: false, nullsFirst: false })
      .order('verified_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
  }
  if (sort === 'discount') {
    return query.order('claimed_discount', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false })
  }
  if (sort === 'trust') {
    return query.order('source_trust', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false })
  }
  if (sort === 'verified') {
    return query.order('verified_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false })
  }
  if (sort === 'price') {
    return query.order('verified_price', { ascending: true, nullsFirst: false }).order('claimed_price', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false })
  }
  return query.order('created_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false })
}

async function hydrateDealProductImages<T extends Deal>(client: SupabaseClient<Database>, deals: T[]) {
  const asins = Array.from(new Set(deals.map((deal) => deal.asin).filter((asin): asin is string => Boolean(asin))))
  if (asins.length === 0) return deals

  const { data, error } = await client
    .from('product_catalog')
    .select('asin, product_image, last_seen_price, best_seen_price, last_checked_at')
    .in('asin', asins)

  if (error) throw error

  const productByAsin = new Map((data ?? []).map((product) => [product.asin, product]))
  return deals.map((deal) => ({
    ...deal,
    product_image: deal.product_image ?? (deal.asin ? productByAsin.get(deal.asin)?.product_image ?? null : null),
    product_last_seen_price: deal.asin ? productByAsin.get(deal.asin)?.last_seen_price ?? null : null,
    product_best_seen_price: deal.asin ? productByAsin.get(deal.asin)?.best_seen_price ?? null : null,
    product_last_checked_at: deal.asin ? productByAsin.get(deal.asin)?.last_checked_at ?? null : null,
  }))
}

export async function fetchReviewDeals(filters: ReviewQueueFilters = {}) {
  const client = requireSupabase()
  const pageSize = filters.pageSize ?? reviewPageSize
  const page = filters.page ?? 0
  const from = page * pageSize
  const to = from + pageSize - 1

  const query = applyReviewFilters(client.from('deals').select(dealListSelect, { count: 'exact' }), filters)
  const { data, error, count } = await orderReviewQuery(query, filters.sort).range(from, to)

  if (error) throw error
  return { deals: await hydrateDealProductImages(client, data ?? []), count: count ?? 0, hasMore: to + 1 < (count ?? 0) }
}

export async function fetchReviewDealStreamBatch(filters: ReviewQueueFilters = {}, cursor?: ReviewCursor | null) {
  const client = requireSupabase()
  const pageSize = filters.pageSize ?? reviewModeBatchSize
  let query = applyReviewFilters(client.from('deals').select(dealListSelect, { count: cursor ? undefined : 'exact' }), filters)

  if (cursor) {
    query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(pageSize)

  if (error) throw error

  const deals = await hydrateDealProductImages(client, data ?? [])
  const last = deals[deals.length - 1]
  return {
    deals,
    count: count ?? null,
    nextCursor: last?.created_at ? { createdAt: last.created_at, id: last.id } satisfies ReviewCursor : null,
    exhausted: deals.length < pageSize,
  }
}

export async function fetchReviewCounts(freshness: FreshnessFilter = '24h', categoryFocus?: CategoryFocus) {
  const client = requireSupabase()
  const cutoff = freshnessCutoff(freshness)

  function countBase() {
    let query = client.from('deals').select('id', { count: 'exact', head: true }).in('status', [...reviewStatuses])
    if (cutoff) query = query.gte('created_at', cutoff)
    return applyCategoryFocus(query, categoryFocus)
  }

  const [waiting, alerted, dashboardOnly, exceptional, strong, fresh] = await Promise.all([
    countBase(),
    countBase().eq('status', 'PENDING_APPROVAL'),
    countBase().eq('status', 'REVIEW'),
    countBase().eq('deal_grade', 'HOT'),
    countBase().eq('deal_grade', 'GOOD'),
    applyCategoryFocus(
      client
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .in('status', [...reviewStatuses])
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()),
      categoryFocus,
    ),
  ])

  for (const result of [waiting, alerted, dashboardOnly, exceptional, strong, fresh]) {
    if (result.error) throw result.error
  }

  return {
    waiting: waiting.count ?? 0,
    alerted: alerted.count ?? 0,
    dashboardOnly: dashboardOnly.count ?? 0,
    exceptional: exceptional.count ?? 0,
    strong: strong.count ?? 0,
    freshUnder1h: fresh.count ?? 0,
  }
}

export async function fetchPendingActionsForDeals(dealIds: number[]) {
  if (dealIds.length === 0) return []

  const client = requireSupabase()
  const { data, error } = await client
    .from('dashboard_actions')
    .select(dashboardActionSelect)
    .in('deal_id', dealIds)
    .in('status', [...unprocessedActionStatuses])
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function fetchLatestPendingActionForDeal(dealId: number) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('dashboard_actions')
    .select(dashboardActionSelect)
    .eq('deal_id', dealId)
    .in('status', [...unprocessedActionStatuses])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function fetchReviewQueueData(filters: ReviewQueueFilters = {}) {
  const [result, counts] = await Promise.all([fetchReviewDeals(filters), fetchReviewCounts(filters.freshness, filters.categoryFocus)])
  const pendingActions = await fetchPendingActionsForDeals(result.deals.map((deal: Deal) => deal.id))
  return { ...result, counts, pendingActions }
}

export async function fetchReviewModeCount(filters: ReviewQueueFilters = {}) {
  const client = requireSupabase()
  const query = applyReviewFilters(client.from('deals').select('id', { count: 'exact', head: true }), filters)
  const { error, count } = await query
  if (error) throw error
  return count ?? 0
}

export async function fetchHotNowDeals(filters: HotNowFilters = {}) {
  const client = requireSupabase()
  const recentCutoff = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()
  const limit = filters.limit ?? 12

  let query = client
    .from('deals')
    .select(dealListSelect)
    .in('status', [...reviewStatuses])
    .not('verified_price', 'is', null)
    .gte('verified_at', recentCutoff)
    .order('deal_score', { ascending: false, nullsFirst: false })
    .order('source_trust', { ascending: false, nullsFirst: false })
    .order('verified_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  query = applyCategoryFocus(query, filters.categoryFocus)
  const { data, error } = await query

  if (error) throw error
  return hydrateDealProductImages(client, data ?? [])
}

export async function fetchOverviewData(categoryFocus?: CategoryFocus) {
  const client = requireSupabase()
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const todayBase = () => applyCategoryFocus(client.from('deals').select(dealListSelect, { count: 'exact' }), categoryFocus).gte('created_at', startOfToday.toISOString()).limit(300)
  const pendingBase = () => applyCategoryFocus(client.from('deals').select(dealListSelect, { count: 'exact' }), categoryFocus).in('status', [...reviewStatuses]).order('created_at', { ascending: false }).limit(24)
  const highScoringBase = () => applyCategoryFocus(client.from('deals').select(dealListSelect), categoryFocus)
    .in('status', [...reviewStatuses])
    .not('deal_score', 'is', null)
    .order('deal_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(8)

  const [
    todayDeals,
    pendingDeals,
    recentHighScoringDeals,
    hotNowDeals,
    categoryDistributionDeals,
    watcherHealth,
    totalProducts,
    activeProducts,
    checkedLast24Hours,
    pendingDashboardActions,
    failedDashboardActions,
  ] = await Promise.all([
    todayBase(),
    pendingBase(),
    highScoringBase(),
    fetchHotNowDeals({ categoryFocus, limit: 12 }),
    applyCategoryFocus(client.from('deals').select('id, category, subcategory').gte('created_at', startOfToday.toISOString()).limit(300), categoryFocus),
    client.from('watcher_health').select('id, last_seen, status, candidates, last_error').order('id', { ascending: true }),
    client.from('product_catalog').select('asin', { count: 'exact', head: true }),
    client.from('product_catalog').select('asin', { count: 'exact', head: true }).eq('active', true),
    client
      .from('product_catalog')
      .select('asin', { count: 'exact', head: true })
      .gte('last_checked_at', last24Hours.toISOString()),
    client.from('dashboard_actions').select('id', { count: 'exact', head: true }).in('status', ['PENDING', 'PROCESSING']),
    client.from('dashboard_actions').select('id', { count: 'exact', head: true }).eq('status', 'FAILED'),
  ])

  if (todayDeals.error) throw todayDeals.error
  if (pendingDeals.error) throw pendingDeals.error
  if (recentHighScoringDeals.error) throw recentHighScoringDeals.error
  if (categoryDistributionDeals.error) throw categoryDistributionDeals.error
  if (watcherHealth.error) throw watcherHealth.error
  if (totalProducts.error) throw totalProducts.error
  if (activeProducts.error) throw activeProducts.error
  if (checkedLast24Hours.error) throw checkedLast24Hours.error
  if (pendingDashboardActions.error) throw pendingDashboardActions.error
  if (failedDashboardActions.error) throw failedDashboardActions.error

  return {
    todayDeals: await hydrateDealProductImages(client, todayDeals.data ?? []),
    pendingDeals: await hydrateDealProductImages(client, pendingDeals.data ?? []),
    recentHighScoringDeals: await hydrateDealProductImages(client, recentHighScoringDeals.data ?? []),
    hotNowDeals,
    categoryDistributionDeals: categoryDistributionDeals.data ?? [],
    watcherHealth: watcherHealth.data,
    productSummary: {
      totalTrackedProducts: totalProducts.count ?? 0,
      activeProducts: activeProducts.count ?? 0,
      checkedLast24Hours: checkedLast24Hours.count ?? 0,
      pendingDashboardActions: pendingDashboardActions.count ?? 0,
      failedDashboardActions: failedDashboardActions.count ?? 0,
    },
    counters: {
      detectedToday: todayDeals.count ?? todayDeals.data?.length ?? 0,
      pendingReview: pendingDeals.count ?? pendingDeals.data?.length ?? 0,
    },
  }
}

export async function fetchAllDeals(filters: DealsArchiveFilters = {}) {
  const client = requireSupabase()
  const pageSize = filters.pageSize ?? dealsPageSize
  const page = filters.page ?? 0
  const from = page * pageSize
  const to = from + pageSize - 1

  let query = client
    .from('deals')
    .select(dealListSelect, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.status && filters.status !== 'All Statuses') {
    const statusByLabel: Record<string, string[]> = {
      'Dashboard Only': ['REVIEW'],
      'Telegram Alerted': ['PENDING_APPROVAL'],
      Posted: ['POSTED'],
      Rejected: ['REJECTED'],
      'Legacy Pending': ['NEW', 'PENDING'],
    }
    query = query.in('status', statusByLabel[filters.status] ?? [filters.status])
  }
  if (filters.grade && filters.grade !== 'All Grades') query = query.eq('deal_grade', filters.grade)
  if (filters.source && filters.source !== 'All Sources') query = query.eq('source', filters.source)
  query = applyCategoryFocus(query, filters.categoryFocus)
  if (filters.minimumScore && filters.minimumScore > 0) query = query.gte('deal_score', filters.minimumScore)
  if (filters.startDate) query = query.gte('created_at', `${filters.startDate}T00:00:00`)
  if (filters.endDate) query = query.lte('created_at', `${filters.endDate}T23:59:59`)
  query = applyDealSearch(query, filters.search)

  const { data, error, count } = await query

  if (error) throw error
  return { deals: await hydrateDealProductImages(client, data ?? []), count: count ?? 0, hasMore: to + 1 < (count ?? 0) }
}

export async function fetchDealSources() {
  const client = requireSupabase()
  const { data, error } = await client.from('deals').select('source').not('source', 'is', null).order('source').limit(500)

  if (error) throw error
  return Array.from(new Set((data ?? []).map((deal) => deal.source).filter(Boolean))).sort()
}

export async function fetchDealsForSourceAnalytics() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('deals')
    .select('id,created_at,source,status,deal_score,source_trust')
    .order('created_at', { ascending: false })
    .limit(40)

  if (error) throw error
  return data
}

export async function fetchDealSightings(asin: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('deal_sightings')
    .select('id, created_at, asin, source, source_message_id, claimed_price, claimed_discount, amazon_url')
    .eq('asin', asin)
    .order('created_at', { ascending: false })
    .limit(25)

  if (error) throw error
  return data
}

export async function fetchDealActions(dealId: number) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('dashboard_actions')
    .select(dashboardActionSelect)
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) throw error
  return data
}

export async function fetchDealById(dealId: number) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('deals')
    .select(dealDetailSelect)
    .eq('id', dealId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function fetchDashboardActionById(actionId: number) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('dashboard_actions')
    .select(dashboardActionSelect)
    .eq('id', actionId)
    .single()

  if (error) throw error
  return data
}

export async function createDashboardAction(dealId: number, action: DashboardActionKind, requestedBy: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('dashboard_actions')
    .insert({
      deal_id: dealId,
      action,
      requested_by: requestedBy,
    })
    .select('id, deal_id, action, status, requested_by, note, result, created_at, processed_at')
    .single()

  if (error) throw error
  return data
}

export type OverviewData = Awaited<ReturnType<typeof fetchOverviewData>>
export async function fetchWatcherHealth() {
  const client = requireSupabase()
  const { data, error } = await client.from('watcher_health').select('id, last_seen, status, candidates, last_error').order('id', { ascending: true })

  if (error) throw error
  return data
}

export async function fetchDatabaseUsage() {
  const client = requireSupabase()
  const { data, error } = await client.rpc('get_database_usage')

  if (error) throw error

  const usage = Array.isArray(data) ? data[0] : data
  if (!usage) return null

  return {
    database_bytes: usage.database_bytes === null ? null : Number(usage.database_bytes),
    database_mb: usage.database_mb === null ? null : Number(usage.database_mb),
  } satisfies DatabaseUsage
}

export async function fetchProductCatalog() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('product_catalog')
    .select('asin, product_name, product_image, amazon_url, affiliate_url, last_seen_price, best_seen_price, last_checked_at, last_seen_on_deals_at, times_seen, active, created_at, updated_at')
    .order('last_seen_on_deals_at', { ascending: false, nullsFirst: false })
    .limit(40)

  if (error) throw error
  return data
}

export async function fetchProductCatalogDeals(filters: ProductCatalogFilters = {}) {
  const client = requireSupabase()
  const pageSize = filters.pageSize ?? productsPageSize
  const page = filters.page ?? 0
  const from = page * pageSize
  const to = from + pageSize - 1

  let query = client
    .from('deals')
    .select(dealListSelect, { count: 'exact' })

  query = applyCategoryFocus(query, filters.categoryFocus)
  query = applyDealSearch(query, filters.search)

  if (filters.sort === 'best_price') {
    query = query.order('verified_price', { ascending: true, nullsFirst: false }).order('claimed_price', { ascending: true, nullsFirst: false })
  } else if (filters.sort === 'history') {
    query = query.order('deal_score', { ascending: false, nullsFirst: false }).order('verified_at', { ascending: false, nullsFirst: false })
  } else if (filters.sort === 'name') {
    query = query.order('canonical_product_name', { ascending: true, nullsFirst: false })
  } else {
    query = query.order('verified_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
  }

  const { data, error, count } = await query.range(from, to)

  if (error) throw error
  return { deals: await hydrateDealProductImages(client, data ?? []), count: count ?? 0, hasMore: to + 1 < (count ?? 0) }
}
export type SourceDeal = Pick<Deal, 'id' | 'created_at' | 'source' | 'status' | 'deal_score' | 'source_trust'>
export type DealSightingsData = DealSighting[]
export type WatcherHealthData = WatcherHealth[]
export type DashboardActionData = DashboardAction[]
export type ProductCatalogData = ProductCatalogItem[]

















