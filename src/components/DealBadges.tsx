import { normalizeGrade, statusLabel } from '../services/deals'
import type { Deal } from '../types/database'
import { compactDealCategoryText } from '../utils/categories'

const gradeStyles = {
  HOT: 'border-emerald-300/25 bg-emerald-400/12 text-emerald-100',
  GOOD: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100',
  REVIEW: 'border-amber-300/25 bg-amber-400/12 text-amber-100',
  LOW: 'border-slate-300/18 bg-slate-400/10 text-slate-300',
}

export function GradeBadge({ grade }: { grade: string | null }) {
  const normalized = normalizeGrade(grade)

  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-md border px-2 text-[11px] font-semibold uppercase tracking-wide ${gradeStyles[normalized]}`}
    >
      {normalized}
    </span>
  )
}

export function ScoreBadge({ label, value }: { label: string; value: number | null }) {
  return (
    <span className="inline-flex min-h-7 items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 font-mono text-xs tabular-nums text-slate-300">
      {label}
      <strong className="text-white">{value ?? '--'}/100</strong>
    </span>
  )
}

export function StatusBadge({ status }: { status: string | null }) {
  const normalized = status?.toUpperCase()
  const style =
      normalized === 'PENDING_APPROVAL'
      ? 'border-cyan-300/20 bg-cyan-400/10 text-cyan-100'
      : normalized === 'REVIEW'
        ? 'border-slate-300/18 bg-slate-400/10 text-slate-200'
        : normalized === 'POSTED'
          ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'
          : normalized === 'REJECTED'
            ? 'border-rose-300/20 bg-rose-400/10 text-rose-100'
            : 'border-amber-300/20 bg-amber-400/10 text-amber-100'

  return (
    <span className={`inline-flex min-h-6 items-center rounded-md border px-2 text-[11px] font-semibold ${style}`}>
      {statusLabel(status)}
    </span>
  )
}

export function CategoryBadge({ deal }: { deal: Pick<Deal, 'category' | 'subcategory'> }) {
  return (
    <span className="inline-flex min-h-6 max-w-full items-center truncate rounded-md border border-white/[0.08] bg-white/[0.045] px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
      {compactDealCategoryText(deal)}
    </span>
  )
}
