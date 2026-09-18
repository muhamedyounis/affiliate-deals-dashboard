import { ExternalLink, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAsyncData } from '../hooks/useAsyncData'
import { displayProductName, fetchDealActions, fetchDealById, fetchDealSightings, isDashboardOnlyStatus } from '../services/deals'
import type { DashboardAction, Deal, Json } from '../types/database'
import { formatCurrency, formatPercent, realObservedDrop, summarizeJson } from '../utils/dealPresentation'
import { DashboardActionButtons } from './DashboardActionButtons'
import { DealAge } from './DealAge'
import { CategoryBadge, GradeBadge, ScoreBadge, StatusBadge } from './DealBadges'
import { ProductImageFrame } from './DesignPrimitives'
import { ErrorState, LoadingInline } from './StateViews'

type DealDetailsDrawerProps = {
  deal: Deal | null
  onClose: () => void
  onDealUpdated?: (deal: Deal) => void
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

function ExternalAnchor({ href, label }: { href?: string | null; label: string }) {
  if (!href) return <span className="text-slate-500">--</span>

  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-200 hover:text-cyan-100">
      {label}
      <ExternalLink size={14} aria-hidden="true" />
    </a>
  )
}

export function DealDetailsDrawer({ deal, onClose, onDealUpdated }: DealDetailsDrawerProps) {
  const [visibleDeal, setVisibleDeal] = useState<Deal | null>(deal)
  const currentDeal = visibleDeal ?? deal
  const asin = currentDeal?.asin ?? ''
  const loader = useMemo(() => () => (asin ? fetchDealSightings(asin) : Promise.resolve([])), [asin])
  const sightings = useAsyncData(loader, [loader])
  const dealId = currentDeal?.id ?? null
  const actionLoader = useMemo(() => () => (dealId ? fetchDealActions(dealId) : Promise.resolve([])), [dealId])
  const actions = useAsyncData(actionLoader, [actionLoader])

  useEffect(() => {
    setVisibleDeal(deal)
  }, [deal])

  const refreshDeal = useCallback(async (completedAction: DashboardAction) => {
    if (!completedAction.deal_id) return
    const latestDeal = await fetchDealById(completedAction.deal_id)
    if (!latestDeal) return
    setVisibleDeal(latestDeal)
    onDealUpdated?.(latestDeal)
  }, [onDealUpdated])

  if (!currentDeal) return null

  const distinctSources = new Set((sightings.data ?? []).map((item) => item.source).filter(Boolean))
  const pendingAction = (actions.data ?? []).find((action) => action.status === 'PENDING' || action.status === 'PROCESSING')
  const caption = currentDeal.generated_caption || currentDeal.caption || (isDashboardOnlyStatus(currentDeal.status) ? 'Caption not generated yet' : '--')
  const drop = realObservedDrop(currentDeal)
  const livePrice = currentDeal.product_last_seen_price ?? null
  const displayedLivePrice = livePrice ?? currentDeal.claimed_price

  return (
    <div className="fixed inset-0 z-30" role="dialog" aria-modal="true" aria-label="Deal details">
      <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Close deal details" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full overflow-y-auto border-l border-white/[0.12] bg-[#081014]/98 p-5 shadow-2xl shadow-black/40 sm:max-w-[620px]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <ProductImageFrame src={currentDeal.product_image} alt={displayProductName(currentDeal)} size="medium" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80">Deal Details</p>
              <h2 className="mt-2 line-clamp-2 text-lg font-semibold text-white">{displayProductName(currentDeal)}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge status={currentDeal.status} />
                <GradeBadge grade={currentDeal.deal_grade} />
                <CategoryBadge deal={currentDeal} />
                <DealAge createdAt={currentDeal.created_at} />
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
              <ScoreBadge label="Quality" value={currentDeal.deal_score} />
              <ScoreBadge label="Confidence" value={currentDeal.source_trust} />
              <StatusBadge status={currentDeal.status} />
            </div>
            <div className="mt-4">
              <DashboardActionButtons deal={currentDeal} pendingAction={pendingAction} onActionCreated={actions.reload} onActionCompleted={refreshDeal} />
            </div>
          </Section>

          <Section title="Price Intelligence">
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailRow label="Live price" value={formatCurrency(displayedLivePrice)} />
              <DetailRow label="Live price status" value={livePrice !== null ? currentDeal.product_last_checked_at || 'Watcher verified' : 'Waiting for watcher; showing reported price'} />
              <DetailRow label="Reported deal price" value={formatCurrency(currentDeal.claimed_price)} />
              <DetailRow label="Previous observed price" value={formatCurrency(currentDeal.price)} />
              <DetailRow label="Best catalog price" value={formatCurrency(currentDeal.product_best_seen_price ?? null)} />
              <DetailRow label="Displayed discount" value={formatPercent(currentDeal.claimed_discount)} />
              <DetailRow label="Real observed drop" value={drop ? `${formatCurrency(drop.amount)} (${drop.percent}%)` : '--'} />
              <DetailRow label="ASIN" value={currentDeal.asin || '--'} />
            </dl>
          </Section>

          <Section title="Evidence">
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailRow label="Source" value={currentDeal.source || '--'} />
              <DetailRow label="Category" value={<CategoryBadge deal={currentDeal} />} />
              <DetailRow label="Source trust" value={currentDeal.source_trust ?? '--'} />
              <DetailRow label="Confirmations" value={sightings.isLoading ? <LoadingInline /> : `${(sightings.data ?? []).length} sightings, ${distinctSources.size} sources`} />
              <DetailRow label="Amazon" value={<ExternalAnchor href={currentDeal.amazon_url} label="Open deal" />} />
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
            <pre className="overflow-x-auto rounded-lg border border-white/[0.08] bg-black/20 p-3 whitespace-pre-wrap text-xs leading-5 text-slate-300">{formatJson(currentDeal.risk_flags)}</pre>
          </Section>

          <Section title="Generated Caption">
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{caption}</p>
          </Section>

          <Section title="Source Text">
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{currentDeal.source_text || '--'}</p>
          </Section>

          <Section title="Links">
            <div className="grid gap-2 text-sm">
              <p>Amazon: <ExternalAnchor href={currentDeal.amazon_url} label="Open" /></p>
              <p>Original Amazon: <ExternalAnchor href={currentDeal.original_amazon_url} label="Open" /></p>
              <p>Affiliate: <ExternalAnchor href={currentDeal.affiliate_url} label="Open" /></p>
              <p>Telegram: <ExternalAnchor href={currentDeal.telegram_url} label="Open" /></p>
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

          <p className="text-xs text-slate-600">Score reasons: {summarizeJson(currentDeal.score_reasons)}</p>
        </div>
      </aside>
    </div>
  )
}

