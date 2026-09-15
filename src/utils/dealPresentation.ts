import type { Deal, Json } from '../types/database'

export function formatCurrency(value: number | null) {
  if (value === null) return '--'
  return new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 }).format(value)
}

export function formatPercent(value: number | null) {
  if (value === null) return '--'
  return `${value}%`
}

export function displayDealName(deal: Deal) {
  return (
    deal.canonical_product_name?.trim()
    || deal.verified_title?.trim()
    || deal.product_name?.trim()
    || deal.product_name_guess?.trim()
    || deal.asin?.trim()
    || 'Unknown product'
  )
}

export function familyKey(deal: Deal) {
  return (deal.product_family_key || deal.parent_asin || deal.asin || `deal:${deal.id}`).trim().toUpperCase()
}

export function variantLabel(deal: Deal) {
  return deal.variant_label?.trim() || null
}

export function currentDealPrice(deal: Deal) {
  return deal.verified_price ?? deal.product_last_seen_price ?? deal.claimed_price
}

export function qualityValue(deal: Deal) {
  return deal.quality_score ?? deal.deal_score
}

export function confidenceValue(deal: Deal) {
  return deal.confidence_score ?? deal.source_trust
}

export function verifiedTime(deal: Deal) {
  return deal.verified_at ?? deal.product_last_checked_at ?? deal.created_at
}

export function observedVariantSummary(family: ProductFamily) {
  const amazonVariantCount = Math.max(...family.deals.map((deal) => deal.variant_count ?? 0), 0)
  const observed = family.deals.length

  if (amazonVariantCount > observed) return `${amazonVariantCount} Amazon variants / ${observed} observed`
  if (amazonVariantCount > 1) return `${amazonVariantCount} variants`
  if (observed > 1) return `${observed} observed variants`
  return variantLabel(family.primary) ? '1 observed variant' : 'Single product'
}

export function availabilityLabel(deal: Deal) {
  return deal.verified_availability?.trim() || 'Availability unknown'
}

export function isDealAvailable(deal: Deal) {
  const availability = deal.verified_availability?.toLowerCase()
  if (!availability) return true
  return !['out of stock', 'unavailable', 'currently unavailable', 'not available'].some((term) => availability.includes(term))
}

export function freshnessInfo(value: string | null) {
  if (!value) return { label: 'Unverified', age: 'Unknown', rank: 0, ageMs: Number.POSITIVE_INFINITY }

  const ageMs = Math.max(0, Date.now() - new Date(value).getTime())
  const seconds = Math.floor(ageMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  const age = seconds < 60 ? `${seconds}s ago` : minutes < 60 ? `${minutes}m ago` : hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`
  if (minutes < 5) return { label: 'LIVE', age, rank: 100, ageMs }
  if (minutes < 30) return { label: 'FRESH', age, rank: 82, ageMs }
  if (minutes < 120) return { label: 'AGING', age, rank: 45, ageMs }
  return { label: 'STALE', age, rank: 12, ageMs }
}

export function verificationStrength(deal: Deal) {
  if (deal.live_verification_ok === true) return 100
  if (deal.verification_status?.toUpperCase().includes('OK')) return 90
  if (deal.verified_price !== null && deal.verified_price !== undefined && deal.verified_at) return 80
  if (deal.verified_at) return 55
  return 20
}

export function summarizeJson(value: Json | null, fallback = 'None') {
  if (value === null) return fallback
  if (Array.isArray(value)) return value.length ? value.map(String).join(', ') : fallback
  if (typeof value === 'object') return Object.keys(value).length ? JSON.stringify(value) : fallback
  return String(value)
}

export function firstJsonItem(value: Json | null) {
  if (Array.isArray(value)) return value.length ? String(value[0]) : null
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const firstKey = Object.keys(value)[0]
    return firstKey ? `${firstKey}: ${String(value[firstKey])}` : null
  }
  return null
}

function normalizedGrade(grade: string | null | undefined) {
  const normalized = grade?.trim().toUpperCase()
  if (normalized === 'HOT' || normalized === 'GOOD' || normalized === 'REVIEW' || normalized === 'LOW') return normalized
  return 'REVIEW'
}

export function realObservedDrop(deal: Deal) {
  const currentPrice = currentDealPrice(deal)
  if (deal.price === null || currentPrice === null || deal.price <= currentPrice) return null
  const amount = deal.price - currentPrice
  const percent = Math.round((amount / deal.price) * 100)
  return { amount, percent }
}

function numericScore(value: number | null | undefined, max = 100) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.max(0, Math.min(max, value))
}

export function historySignal(deal: Deal) {
  const currentPrice = currentDealPrice(deal)
  const median30 = deal.history_median_30d ?? null
  const percentBelow30d = typeof deal.current_vs_30d_median_percent === 'number'
    ? deal.current_vs_30d_median_percent
    : currentPrice !== null && median30 !== null && median30 > 0
      ? Math.round(((currentPrice - median30) / median30) * 100)
      : null
  const hasEnoughHistory = deal.history_status ? !deal.history_status.toUpperCase().includes('INSUFFICIENT') : Boolean(median30)

  if (!hasEnoughHistory) return { hasEnoughHistory: false, percentBelow30d: null, median30, savingVsMedian: null }

  return {
    hasEnoughHistory: true,
    percentBelow30d,
    median30,
    savingVsMedian: currentPrice !== null && median30 !== null ? Math.max(0, median30 - currentPrice) : null,
  }
}

export function calculateHotScore(deal: Deal) {
  const history = historySignal(deal)
  const historicalValue = history.hasEnoughHistory && typeof history.percentBelow30d === 'number'
    ? numericScore(Math.abs(Math.min(0, history.percentBelow30d)) * 2.5)
    : 0
  const observedDropPercent = deal.amazon_price_drop_percent ?? realObservedDrop(deal)?.percent ?? 0
  const freshness = freshnessInfo(verifiedTime(deal))
  const qualityConfidence = ((qualityValue(deal) ?? 0) + (confidenceValue(deal) ?? 0)) / 2
  const availability = isDealAvailable(deal) ? 100 : 0

  return Math.round(
    historicalValue * 0.38
    + numericScore(observedDropPercent) * 0.2
    + freshness.rank * 0.15
    + (deal.is_30d_low ? 100 : 0) * 0.12
    + numericScore(qualityConfidence) * 0.1
    + availability * 0.05,
  )
}

function compareBestVariant(left: Deal, right: Deal) {
  const leftLive = verificationStrength(left)
  const rightLive = verificationStrength(right)
  if (leftLive !== rightLive) return rightLive - leftLive

  const leftQuality = qualityValue(left) ?? -1
  const rightQuality = qualityValue(right) ?? -1
  if (leftQuality !== rightQuality) return rightQuality - leftQuality

  const leftConfidence = confidenceValue(left) ?? -1
  const rightConfidence = confidenceValue(right) ?? -1
  if (leftConfidence !== rightConfidence) return rightConfidence - leftConfidence

  const leftDrop = dealDropStrength(left)
  const rightDrop = dealDropStrength(right)
  if (leftDrop !== rightDrop) return rightDrop - leftDrop

  const leftPrice = currentDealPrice(left) ?? Number.MAX_SAFE_INTEGER
  const rightPrice = currentDealPrice(right) ?? Number.MAX_SAFE_INTEGER
  if (leftPrice !== rightPrice) return leftPrice - rightPrice

  return new Date(verifiedTime(right) ?? right.created_at ?? 0).getTime() - new Date(verifiedTime(left) ?? left.created_at ?? 0).getTime()
}

function dealDropStrength(deal: Deal) {
  return deal.amazon_price_drop_percent ?? realObservedDrop(deal)?.percent ?? Math.abs(Math.min(0, deal.current_vs_30d_median_percent ?? 0))
}

export type ProductFamily = {
  key: string
  title: string
  primary: Deal
  deals: Deal[]
  hotScore: number
}

export function groupDealsByFamily(deals: Deal[]) {
  const familiesByKey = new Map<string, Deal[]>()
  for (const deal of deals) {
    const key = familyKey(deal)
    familiesByKey.set(key, [...(familiesByKey.get(key) ?? []), deal])
  }

  return Array.from(familiesByKey.entries()).map(([key, familyDeals]) => {
    const sortedDeals = [...familyDeals].sort(compareBestVariant)
    const primary = sortedDeals[0]
    return {
      key,
      title: displayDealName(primary),
      primary,
      deals: sortedDeals,
      hotScore: calculateHotScore(primary),
    } satisfies ProductFamily
  })
}

export function rankFamiliesForHotNow(families: ProductFamily[]) {
  return [...families].sort((left, right) => {
    if (left.hotScore !== right.hotScore) return right.hotScore - left.hotScore
    return compareBestVariant(left.primary, right.primary)
  })
}

export function priorityClass(deal: Deal) {
  const createdAt = deal.created_at ? new Date(deal.created_at).getTime() : 0
  const ageHours = createdAt ? (Date.now() - createdAt) / 36e5 : 999
  const grade = normalizedGrade(deal.deal_grade)

  if (ageHours <= 6 && grade === 'HOT') return 'deal-priority-high'
  if (ageHours <= 24 && (grade === 'HOT' || grade === 'GOOD')) return 'deal-priority-medium'
  if (ageHours > 72 || grade === 'LOW') return 'deal-priority-low'
  return 'deal-priority-normal'
}
