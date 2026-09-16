import { ExternalLink, X } from 'lucide-react'
import { useMemo } from 'react'
import { useAsyncData } from '../hooks/useAsyncData'
import { displayProductName, fetchDealActions, fetchDealSightings, isDashboardOnlyStatus } from '../services/deals'
import type { Deal, Json } from '../types/database'
import { formatCurrency, formatPercent, realObservedDrop, summarizeJson } from '../utils/dealPresentation'
import { DashboardActionButtons } from './DashboardActionButtons'
import { DealAge } from './DealAge'
import { CategoryBadge, GradeBadge, ScoreBadge, StatusBadge } from './DealBadges'
import { ProductImageFrame } from './DesignPrimitives'
import { ErrorState, LoadingInline } from './StateViews'

type DealDetailsDrawerProps = {
  deal: Deal | null
  onClose: () => void
}

function formatJson(value: Json | null) {
  if (value === null) return 'None'
  return JSON.stringify(value, null, 2)
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-white/[0.08] py-5 last:border-b-0">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-200">{value ?? '--'}</dd>
    </div>
  )
}

function ExternalAnchor({ href, label }: { href: string | null; label: string }) {
  if (!href) return <span className="text-slate-500">--</span>

  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-200 hover:text-cyan-100">
      {label}
      <ExternalLink size={14} aria-hidden="true" />
    </a>
  )
}

export function DealDetailsDrawer({ deal, onClose }: DealDetailsDrawerProps) {
  const asin = deal?.asin ?? ''
  const loader = useMemo(() => () => (asin ? fetchDealSightings(asin) : Promise.resolve([])), [asin])
  const sightings = useAsyncData(loader, [loader])
  const dealId = deal?.id ?? null
  const actionLoader = useMemo(() => () => (dealId ? fetchDealActions(dealId) : Promise.resolve([])), [dealId])
  const actions = useAsyncData(actionLoader, [actionLoader])

  if (!deal) return null

  const distinctSources = new Set((sightings.data ?? []).map((item) => item.source).filter(Boolean))
  const pendingAction = (actions.data ?? []).find((action) => action.status === 'PENDING' || action.status === 'PROCESSING')
  const caption = deal.generated_caption || deal.caption || (isDashboardOnlyStatus(deal.status) ? 'Caption not generated yet' : '--')
  const drop = realObservedDrop(deal)
  const livePrice = deal.product_last_seen_price ?? null
  const displayedLivePrice = livePrice ?? deal.claimed_price

  return (
    <div className="fixed inset-0 z-30" role="dialog" aria-modal="true" aria-label="Deal details">
      <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Close deal details" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full overflow-y-auto border-l border-white/[0.12] bg-[#081014]/98 p-5 shadow-2xl shadow-black/40 sm:max-w-[620px]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <ProductImageFrame src={deal.product_image} alt={displayProductName(deal)} size="medium" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80">Deal Details</p>
              <h2 className="mt-2 line-clamp-2 text-lg font-semibold text-white">{displayProductName(deal)}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge status={deal.status} />
                <GradeBadge grade={deal.deal_grade} />
                <CategoryBadge deal={deal} />
                <DealAge createdAt={deal.created_at} />
              </div>
            </div>
          </div>
          <button type="button" className="grid size-10 shrink-0 place-items-center rounded-lg border border-white/[0.08] text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white" onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5">
          <Section title="Decision">
            <div className="flex flex-wrap gap-2">
              <ScoreBadge label="Quality" value={deal.deal_score} />
              <ScoreBadge label="Confidence" value={deal.source_trust} />
              <StatusBadge status={deal.status} />
            </div>
            <div className="mt-4">
              <DashboardActionButtons deal={deal} pendingAction={pendingAction} onActionCreated={actions.reload} />
            </div>
          </Section>

          <Section title="Price Intelligence">
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailRow label="Live price" value={formatCurrency(displayedLivePrice)} />
              <DetailRow label="Live price status" value={livePrice !== null ? deal.product_last_checked_at || 'Watcher verified' : 'Waiting for watcher; showing reported price'} />
              <DetailRow label="Reported deal price" value={formatCurrency(deal.claimed_price)} />
              <DetailRow label="Previous observed price" value={formatCurrency(deal.price)} />
              <DetailRow label="Best catalog price" value={formatCurrency(deal.product_best_seen_price ?? null)} />
              <DetailRow label="Displayed discount" value={formatPercent(deal.claimed_discount)} />
              <DetailRow label="Real observed drop" value={drop ? `${formatCurrency(drop.amount)} (${drop.percent}%)` : '--'} />
              <DetailRow label="ASIN" value={deal.asin || '--'} />
            </dl>
          </Section>

          <Section title="Evidence">
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailRow label="Source" value={deal.source || '--'} />
              <DetailRow label="Category" value={<CategoryBadge deal={deal} />} />
              <DetailRow label="Source trust" value={deal.source_trust ?? '--'} />
              <DetailRow label="Confirmations" value={sightings.isLoading ? <LoadingInline /> : `${(sightings.data ?? []).length} sightings, ${distinctSources.size} sources`} />
              <DetailRow label="Amazon" value={<ExternalAnchor href={deal.amazon_url} label="Open deal" />} />
            </dl>
            {sightings.error ? <div className="mt-3"><ErrorState message={sightings.error.message} /></div> : null}
            <div className="mt-3 space-y-2">
              {(sightings.data ?? []).slice(0, 6).map((sighting) => (
                <div key={sighting.id} className="rounded-lg bg-white/[0.035] p-3 text-sm">
                  <p className="font-medium text-slate-200">{sighting.source || 'Unknown source'}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {sighting.created_at || '--'} {sighting.claimed_price ? `/ ${formatCurrency(sighting.claimed_price)}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Risk Signals">
            <pre className="overflow-x-auto rounded-lg border border-white/[0.08] bg-black/20 p-3 whitespace-pre-wrap text-xs leading-5 text-slate-300">{formatJson(deal.risk_flags)}</pre>
          </Section>

          <Section title="Generated Caption">
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{caption}</p>
          </Section>

          <Section title="Source Text">
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{deal.source_text || '--'}</p>
          </Section>

          <Section title="Links">
            <div className="grid gap-2 text-sm">
              <p>Amazon: <ExternalAnchor href={deal.amazon_url} label="Open" /></p>
              <p>Original Amazon: <ExternalAnchor href={deal.original_amazon_url} label="Open" /></p>
              <p>Affiliate: <ExternalAnchor href={deal.affiliate_url} label="Open" /></p>
              <p>Telegram: <ExternalAnchor href={deal.telegram_url} label="Open" /></p>
            </div>
          </Section>

          <Section title="Activity">
            <div className="space-y-2">
              {(actions.data ?? []).map((action) => (
                <div key={action.id} className="rounded-lg bg-white/[0.035] p-3 text-sm text-slate-300">
                  <p className="font-semibold text-white">{action.action} / {action.status || 'UNKNOWN'}</p>
                  <p className="mt-1 text-xs text-slate-500">{action.created_at || '--'}</p>
                  {action.note ? <p className="mt-2 text-xs">{action.note}</p> : null}
                </div>
              ))}
              {!actions.isLoading && actions.data?.length === 0 ? <p className="text-sm text-slate-500">No dashboard actions yet.</p> : null}
            </div>
          </Section>

          <p className="text-xs text-slate-600">Score reasons: {summarizeJson(deal.score_reasons)}</p>
        </div>
      </aside>
    </div>
  )
}
