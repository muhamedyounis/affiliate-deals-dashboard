import { ExternalLink, RotateCw, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActionHistory } from '../components/ActionHistory'
import { ActionStatus, actionStateLabel } from '../components/ActionStatus'
import { DashboardActionButtons } from '../components/DashboardActionButtons'
import { DealAge } from '../components/DealAge'
import { CategoryBadge, GradeBadge, StatusBadge } from '../components/DealBadges'
import { DealDetailsDrawer } from '../components/DealDetailsDrawer'
import { FreshnessStatus } from '../components/FreshnessStatus'
import { useCategoryFocus } from '../components/CategoryFocusContext'
import { DealScore, PriceIntelligence, ProductImageFrame, SectionHeader } from '../components/DesignPrimitives'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/StateViews'
import { useDashboardAction } from '../hooks/useDashboardAction'
import { hasSupabaseConfig } from '../lib/supabase'
import {
  displayProductName,
  fetchDealById,
  fetchReviewDealStreamBatch,
  fetchReviewModeCount,
  isDashboardOnlyStatus,
  isPostedStatus,
  isRejectedStatus,
  reviewModeBatchSize,
  type ReviewCursor,
  type ReviewQueueFilters,
} from '../services/deals'
import type { DashboardAction, DashboardActionKind, Deal } from '../types/database'
import { allCategoryFocusValue, focusLabel } from '../utils/categories'
import {
  currentDealPrice,
  familyKey,
  freshnessInfo,
  groupDealsByFamily,
  observedVariantSummary,
  qualityValue,
  confidenceValue,
  rankFamiliesForHotNow,
  variantLabel,
  verifiedTime,
  firstJsonItem,
  formatCurrency,
  summarizeJson,
  type ProductFamily,
} from '../utils/dealPresentation'

const swipeThreshold = 110
const reviewSessionStorageKey = 'affiliate-ops:review-mode-session:v2'
const prefetchThreshold = 5
const reviewStreamTimeoutMs = 15000
type ReviewSessionDecision = Exclude<DashboardActionKind, 'REGENERATE_CAPTION'> | 'SKIP'

function loadStoredReviewSession() {
  try {
    const stored = window.sessionStorage.getItem(reviewSessionStorageKey)
    if (!stored) return new Map<string, ReviewSessionDecision>()

    const entries = JSON.parse(stored)
    if (!Array.isArray(entries)) return new Map<string, ReviewSessionDecision>()

    return new Map(
      entries.filter((entry): entry is [string, ReviewSessionDecision] => (
        Array.isArray(entry)
        && typeof entry[0] === 'string'
        && (entry[1] === 'SKIP' || entry[1] === 'POST' || entry[1] === 'REJECT')
      )),
    )
  } catch {
    return new Map<string, ReviewSessionDecision>()
  }
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('a, button, input, textarea, select, [role="button"]'))
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs)
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timer))
  })
}

export function ReviewModePage() {
  const [index, setIndex] = useState(0)
  const [sessionDecisionByFamilyKey, setSessionDecisionByFamilyKey] = useState<Map<string, ReviewSessionDecision>>(loadStoredReviewSession)
  const [bufferFamilies, setBufferFamilies] = useState<ProductFamily[]>([])
  const [serverExhausted, setServerExhausted] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const [streamError, setStreamError] = useState<Error | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [eligibleCount, setEligibleCount] = useState<number | null>(null)
  const [reviewedThisSession, setReviewedThisSession] = useState(0)
  const [dealOverrides, setDealOverrides] = useState<Map<number, Deal>>(() => new Map())
  const [selectedVariantByFamilyKey, setSelectedVariantByFamilyKey] = useState<Map<string, number>>(() => new Map())
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [actionHistoryRefresh, setActionHistoryRefresh] = useState(0)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [dragX, setDragX] = useState(0)
  const [dragY, setDragY] = useState(0)
  const { focus, clearFocus } = useCategoryFocus()
  const startPoint = useRef<{ x: number; y: number } | null>(null)
  const mountedRef = useRef(true)
  const fetchingRef = useRef(false)
  const cursorRef = useRef<ReviewCursor | null>(null)
  const serverExhaustedRef = useRef(false)
  const sessionDecisionRef = useRef(sessionDecisionByFamilyKey)
  const filters = useMemo<ReviewQueueFilters>(() => ({
    freshness: '24h',
    sort: 'newest',
    pageSize: reviewModeBatchSize,
    categoryFocus: focus,
  }), [focus])
  const isConfigured = hasSupabaseConfig

  const sessionFamilies = useMemo(() => bufferFamilies.map((bufferFamily) => {
    const deals = bufferFamily.deals.map((loadedDeal) => dealOverrides.get(loadedDeal.id) ?? loadedDeal)
    const grouped = groupDealsByFamily(deals)
    return grouped[0] ?? bufferFamily
  }), [bufferFamilies, dealOverrides])
  const activeFamilies = useMemo(
    () => sessionFamilies.filter((family) => !sessionDecisionByFamilyKey.has(family.key)),
    [sessionFamilies, sessionDecisionByFamilyKey],
  )
  const family = activeFamilies[index] ?? null
  const deal = useMemo(() => {
    if (!family) return null
    const selectedId = selectedVariantByFamilyKey.get(family.key)
    return family.deals.find((candidate) => candidate.id === selectedId) ?? family.primary
  }, [family, selectedVariantByFamilyKey])
  const caption = deal
    ? deal.generated_caption || deal.caption || (isDashboardOnlyStatus(deal.status) ? 'Caption not generated yet' : '--')
    : '--'

  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(0, activeFamilies.length - 1)))
  }, [activeFamilies.length])

  useEffect(() => {
    setIndex(0)
  }, [focus])

  useEffect(() => {
    sessionDecisionRef.current = sessionDecisionByFamilyKey
    window.sessionStorage.setItem(reviewSessionStorageKey, JSON.stringify(Array.from(sessionDecisionByFamilyKey.entries())))
  }, [sessionDecisionByFamilyKey])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const appendDealsToBuffer = useCallback((incomingDeals: Deal[]) => {
    if (incomingDeals.length === 0) return
    setBufferFamilies((current) => {
      const nextByKey = new Map(current.map((existingFamily) => [existingFamily.key, existingFamily]))
      const blockedKeys = new Set(sessionDecisionRef.current.keys())
      const incomingFamilies = rankFamiliesForHotNow(groupDealsByFamily(incomingDeals))

      for (const incomingFamily of incomingFamilies) {
        if (blockedKeys.has(incomingFamily.key)) continue
        const existingFamily = nextByKey.get(incomingFamily.key)
        if (existingFamily) {
          const ids = new Set(existingFamily.deals.map((existingDeal) => existingDeal.id))
          const mergedDeals = [...existingFamily.deals, ...incomingFamily.deals.filter((candidate) => !ids.has(candidate.id))]
          nextByKey.set(incomingFamily.key, groupDealsByFamily(mergedDeals)[0])
        } else {
          nextByKey.set(incomingFamily.key, incomingFamily)
        }
      }

      return rankFamiliesForHotNow(Array.from(nextByKey.values()))
    })
  }, [])

  const fetchNextBatch = useCallback(async ({ reset = false } = {}) => {
    if (!hasSupabaseConfig || fetchingRef.current) return
    if (!reset && serverExhaustedRef.current) return

    fetchingRef.current = true
    setIsFetchingMore(true)
    setStreamError(null)

    try {
      const activeCursor = reset ? null : cursorRef.current
      const result = await withTimeout(
        fetchReviewDealStreamBatch(filters, activeCursor),
        reviewStreamTimeoutMs,
        'Review stream timed out. Check Supabase connectivity and try again.',
      )
      if (!mountedRef.current) return

      if (reset) {
        sessionDecisionRef.current = new Map()
        setBufferFamilies([])
        setSessionDecisionByFamilyKey(new Map())
        setDealOverrides(new Map())
        setSelectedVariantByFamilyKey(new Map())
        setReviewedThisSession(0)
        setIndex(0)
      }

      appendDealsToBuffer(result.deals)
      cursorRef.current = result.nextCursor
      serverExhaustedRef.current = result.exhausted || !result.nextCursor
      setServerExhausted(result.exhausted || !result.nextCursor)
      if (typeof result.count === 'number') setEligibleCount(result.count)
      setLastUpdated(new Date())
    } catch (caughtError) {
      if (mountedRef.current) setStreamError(caughtError instanceof Error ? caughtError : new Error('Unable to load review stream'))
    } finally {
      if (mountedRef.current) {
        setIsInitialLoading(false)
        setIsFetchingMore(false)
      }
      fetchingRef.current = false
    }
  }, [appendDealsToBuffer, filters])

  const refreshEligibleCount = useCallback(() => {
    if (!hasSupabaseConfig) return
    fetchReviewModeCount(filters)
      .then((count) => {
        if (mountedRef.current) setEligibleCount(count)
      })
      .catch(() => undefined)
  }, [filters])

  const markSessionDecision = useCallback((completedDeal: Deal, decision: ReviewSessionDecision) => {
    const next = new Map(sessionDecisionRef.current).set(familyKey(completedDeal), decision)
    sessionDecisionRef.current = next
    setSessionDecisionByFamilyKey(next)
    setReviewedThisSession((current) => current + 1)
  }, [])

  const removeDealFromBuffer = useCallback((completedDeal: Deal, decision: Exclude<ReviewSessionDecision, 'SKIP'>) => {
    let familyStillHasDeals = false
    setBufferFamilies((current) => current.flatMap((bufferFamily) => {
      if (bufferFamily.key !== familyKey(completedDeal)) return [bufferFamily]
      const remainingDeals = bufferFamily.deals.filter((candidate) => candidate.id !== completedDeal.id)
      familyStillHasDeals = remainingDeals.length > 0
      if (!familyStillHasDeals) return []
      return groupDealsByFamily(remainingDeals)
    }))
    setReviewedThisSession((current) => current + 1)
    if (!familyStillHasDeals) {
      const next = new Map(sessionDecisionRef.current).set(familyKey(completedDeal), decision)
      sessionDecisionRef.current = next
      setSessionDecisionByFamilyKey(next)
    }
  }, [])

  const skipCurrentDeal = useCallback(() => {
    if (!deal) return
    markSessionDecision(deal, 'SKIP')
  }, [deal, markSessionDecision])

  const refreshCounts = useCallback(() => {
    refreshEligibleCount()
    window.dispatchEvent(new Event('dashboard-counts-refresh'))
  }, [refreshEligibleCount])

  const syncProcessedDeal = useCallback((latestDeal: Deal) => {
    setDealOverrides((current) => new Map(current).set(latestDeal.id, latestDeal))

    if (isPostedStatus(latestDeal.status)) {
      removeDealFromBuffer(latestDeal, 'POST')
      refreshCounts()
      return true
    }

    if (isRejectedStatus(latestDeal.status)) {
      removeDealFromBuffer(latestDeal, 'REJECT')
      refreshCounts()
      return true
    }

    return false
  }, [refreshCounts, removeDealFromBuffer])

  useEffect(() => {
    cursorRef.current = null
    serverExhaustedRef.current = false
    setServerExhausted(false)
    setIsInitialLoading(true)
    void fetchNextBatch({ reset: true })
    refreshEligibleCount()
  }, [fetchNextBatch, refreshEligibleCount])

  useEffect(() => {
    if (activeFamilies.length <= prefetchThreshold && !serverExhausted && !isFetchingMore) {
      void fetchNextBatch()
    }
  }, [activeFamilies.length, fetchNextBatch, isFetchingMore, serverExhausted])



  const actionController = useDashboardAction({
    dealId: deal?.id ?? null,
    onDone: async (completedAction) => {
      setActionHistoryRefresh((current) => current + 1)
      if (!completedAction.deal_id) return

      const latestDeal = await fetchDealById(completedAction.deal_id)
      if (latestDeal) {
        setDealOverrides((current) => new Map(current).set(latestDeal.id, latestDeal))
        if (completedAction.action === 'POST' || completedAction.action === 'REJECT') {
          syncProcessedDeal(latestDeal)
        }
      }

      setActionNotice(
        completedAction.action === 'POST'
          ? 'Deal posted'
          : completedAction.action === 'REJECT'
            ? 'Deal rejected'
            : 'Caption regenerated',
      )
      refreshCounts()
    },
    onFailed: async (failedAction) => {
      setActionHistoryRefresh((current) => current + 1)
      setActionNotice(null)
      if (failedAction.deal_id) {
        const latestDeal = await fetchDealById(failedAction.deal_id)
        if (latestDeal && mountedRef.current) {
          setDealOverrides((current) => new Map(current).set(latestDeal.id, latestDeal))
        }
      }
      refreshCounts()
    },
    onTimeout: () => {
      setActionNotice(null)
      setActionHistoryRefresh((current) => current + 1)
    },
  })
  const isActionBusy = actionController.state === 'submitting' || actionController.state === 'queued' || actionController.state === 'processing'
  const displayedPendingAction = actionController.action?.deal_id === deal?.id ? actionController.action : null

  useEffect(() => {
    if (!isConfigured) return undefined
    const timer = window.setInterval(() => {
      refreshEligibleCount()
      if (!deal || isActionBusy) return
      fetchDealById(deal.id)
        .then((latestDeal) => {
          if (latestDeal && mountedRef.current) syncProcessedDeal(latestDeal)
        })
        .catch(() => undefined)
    }, 30000)

    function onVisible() {
      if (document.visibilityState !== 'visible') return
      refreshEligibleCount()
      if (activeFamilies.length <= prefetchThreshold) void fetchNextBatch()
    }

    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [activeFamilies.length, deal, fetchNextBatch, isActionBusy, isConfigured, refreshEligibleCount, syncProcessedDeal])

  const handleActionCreated = useCallback((_action?: DashboardActionKind, createdAction?: DashboardAction) => {
    if (!createdAction) return
    setActionNotice(
      createdAction.action === 'POST'
        ? 'Deal queued for posting'
        : createdAction.action === 'REJECT'
          ? 'Deal queued for rejection'
          : 'Caption regeneration queued',
    )
    setActionHistoryRefresh((current) => current + 1)
  }, [])

  useEffect(() => {
    if (!deal) {
      return
    }

    let cancelled = false

    fetchDealById(deal.id)
      .then((latestDeal) => {
        if (cancelled || !mountedRef.current) return
        if (latestDeal) syncProcessedDeal(latestDeal)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [deal?.id, syncProcessedDeal])

  useEffect(() => {
    if (!actionNotice) return
    const timer = window.setTimeout(() => setActionNotice(null), 1800)
    return () => window.clearTimeout(timer)
  }, [actionNotice])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target) || !deal) return
      const key = event.key.toLowerCase()
      if (key === 's') skipCurrentDeal()
      if (isActionBusy) return
      if (key === 'g') document.querySelector<HTMLButtonElement>('[data-review-action="REGENERATE_CAPTION"]')?.click()
      if (key === 'p') document.querySelector<HTMLButtonElement>('[data-review-action="POST"]')?.click()
      if (key === 'r') document.querySelector<HTMLButtonElement>('[data-review-action="REJECT"]')?.click()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [deal, isActionBusy, skipCurrentDeal])

  function onPointerDown(event: React.PointerEvent) {
    if (isInteractiveTarget(event.target)) return
    startPoint.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!startPoint.current) return
    setDragX(event.clientX - startPoint.current.x)
    setDragY(event.clientY - startPoint.current.y)
  }

  function onPointerUp() {
    if (!startPoint.current) return

    if (!displayedPendingAction && !isActionBusy && Math.abs(dragX) > swipeThreshold && Math.abs(dragX) > Math.abs(dragY) * 1.4) {
      document.querySelector<HTMLButtonElement>(dragX > 0 ? '[data-review-action="POST"]' : '[data-review-action="REJECT"]')?.click()
    } else if (dragY < -swipeThreshold && Math.abs(dragY) > Math.abs(dragX) * 1.4) {
      skipCurrentDeal()
    }
    startPoint.current = null
    setDragX(0)
    setDragY(0)
  }

  const reviewed = reviewedThisSession
  const skipped = Array.from(sessionDecisionByFamilyKey.values()).filter((decision) => decision === 'SKIP').length
  const total = eligibleCount ?? 0
  const hiddenDuplicates = Math.max(0, bufferFamilies.reduce((sum, bufferFamily) => sum + bufferFamily.deals.length, 0) - bufferFamilies.length)
  const progress = total > 0 ? Math.min(100, (reviewed / total) * 100) : 0
  const isFindingMore = !deal && isFetchingMore && !serverExhausted
  const observedSummary = family ? observedVariantSummary(family) : '1 observed variant'
  const resetSession = useCallback(() => {
    cursorRef.current = null
    serverExhaustedRef.current = false
    setServerExhausted(false)
    setIsInitialLoading(true)
    void fetchNextBatch({ reset: true })
  }, [fetchNextBatch])

  return (
    <>
      <PageHeader
        title="Review Mode"
        description="Focused one-by-one decisions for unique products. Skip removes the product from this session."
      />

      {!isConfigured ? <EmptyState title="Supabase is not configured" message="Add Supabase environment variables to load review mode." /> : null}
      {isInitialLoading && isConfigured ? <LoadingSkeleton rows={3} /> : null}
      {streamError ? <ErrorState message={streamError.message} /> : null}

      {!isInitialLoading && !streamError && isConfigured && isFindingMore ? (
        <EmptyState title="Finding more deals..." message="The local review buffer is empty while the next server batch is loading." />
      ) : null}

      {!isInitialLoading && !streamError && isConfigured && !deal && serverExhausted ? (
        <EmptyState title={focus.category === allCategoryFocusValue ? 'No active deals' : 'No fresh deals match the current filter'} message="The server confirmed there are no more eligible review candidates for this scope." />
      ) : null}

      {deal ? (
        <section
          className="relative pb-24 transition xl:pb-0"
          style={{ transform: dragX || dragY ? `translate(${dragX * 0.12}px, ${dragY * 0.08}px)` : undefined }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="mb-4 rounded-lg border border-white/[0.09] bg-[#0b1317]/90 p-4 shadow-xl shadow-black/12">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-100">
                  Reviewing: {focus.category === allCategoryFocusValue ? 'All Categories' : focusLabel(focus)}
                </p>
                <p className="font-mono text-2xl font-semibold tabular-nums text-white">{activeFamilies.length} families remaining</p>
                <p className="mt-1 text-xs text-slate-500">
                  Reviewed this session: {reviewed}
                  {skipped ? `, ${skipped} skipped` : ''}
                  {hiddenDuplicates ? `, ${hiddenDuplicates} child variants grouped` : ''}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-white/[0.08] bg-black/20 px-2.5 py-1.5 font-mono text-xs text-slate-300">{eligibleCount ?? '--'} eligible</span>
                  <span className="rounded-md border border-white/[0.08] bg-black/20 px-2.5 py-1.5 font-mono text-xs text-slate-300">{activeFamilies.length} loaded</span>
                  <span className="rounded-md border border-white/[0.08] bg-black/20 px-2.5 py-1.5 text-xs text-slate-300">More deals: {serverExhausted ? 'no' : 'yes'}</span>
                  <FreshnessStatus lastUpdated={lastUpdated} isRefreshing={isFetchingMore} error={streamError} />
                </div>
              </div>
              <div className="flex w-full max-w-sm items-center gap-3">
                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                  <div className="h-full rounded-full bg-cyan-300 transition-[width]" style={{ width: `${progress}%` }} />
                </div>
                {focus.category !== allCategoryFocusValue ? (
                <button type="button" onClick={clearFocus} className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-cyan-100">
                    All Categories
                  </button>
                ) : null}
                {reviewed ? (
                  <button type="button" onClick={resetSession} className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-cyan-100">
                    Reset session
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-24 flex justify-between px-6 py-4 text-xs font-semibold uppercase tracking-wide">
            <span className={dragX < -40 ? 'text-rose-200' : 'text-transparent'}>Reject</span>
            <span className={dragX > 40 ? 'text-emerald-200' : 'text-transparent'}>Post</span>
          </div>

          <div className="grid gap-5 xl:grid-cols-[30fr_45fr_25fr]">
            <div className="min-w-0 rounded-lg border border-white/[0.09] bg-[#0b1317]/90 p-4 shadow-xl shadow-black/12">
              <ProductImageFrame src={deal.product_image} alt={displayProductName(deal)} />
              <div className="mt-4">
                <h2 className="text-lg font-semibold leading-tight text-white">{family?.title ?? displayProductName(deal)}</h2>
                <p className="mt-2 text-sm font-medium text-cyan-100">{observedSummary}</p>
                <div className="mt-3 rounded-lg border border-white/[0.07] bg-black/18 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Selected child variant for actions</p>
                  <p className="mt-1 text-sm text-white">{variantLabel(deal) || 'Unlabeled variant'}</p>
                  <p className="mt-1 font-mono text-xl font-semibold text-white">{formatCurrency(currentDealPrice(deal))}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Verified {freshnessInfo(verifiedTime(deal)).age} / ASIN {deal.asin || '--'}
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <DealAge createdAt={verifiedTime(deal)} prefix="Verified" />
                  {deal.asin ? <span className="font-mono">{deal.asin}</span> : null}
                  {deal.source ? <span>{deal.source}</span> : null}
                </div>
                {deal.amazon_url ? (
                  <a href={deal.amazon_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm font-semibold text-cyan-100 transition-colors hover:bg-white/[0.07]">
                    Amazon link <ExternalLink size={15} aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            </div>

            <div className="min-w-0 rounded-lg border border-white/[0.09] bg-[#0b1317]/90 p-5 shadow-xl shadow-black/12">
              <div className="grid grid-cols-2 gap-6 border-b border-white/[0.07] pb-5">
                <DealScore label="Quality" value={qualityValue(deal)} grade={deal.deal_grade} />
                <DealScore label="Confidence" value={confidenceValue(deal)} grade={confidenceValue(deal) && confidenceValue(deal)! >= 70 ? 'GOOD' : confidenceValue(deal) && confidenceValue(deal)! < 45 ? 'LOW' : 'REVIEW'} />
              </div>

              <div className="border-b border-white/[0.07] py-5">
                <PriceIntelligence deal={deal} />
              </div>

              <div className="grid gap-5 border-b border-white/[0.07] py-5 md:grid-cols-2">
                <div>
                  <SectionHeader title="Evidence" />
                  <ul className="mt-3 space-y-2 text-sm text-slate-300">
                    <li className="flex justify-between gap-3"><span className="text-slate-500">Source trust</span><span className="font-mono text-white">{confidenceValue(deal) ?? '--'}</span></li>
                    <li className="flex justify-between gap-3"><span className="text-slate-500">Source</span><span className="truncate text-white">{deal.source || 'Unknown'}</span></li>
                    <li className="flex justify-between gap-3"><span className="text-slate-500">ASIN</span><span className="font-mono text-white">{deal.asin || '--'}</span></li>
                  </ul>
                </div>
                <div>
                  <SectionHeader title="Risks" />
                  <div className="mt-3 space-y-2 text-sm text-amber-100/90">
                    {firstJsonItem(deal.risk_flags) ? (
                      <p className="flex gap-2"><TriangleAlert className="mt-0.5 shrink-0" size={15} /> {firstJsonItem(deal.risk_flags)}</p>
                    ) : (
                      <p className="flex gap-2 text-slate-400"><ShieldCheck className="mt-0.5 shrink-0" size={15} /> No flagged risk signals</p>
                    )}
                    <p className="line-clamp-2 text-xs text-slate-500">{summarizeJson(deal.score_reasons)}</p>
                  </div>
                </div>
              </div>

              <div className="pt-5">
                <SectionHeader title="Caption Preview" action={<button className="text-xs font-semibold text-cyan-100 hover:text-cyan-50" type="button" onClick={() => setSelectedDeal(deal)}>View full caption</button>} />
                <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-slate-300">{caption}</p>
              </div>
            </div>

            <aside className="sticky top-24 self-start rounded-lg border border-white/[0.1] bg-[#0b1317]/95 p-4 shadow-2xl shadow-black/20">
              <div className="border-b border-white/[0.07] pb-4">
                <p className="font-mono text-sm font-semibold text-white">DEAL #{deal.id}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={deal.status} />
                  <GradeBadge grade={deal.deal_grade} />
                  <CategoryBadge deal={deal} />
                </div>
                <div className="mt-3 text-sm text-slate-400">
                  <DealAge createdAt={deal.created_at} />
                </div>
              </div>

              {family && family.deals.length > 1 ? (
                <div className="mt-4 border-b border-white/[0.07] pb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">View all variants</p>
                  <div className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1">
                    {family.deals.map((variant) => (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => {
                          setSelectedVariantByFamilyKey((current) => new Map(current).set(family.key, variant.id))
                          actionController.reset()
                          setActionNotice(null)
                        }}
                        className={[
                          'w-full rounded-lg border border-white/[0.06] px-3 py-2 text-left text-xs transition-colors hover:bg-white/[0.055]',
                          variant.id === deal.id ? 'bg-cyan-300/[0.08] text-cyan-100' : 'bg-white/[0.03] text-slate-300',
                        ].join(' ')}
                      >
                        <span className="block truncate font-medium">{variantLabel(variant) || 'Unlabeled variant'}</span>
                        <span className="mt-1 flex items-center justify-between gap-2 font-mono text-slate-500">
                          <span>{variant.asin || '--'}</span>
                          <span className="text-white">{formatCurrency(currentDealPrice(variant))}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                {actionController.state !== 'idle' && actionController.state !== 'success' ? (
                  <ActionStatus
                    deal={deal}
                    action={displayedPendingAction}
                    state={actionController.state}
                    error={actionController.error}
                    onCheckAgain={() => void actionController.checkAgain()}
                    onReviewDeal={() => setSelectedDeal(deal)}
                  />
                ) : null}
                {actionController.state === 'success' ? (
                  <div className="inline-flex min-h-12 w-full items-center gap-3 rounded-lg border border-emerald-300/15 bg-emerald-400/10 px-4 text-sm font-semibold text-emerald-100" aria-live="polite">
                    {actionStateLabel(actionController.actionType, actionController.state)}
                  </div>
                ) : null}
                {actionNotice ? (
                  <div className="rounded-lg border border-white/[0.07] bg-white/[0.045] px-3 py-2 text-xs font-semibold text-slate-200" aria-live="polite">
                    {actionNotice}
                  </div>
                ) : null}
                <DashboardActionButtons deal={deal} pendingAction={displayedPendingAction} emphasis="review" actions={['POST']} onActionCreated={handleActionCreated} controller={actionController} onReviewDeal={() => setSelectedDeal(deal)} />
                <DashboardActionButtons deal={deal} pendingAction={displayedPendingAction} emphasis="review" actions={['REJECT']} onActionCreated={handleActionCreated} controller={actionController} onReviewDeal={() => setSelectedDeal(deal)} />
                <button type="button" onClick={skipCurrentDeal} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.035] px-5 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/[0.065]">
                  <RotateCw size={16} aria-hidden="true" />
                  {displayedPendingAction ? 'Move on' : 'Skip'}
                </button>
                <DashboardActionButtons deal={deal} pendingAction={displayedPendingAction} emphasis="review" actions={['REGENERATE_CAPTION']} onActionCreated={handleActionCreated} controller={actionController} onReviewDeal={() => setSelectedDeal(deal)} />
              </div>

              <div className="mt-5">
                <ActionHistory dealId={deal.id} refreshKey={actionHistoryRefresh} />
              </div>
            </aside>
          </div>

          <div className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 gap-2 border-t border-white/[0.08] bg-[#05090c]/95 p-3 shadow-2xl shadow-black/30 backdrop-blur xl:hidden">
            <DashboardActionButtons deal={deal} pendingAction={displayedPendingAction} emphasis="review" actions={['REJECT']} onActionCreated={handleActionCreated} controller={actionController} />
            <button type="button" onClick={skipCurrentDeal} className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/10 px-4 text-sm font-semibold text-slate-200 hover:bg-white/5">{displayedPendingAction ? 'Move on' : 'Skip'}</button>
            <DashboardActionButtons deal={deal} pendingAction={displayedPendingAction} emphasis="review" actions={['POST']} onActionCreated={handleActionCreated} controller={actionController} />
          </div>

          <DealDetailsDrawer deal={selectedDeal} onClose={() => setSelectedDeal(null)} onDealUpdated={setSelectedDeal} />
        </section>
      ) : null}
    </>
  )
}

