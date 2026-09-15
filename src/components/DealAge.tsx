import { memo, useEffect, useMemo, useState } from 'react'

type DealAgeProps = {
  createdAt: string | null
  prefix?: string
  compact?: boolean
}

function exactDate(value: string | null) {
  if (!value) return 'Discovery time unavailable'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function ageParts(createdAt: string | null, now: number) {
  if (!createdAt) return { label: 'Unknown', tone: 'stale', urgent: false }

  const elapsedMs = Math.max(0, now - new Date(createdAt).getTime())
  const minutes = Math.floor(elapsedMs / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (minutes < 1) return { label: 'Just now', tone: 'fresh', urgent: true }
  if (minutes < 60) return { label: `${minutes}m ago`, tone: 'fresh', urgent: minutes < 15 }
  if (hours < 6) {
    const remainingMinutes = minutes % 60
    return {
      label: remainingMinutes ? `${hours}h ${remainingMinutes}m ago` : `${hours}h ago`,
      tone: 'warm',
      urgent: false,
    }
  }
  if (hours < 24) return { label: `${hours}h ago`, tone: 'aging', urgent: false }
  return { label: `${days}d ago`, tone: 'stale', urgent: false }
}

function toneClass(tone: string) {
  if (tone === 'fresh') return 'text-emerald-200 before:bg-emerald-300'
  if (tone === 'warm') return 'text-lime-200 before:bg-lime-300'
  if (tone === 'aging') return 'text-amber-200 before:bg-amber-300'
  return 'text-slate-400 before:bg-slate-500'
}

export const DealAge = memo(function DealAge({ createdAt, prefix = 'Discovered', compact = false }: DealAgeProps) {
  const [now, setNow] = useState(() => Date.now())
  const age = useMemo(() => ageParts(createdAt, now), [createdAt, now])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <span
      className={[
        'inline-flex min-h-6 items-center gap-1.5 text-xs font-medium before:size-1.5 before:rounded-full',
        toneClass(age.tone),
        age.urgent ? 'shadow-[0_0_20px_rgba(52,211,153,0.12)]' : '',
      ].join(' ')}
      title={exactDate(createdAt)}
      aria-label={`${prefix} ${age.label}`}
    >
      {compact ? age.label : `${prefix} ${age.label}`}
    </span>
  )
})
