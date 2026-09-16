import { ChevronDown, ChevronRight, ExternalLink, Layers, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { DashboardAction, Deal } from '../types/database'
import {
  availabilityLabel,
  currentDealPrice,
  freshnessInfo,
  historySignal,
  observedVariantSummary,
  qualityValue,
  confidenceValue,
  variantLabel,
  verifiedTime,
  type ProductFamily,
} from '../utils/dealPresentation'
import { formatCurrency } from '../utils/dealPresentation'
import { DashboardActionButtons } from './DashboardActionButtons'
import { ActionHistory } from './ActionHistory'
import { CategoryBadge, GradeBadge, StatusBadge } from './DealBadges'
import { ProductImageFrame, ScoreMeter } from './DesignPrimitives'

type ProductFamilyCardProps = {
  family: ProductFamily
  pendingActionByDealId?: Map<number | null, DashboardAction>
  onOpen: (deal: Deal) => void
  onActionCreated?: () => void
  compact?: boolean
}

function FreshnessPill({ deal }: { deal: Deal }) {
  const freshness = freshnessInfo(verifiedTime(deal))
  const tone = freshness.label === 'LIVE'
    ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'
    : freshness.label === 'FRESH'
      ? 'border-cyan-300/20 bg-cyan-400/10 text-cyan-100'
      : freshness.label === 'AGING'
        ? 'border-amber-300/20 bg-amber-400/10 text-amber-100'
        : 'border-slate-300/18 bg-slate-400/10 text-slate-300'

  return (
    <span className={`inline-flex min-h-7 items-center rounded-md border px-2 text-[11px] font-semibold ${tone}`}>
      {freshness.label} <span className="ml-1 font-normal opacity-80">Verified {freshness.age}</span>
    </span>
  )
}

export function ProductFamilyCard({
  family,
  pendingActionByDealId,
  onOpen,
  onActionCreated,
  compact = false,
}: ProductFamilyCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const primary = family.primary
  const history = historySignal(primary)
  const variants = useMemo(() => family.deals, [family.deals])

  return (
    <article className="overflow-hidden rounded-lg border border-white/[0.09] bg-[#0b1317]/88 shadow-xl shadow-black/12 transition-colors hover:border-white/[0.15] hover:bg-[#0f1a20]">
      <div className="grid gap-4 p-3 text-sm text-slate-300 lg:grid-cols-[52px_minmax(260px,1.7fr)_112px_130px_112px_112px_156px_178px] lg:items-center">
        <ProductImageFrame src={primary.verified_image ?? primary.product_image} alt={family.title} size="small" />

        <button type="button" className="min-w-0 rounded-md text-left transition-colors hover:text-white" onClick={() => onOpen(primary)}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 truncate font-semibold text-white">{family.title}</h3>
            <CategoryBadge deal={primary} />
            <GradeBadge grade={primary.deal_grade} />
          </div>
          <p className="mt-1 truncate text-xs text-slate-400">
            {variantLabel(primary) ? `Best variant: ${variantLabel(primary)}` : 'Best observed child ASIN'}
            <span className="mx-1 text-slate-600">/</span>
            <span className="font-mono">{primary.asin || '--'}</span>
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-400">
            <Layers size={13} aria-hidden="true" />
            {observedVariantSummary(family)}
          </p>
        </button>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 lg:hidden">Best price</p>
          <p className="font-mono font-bold tabular-nums text-white">{formatCurrency(currentDealPrice(primary))}</p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 lg:hidden">History</p>
          {history.hasEnoughHistory && typeof history.percentBelow30d === 'number' && history.percentBelow30d < 0 ? (
            <p className="font-mono font-semibold text-emerald-200">{Math.abs(Math.round(history.percentBelow30d))}% below 30d</p>
          ) : (
            <p className="font-mono text-slate-500">History building</p>
          )}
          {primary.is_30d_low ? <p className="mt-1 text-[11px] font-semibold text-emerald-100">New 30-day low</p> : null}
        </div>

        <ScoreMeter label="Quality" value={qualityValue(primary)} tone={qualityValue(primary) && qualityValue(primary)! >= 70 ? 'good' : 'warn'} />

        <ScoreMeter label="Confidence" value={confidenceValue(primary)} tone={confidenceValue(primary) && confidenceValue(primary)! >= 70 ? 'good' : 'info'} />

        <div className="flex flex-wrap items-center gap-2">
          <FreshnessPill deal={primary} />
          <StatusBadge status={primary.status} />
        </div>

        <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
          {primary.amazon_url ? (
            <a
              href={primary.amazon_url}
              target="_blank"
              rel="noreferrer"
              className="grid size-10 place-items-center rounded-lg border border-white/[0.08] text-slate-400 transition-colors hover:bg-white/[0.055] hover:text-cyan-100"
              aria-label="Open Amazon"
              title="Open Amazon"
            >
              <ExternalLink size={15} aria-hidden="true" />
            </a>
          ) : null}
          {!compact ? (
            <DashboardActionButtons
              deal={primary}
              pendingAction={pendingActionByDealId?.get(primary.id) ?? null}
              compact
              onActionCreated={onActionCreated}
            />
          ) : null}
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 text-xs font-semibold text-cyan-100 transition-colors hover:bg-white/[0.055]"
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
            Variants
          </button>
        </div>
      </div>

      {isExpanded ? (
        <div className="border-t border-white/[0.08] px-3 pb-3">
          <div className="mt-3 divide-y divide-white/[0.06] overflow-hidden rounded-lg border border-white/[0.07] bg-black/18">
            {variants.map((deal) => (
              <button
                key={deal.id}
                type="button"
                onClick={() => onOpen(deal)}
                className={[
                  'grid w-full gap-2 px-3 py-2.5 text-left text-xs text-slate-300 transition-colors hover:bg-white/[0.045] md:grid-cols-[minmax(180px,1.5fr)_100px_100px_90px_90px_120px_1fr] md:items-center',
                  deal.id === primary.id ? 'bg-cyan-300/[0.055]' : '',
                ].join(' ')}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1 font-medium text-white">
                    {deal.id === primary.id ? <Sparkles size={13} aria-hidden="true" /> : null}
                    <span className="truncate">{variantLabel(deal) || 'Unlabeled variant'}</span>
                  </span>
                  <span className="mt-1 block font-mono text-slate-500">{deal.asin || '--'}</span>
                </span>
                <span className="font-mono text-white">{formatCurrency(currentDealPrice(deal))}</span>
                <span className="font-mono">{qualityValue(deal) ?? '--'} quality</span>
                <span className="font-mono">{confidenceValue(deal) ?? '--'} conf</span>
                <span>{freshnessInfo(verifiedTime(deal)).label}</span>
                <span className="truncate">{availabilityLabel(deal)}</span>
                <span className="truncate text-slate-500">{deal.id === primary.id ? 'Current best variant' : 'Observed child ASIN'}</span>
              </button>
            ))}
          </div>
          <div className="mt-3">
            <ActionHistory dealId={primary.id} />
          </div>
        </div>
      ) : null}
    </article>
  )
}
