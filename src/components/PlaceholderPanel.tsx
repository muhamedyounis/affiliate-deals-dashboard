import type { ReactNode } from 'react'
import { Surface } from './DesignPrimitives'

type PlaceholderPanelProps = {
  title: string
  children: ReactNode
}

export function PlaceholderPanel({ title, children }: PlaceholderPanelProps) {
  return (
    <Surface className="p-5">
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      <div className="mt-3 text-sm leading-6 text-slate-400">{children}</div>
    </Surface>
  )
}
