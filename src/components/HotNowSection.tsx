import { ArrowRight, Layers, TrendingDown } from 'lucide-react'
import type { Deal } from '../types/database'
import {
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
import { CategoryBadge } from './DealBadges'
import { ProductImageFrame } from './DesignPrimitives'

type HotNowSectionProps = {
  families: ProductFamily[]
  onOpen: (deal: Deal) => void
}

function HotNowCard({ family, rank, onOpen }: { family: ProductFamily; rank: number; onOpen: (deal: Deal) => void }) {
  const deal = family.primary
  const history = historySignal(deal)
  const freshness = freshnessInfo(verifiedTime(deal))

  return (
    <button
      type="button"
      onClick={() => onOpen(deal)}
      className="group grid gap-3 rounded-lg border border-white/[0.09] bg-[#0b1317]/88 p-4 text-left shadow-xl shadow-black/12 transition-colors hover:border-cyan-300/18 hover:bg-[#0f1a20] md:grid-cols-[72px_1fr] xl:grid-cols-[64px_1fr]"
    >
      <div className="relative">
        <ProductImageFrame src={deal.verified_image ?? deal.product_image} alt={family.title} size="medium" />
        <span className="absolute -left-2 -top-2 grid size-7 place-items-center rounded-md bg-cyan-300 font-mono text-xs font-bold text-cyan-950 shadow-lg shadow-cyan-950/20">
          {rank}
        </span>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="line-clamp-2 font-semibold leading-snug text-white">{family.title}</h3>
          <CategoryBadge deal={deal} />
        </div>
        <p className="mt-3 font-mono text-2xl font-semibold tabular-nums text-white">{formatCurrency(currentDealPrice(deal))}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {history.hasEnoughHistory && typeof history.percentBelow30d === 'number' && history.percentBelow30d < 0 ? (
            <span className="inline-flex min-h-6 items-center gap-1 rounded-md border border-emerald-300/20 bg-emerald-400/10 px-2 font-semibold text-emerald-100">
              <TrendingDown size={13} aria-hidden="true" />
              {Math.abs(Math.round(history.percentBelow30d))}% below 30d median
            </span>
          ) : (
            <span className="inline-flex min-h-6 items-center rounded-md border border-white/[0.08] bg-white/[0.04] px-2 text-slate-300">
              Price history still building
            </span>
          )}
          {deal.is_30d_low ? (
            <span className="inline-flex min-h-6 items-center rounded-md border border-cyan-300/20 bg-cyan-400/10 px-2 font-semibold text-cyan-100">
              New 30-day low
            </span>
          ) : null}
          <span className="inline-flex min-h-6 items-center rounded-md border border-white/[0.08] bg-white/[0.04] px-2 text-slate-300">
            {freshness.label} / Verified {freshness.age}
          </span>
        </div>
        <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
          <span>Quality <strong className="font-mono text-white">{qualityValue(deal) ?? '--'}</strong></span>
          <span>Confidence <strong className="font-mono text-white">{confidenceValue(deal) ?? '--'}</strong></span>
          <span className="truncate">Best variant: <strong className="font-medium text-slate-200">{variantLabel(deal) || deal.asin || '--'}</strong></span>
          <span className="inline-flex items-center gap-1">
            <Layers size={13} aria-hidden="true" />
            {observedVariantSummary(family)}
          </span>
        </div>
        {history.savingVsMedian ? (
          <p className="mt-2 text-xs text-slate-500">
            30-day median {formatCurrency(history.median30)} / saving {formatCurrency(history.savingVsMedian)}
          </p>
        ) : null}
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cyan-100">
          Review deal <ArrowRight size={14} aria-hidden="true" />
        </span>
      </div>
    </button>
  )
}

export function HotNowSection({ families, onOpen }: HotNowSectionProps) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-100">Hot Now</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Best live Amazon deals right now</h2>
        </div>
        <p className="text-sm text-slate-500">{families.length} product families ranked</p>
      </div>
      {families.length > 0 ? (
        <div className="grid gap-3 xl:grid-cols-3">
          {families.slice(0, 6).map((family, index) => (
            <HotNowCard key={family.key} family={family} rank={index + 1} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-white/[0.09] bg-[#0b1317]/88 p-5 text-sm text-slate-500">
          No fresh verified live deals in the current focus window.
        </div>
      )}
    </section>
  )
}
