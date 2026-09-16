import { useEffect, useState } from 'react'
import { fetchActionHistoryForDeal } from '../services/dashboardActions'
import type { DashboardAction, DashboardActionStatus } from '../types/database'

const statusText: Record<DashboardActionStatus, string> = {
  PENDING: 'queued',
  PROCESSING: 'processing',
  DONE: 'done',
  FAILED: 'failed',
}

function timeLabel(value: string | null) {
  if (!value) return '--'
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function actionLabel(action: DashboardAction) {
  return action.action === 'REGENERATE_CAPTION' ? 'REGENERATE' : action.action
}

export function ActionHistory({ dealId, refreshKey = 0 }: { dealId: number | null; refreshKey?: number }) {
  const [items, setItems] = useState<DashboardAction[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!dealId) {
      setItems([])
      return
    }

    let cancelled = false
    fetchActionHistoryForDeal(dealId, expanded ? 8 : 3)
      .then((history) => {
        if (!cancelled) setItems(history)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })

    return () => {
      cancelled = true
    }
  }, [dealId, expanded, refreshKey])

  if (!dealId || items.length === 0) return null

  return (
    <div className="border-t border-white/[0.07] pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Activity</p>
        {items.length >= 3 ? (
          <button type="button" onClick={() => setExpanded((current) => !current)} className="text-xs font-semibold text-cyan-100 hover:text-cyan-50">
            {expanded ? 'Show less' : 'Expand'}
          </button>
        ) : null}
      </div>
      <ol className="mt-2 space-y-1.5 text-xs text-slate-400">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 rounded-md bg-white/[0.03] px-2 py-1.5">
            <span className="min-w-0 truncate">
              <span className="font-mono text-slate-500">{timeLabel(item.created_at)}</span>
              <span className="ml-2 font-semibold text-slate-200">{actionLabel(item)}</span>
              <span className={item.status === 'FAILED' ? 'ml-1 text-rose-200' : item.status === 'DONE' ? 'ml-1 text-emerald-200' : 'ml-1 text-cyan-100'}>
                {item.status ? statusText[item.status] : 'unknown'}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
