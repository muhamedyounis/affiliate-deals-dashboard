import { AlertCircle, Database, Loader2 } from 'lucide-react'
import { Surface } from './DesignPrimitives'

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-28 animate-pulse rounded-lg border border-white/[0.08] bg-gradient-to-r from-white/[0.035] via-white/[0.07] to-white/[0.035]"
        />
      ))}
    </div>
  )
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <Surface className="p-8 text-center" tone="subtle">
      <div className="mx-auto grid size-12 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
        <Database className="text-slate-400" size={24} aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">{message}</p>
    </Surface>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-300/20 bg-rose-400/10 p-5 text-sm text-rose-100 shadow-xl shadow-rose-950/10" role="alert">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
        <p>{message}</p>
      </div>
    </div>
  )
}

export function LoadingInline() {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-400">
      <Loader2 className="animate-spin" size={16} aria-hidden="true" />
      Loading
    </span>
  )
}
