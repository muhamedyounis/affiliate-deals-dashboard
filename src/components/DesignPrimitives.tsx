import { ImageOff, TrendingDown } from 'lucide-react'
import { useState } from 'react'
import { normalizeGrade } from '../services/deals'
import type { Deal } from '../types/database'
import { formatCurrency, formatPercent, realObservedDrop } from '../utils/dealPresentation'

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function Surface({
  children,
  className = '',
  as = 'section',
  tone = 'default',
}: {
  children: React.ReactNode
  className?: string
  as?: 'section' | 'div' | 'aside'
  tone?: 'default' | 'strong' | 'subtle'
}) {
  const Component = as
  const toneClass = tone === 'strong'
    ? 'border-white/[0.13] bg-[#101b21]/92 shadow-2xl shadow-black/24'
    : tone === 'subtle'
      ? 'border-white/[0.06] bg-white/[0.025]'
      : 'border-white/[0.09] bg-[#0b1317]/88 shadow-xl shadow-black/18'

  return (
    <Component className={cx('rounded-lg border backdrop-blur-sm', toneClass, className)}>
      {children}
    </Component>
  )
}

export function SectionHeader({
  title,
  meta,
  action,
}: {
  title: string
  meta?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {meta ? <p className="mt-1 text-xs text-slate-500">{meta}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function MetricTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string | number | null
  tone?: 'neutral' | 'good' | 'warn' | 'info'
}) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-200'
      : tone === 'warn'
        ? 'text-amber-200'
        : tone === 'info'
          ? 'text-cyan-200'
          : 'text-white'

  return (
    <div className="min-w-0 border-l border-white/[0.08] px-4 py-4 first:border-l-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${toneClass}`}>{value ?? '--'}</p>
    </div>
  )
}

export function Pill({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'info' | 'good' | 'warn' | 'danger'
  className?: string
}) {
  const toneClass =
    tone === 'info'
      ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100'
      : tone === 'good'
        ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'
        : tone === 'warn'
          ? 'border-amber-300/20 bg-amber-400/10 text-amber-100'
          : tone === 'danger'
            ? 'border-rose-300/20 bg-rose-400/10 text-rose-100'
            : 'border-white/[0.08] bg-white/[0.04] text-slate-300'

  return (
    <span className={cx('inline-flex min-h-7 items-center rounded-md border px-2.5 text-xs font-semibold', toneClass, className)}>
      {children}
    </span>
  )
}

export function ScoreMeter({
  label,
  value,
  tone = 'info',
}: {
  label: string
  value: number | null
  tone?: 'info' | 'good' | 'warn'
}) {
  const width = typeof value === 'number' ? Math.max(4, Math.min(100, value)) : 0
  const color = tone === 'good' ? 'bg-emerald-300' : tone === 'warn' ? 'bg-amber-300' : 'bg-cyan-300'

  return (
    <div className="min-w-[86px]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        <span className="font-mono text-sm font-semibold tabular-nums text-white">{value ?? '--'}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div className={cx('h-full rounded-full', color)} style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

export function ControlShell({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cx('rounded-lg border border-white/[0.09] bg-black/20 shadow-inner shadow-black/15', className)}>
      {children}
    </div>
  )
}

export function DealScore({
  label,
  value,
  grade,
}: {
  label: string
  value: number | null
  grade?: string | null
}) {
  const normalized = normalizeGrade(grade)
  const descriptor = normalized === 'HOT' ? 'Strong' : normalized === 'GOOD' ? 'Good' : normalized === 'LOW' ? 'Low' : 'Medium'
  const color =
    normalized === 'HOT' || normalized === 'GOOD'
      ? 'text-emerald-200'
      : normalized === 'LOW'
        ? 'text-slate-400'
        : 'text-amber-200'

  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 flex items-end gap-2">
        <span className={`font-mono text-5xl font-semibold leading-none tabular-nums ${color}`}>{value ?? '--'}</span>
        <span className="pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{descriptor}</span>
      </div>
    </div>
  )
}

export function ProductImageFrame({
  src,
  alt = '',
  size = 'large',
}: {
  src?: string | null
  alt?: string
  size?: 'small' | 'medium' | 'large'
}) {
  const [failed, setFailed] = useState(false)
  const sizeClass = size === 'small' ? 'size-12' : size === 'medium' ? 'size-20' : 'aspect-square w-full'
  const showImage = Boolean(src && !failed)

  return (
    <div className={`grid shrink-0 place-items-center overflow-hidden rounded-lg bg-[#121d23] ring-1 ring-white/[0.1] ${sizeClass}`}>
      {showImage ? (
        <img src={src ?? ''} alt={alt} className="h-full w-full object-contain p-2" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <ImageOff className="text-slate-600" size={size === 'small' ? 18 : 30} aria-hidden="true" />
      )}
    </div>
  )
}

export function PriceIntelligence({ deal, compact = false }: { deal: Deal; compact?: boolean }) {
  const drop = realObservedDrop(deal)
  const livePrice = deal.product_last_seen_price ?? null
  const displayedPrice = livePrice ?? deal.claimed_price
  const isWatcherVerified = livePrice !== null

  return (
    <div className={compact ? 'space-y-1' : 'space-y-3'}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Live price</p>
        <p className={`mt-1 font-mono text-3xl font-semibold tabular-nums ${isWatcherVerified ? 'text-white' : 'text-amber-100'}`}>
          {formatCurrency(displayedPrice)}
        </p>
        <p className={`mt-1 text-xs ${isWatcherVerified ? 'text-slate-500' : 'text-amber-200/80'}`}>
          {isWatcherVerified && deal.product_last_checked_at
            ? `Checked ${new Date(deal.product_last_checked_at).toLocaleString()}`
            : 'Using reported price until watcher verifies live price'}
        </p>
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Reported deal price</p>
        <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-200">{formatCurrency(deal.claimed_price)}</p>
        <p className="mt-1 text-xs text-slate-500">{formatPercent(deal.claimed_discount)} displayed discount</p>
      </div>
      <div className={drop ? 'text-emerald-100' : 'text-slate-500'}>
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
          <TrendingDown size={13} aria-hidden="true" />
          Real drop
        </p>
        <p className="mt-1 font-mono text-sm tabular-nums">
          {drop ? `${formatCurrency(deal.price)} -> ${formatCurrency(deal.claimed_price)} (${drop.percent}%)` : 'No observed historical drop'}
        </p>
      </div>
    </div>
  )
}

