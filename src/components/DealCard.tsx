import { ArrowRight, ExternalLink, TriangleAlert } from 'lucide-react'
import { displayProductName } from '../services/deals'
import type { DashboardAction, Deal } from '../types/database'
import { firstJsonItem, formatCurrency, priorityClass, realObservedDrop } from '../utils/dealPresentation'
import { DashboardActionButtons } from './DashboardActionButtons'
import { DealAge } from './DealAge'
import { CategoryBadge, GradeBadge, StatusBadge } from './DealBadges'
import { ProductImageFrame, ScoreMeter } from './DesignPrimitives'

type DealCardProps = {
  deal: Deal
  pendingAction?: DashboardAction | null
  onOpen: (deal: Deal) => void
  onActionCreated?: () => void
}

export function DealCard({ deal, pendingAction = null, onOpen, onActionCreated }: DealCardProps) {
  const risk = firstJsonItem(deal.risk_flags)
  const drop = realObservedDrop(deal)

  return (
    <article
      className={`group rounded-lg border border-white/[0.09] bg-[#0b1317]/88 shadow-xl shadow-black/12 transition-colors duration-200 hover:border-white/[0.15] hover:bg-[#0f1a20] ${priorityClass(deal)}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(deal)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen(deal)
      }}
    >
      <div className="grid gap-4 px-3 py-3 text-sm text-slate-300 lg:grid-cols-[52px_minmax(260px,1.7fr)_112px_112px_112px_112px_120px_178px] lg:items-center">
        <ProductImageFrame src={deal.product_image} alt={displayProductName(deal)} size="small" />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 truncate font-semibold text-white">{displayProductName(deal)}</h3>
            <CategoryBadge deal={deal} />
            {risk ? <TriangleAlert className="shrink-0 text-amber-200" size={14} aria-label={risk} /> : null}
          </div>
          <p className="mt-1 truncate text-xs text-slate-500">
            <DealAge createdAt={deal.created_at} compact /> <span className="mx-1 text-slate-700">/</span>
            {deal.source || 'Unknown source'} {deal.asin ? <span className="font-mono">/ {deal.asin}</span> : null}
          </p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 lg:hidden">Price</p>
          <p className="font-mono font-bold tabular-nums text-white">{formatCurrency(deal.claimed_price)}</p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 lg:hidden">Real drop</p>
          <p className={drop ? 'font-mono font-semibold text-emerald-200' : 'font-mono text-slate-500'}>
            {drop ? `-${drop.percent}%` : '--'}
          </p>
        </div>

        <ScoreMeter label="Quality" value={deal.deal_score} tone={deal.deal_score && deal.deal_score >= 70 ? 'good' : 'warn'} />

        <ScoreMeter label="Confidence" value={deal.source_trust} tone={deal.source_trust && deal.source_trust >= 70 ? 'good' : 'info'} />

        <div className="flex items-center gap-2">
          <GradeBadge grade={deal.deal_grade} />
          <StatusBadge status={deal.status} />
        </div>

        <div className="flex items-center justify-start gap-2 lg:justify-end">
          {deal.amazon_url ? (
            <a
              href={deal.amazon_url}
              target="_blank"
              rel="noreferrer"
              className="grid size-10 place-items-center rounded-lg border border-white/[0.08] text-slate-400 transition-colors hover:bg-white/[0.055] hover:text-cyan-100"
              onClick={(event) => event.stopPropagation()}
              aria-label="Open Amazon"
              title="Open Amazon"
            >
              <ExternalLink size={15} aria-hidden="true" />
            </a>
          ) : null}
          <div className="block">
            <DashboardActionButtons deal={deal} pendingAction={pendingAction} compact onActionCreated={onActionCreated} />
          </div>
          <span className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-cyan-100">
            Review <ArrowRight size={14} aria-hidden="true" />
          </span>
        </div>
      </div>
    </article>
  )
}
