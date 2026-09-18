import { Check, Loader2, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { PlaceholderPanel } from '../components/PlaceholderPanel'
import { Surface } from '../components/DesignPrimitives'
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/StateViews'
import { useAsyncData } from '../hooks/useAsyncData'
import { hasSupabaseConfig } from '../lib/supabase'
import { fetchDiscoverySettings, updateDiscoverySetting } from '../services/discoverySettings'
import type { DiscoverySetting, DiscoverySettingPriority, DiscoverySettingUpdate } from '../types/database'

const preferredCategoryOrder = ['TECH', 'GAMING', 'HOME', 'FASHION', 'BEAUTY']
const priorityOptions: DiscoverySettingPriority[] = ['OFF', 'LOW', 'NORMAL', 'HIGH', 'VERY_HIGH']

type RowState = { saving: boolean; saved: boolean; error: string | null }

function sortDiscoverySettings(settings: DiscoverySetting[]) {
  return [...settings].sort((left, right) => {
    const leftIndex = preferredCategoryOrder.indexOf(left.category)
    const rightIndex = preferredCategoryOrder.indexOf(right.category)
    const leftRank = leftIndex === -1 ? preferredCategoryOrder.length : leftIndex
    const rightRank = rightIndex === -1 ? preferredCategoryOrder.length : rightIndex
    return leftRank - rightRank || left.category.localeCompare(right.category)
  })
}

function priorityLabel(priority: DiscoverySettingPriority) {
  return priority.replace('_', ' ')
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to save this category.'
}

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className="group inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-1 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className={`relative h-5 w-9 rounded-full border transition-colors ${checked ? 'border-emerald-300/50 bg-emerald-400/70' : 'border-white/15 bg-white/10'}`}>
        <span className={`absolute top-0.5 size-3.5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-[17px]' : 'translate-x-0.5'}`} />
      </span>
      <span className={`text-xs font-semibold ${checked ? 'text-emerald-100' : 'text-slate-400'}`}>{checked ? 'ON' : 'OFF'}</span>
    </button>
  )
}

function DiscoveryRow({ setting, state, onChange }: { setting: DiscoverySetting; state: RowState; onChange: (patch: DiscoverySettingUpdate) => void }) {
  const controlsDisabled = state.saving

  return (
    <div className="border-t border-white/[0.08] px-4 py-4 first:border-t-0 sm:px-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(110px,0.7fr)_minmax(150px,1fr)_repeat(3,minmax(130px,1fr))] xl:items-center">
        <div>
          <p className="font-mono text-sm font-semibold tracking-wide text-white">{setting.category}</p>
          <p className="mt-1 text-xs text-slate-500">Updated {new Date(setting.updated_at).toLocaleString()}</p>
        </div>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Priority</span>
          <select
            value={setting.priority}
            disabled={controlsDisabled}
            aria-label={`${setting.category} priority`}
            onChange={(event) => onChange({ priority: event.target.value as DiscoverySettingPriority })}
            className="min-h-10 cursor-pointer rounded-md border border-white/[0.12] bg-[#101b21] px-3 text-sm font-semibold text-slate-100 outline-none transition-colors hover:border-cyan-300/30 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {priorityOptions.map((priority) => <option key={priority} value={priority}>{priorityLabel(priority)}</option>)}
          </select>
        </label>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Discovery</p>
          <Toggle label={`${setting.category} discovery`} checked={setting.discovery_enabled} disabled={controlsDisabled} onChange={() => onChange({ discovery_enabled: !setting.discovery_enabled })} />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Dashboard visible</p>
          <Toggle label={`${setting.category} dashboard visible`} checked={setting.dashboard_visible} disabled={controlsDisabled} onChange={() => onChange({ dashboard_visible: !setting.dashboard_visible })} />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Telegram alerts</p>
          <Toggle label={`${setting.category} Telegram alerts`} checked={setting.telegram_alerts} disabled={controlsDisabled} onChange={() => onChange({ telegram_alerts: !setting.telegram_alerts })} />
        </div>
      </div>
      <div className="mt-3 flex min-h-5 items-center gap-2 text-xs" aria-live="polite">
        {state.saving ? <><Loader2 size={14} className="animate-spin text-cyan-200" aria-hidden="true" /><span className="text-cyan-100">Saving changes…</span></> : null}
        {!state.saving && state.saved ? <><Check size={14} className="text-emerald-300" aria-hidden="true" /><span className="text-emerald-200">Saved</span></> : null}
        {!state.saving && state.error ? <span className="text-rose-200">Couldn’t save: {state.error}</span> : null}
      </div>
    </div>
  )
}

export function SettingsPage() {
  const { data, error, isLoading, isConfigured, reload } = useAsyncData(fetchDiscoverySettings)
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({})
  const [settings, setSettings] = useState<DiscoverySetting[] | null>(null)
  const visibleSettings = settings ?? (data ? sortDiscoverySettings(data) : null)

  useEffect(() => {
    if (data) setSettings(sortDiscoverySettings(data))
  }, [data])

  async function handleChange(category: string, patch: DiscoverySettingUpdate) {
    const current = visibleSettings?.find((setting) => setting.category === category)
    if (!current) return
    const next = { ...current, ...patch }
    setSettings((currentSettings) => sortDiscoverySettings((currentSettings ?? data ?? []).map((setting) => setting.category === category ? next : setting)))
    setRowStates((currentStates) => ({ ...currentStates, [category]: { saving: true, saved: false, error: null } }))

    try {
      await updateDiscoverySetting(category, patch)
      setRowStates((currentStates) => ({ ...currentStates, [category]: { saving: false, saved: true, error: null } }))
    } catch (saveError) {
      setSettings((currentSettings) => sortDiscoverySettings((currentSettings ?? []).map((setting) => setting.category === category ? current : setting)))
      setRowStates((currentStates) => ({ ...currentStates, [category]: { saving: false, saved: false, error: errorMessage(saveError) } }))
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="Operate discovery coverage and keep the dashboard’s category signals aligned with your publishing workflow." />
      <div className="space-y-4">
        <Surface className="overflow-hidden" tone="strong">
          <div className="border-b border-white/[0.08] px-4 py-5 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">Discovery Control</h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">Priority controls how often targeted discovery scans that category. Discovery enables or disables targeted scanning. Dashboard Visible controls category visibility and focus in the dashboard. Telegram Alerts controls whether qualifying deals from that verified category may alert Telegram.</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">Telegram decisions use the verified Amazon category, not <code className="text-slate-300">discovery_category_hints</code>.</p>
              </div>
              {data && !isLoading ? <button type="button" onClick={reload} className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md border border-white/10 px-3 text-xs font-semibold text-slate-300 transition-colors hover:border-cyan-300/30 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"><RefreshCw size={14} aria-hidden="true" />Refresh</button> : null}
            </div>
          </div>
          {isLoading ? <div className="p-4 sm:p-5"><LoadingSkeleton rows={5} /></div> : null}
          {!isLoading && error && !visibleSettings ? <div className="space-y-3 p-4 sm:p-5"><ErrorState message={`Couldn’t load discovery settings: ${error.message}`} /><button type="button" onClick={reload} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md bg-white/10 px-3 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"><RefreshCw size={15} aria-hidden="true" />Retry</button></div> : null}
          {!isLoading && !error && isConfigured && visibleSettings?.length === 0 ? <div className="p-4 sm:p-5"><EmptyState title="No discovery categories configured" message="Add rows to discovery_settings to make category controls available here." /></div> : null}
          {!isLoading && visibleSettings?.length ? <div>{visibleSettings.map((setting) => <DiscoveryRow key={setting.category} setting={setting} state={rowStates[setting.category] ?? { saving: false, saved: false, error: null }} onChange={(patch) => void handleChange(setting.category, patch)} />)}</div> : null}
          {!isConfigured ? <div className="p-4 sm:p-5"><ErrorState message="Supabase frontend configuration is missing, so discovery settings cannot be loaded." /></div> : null}
        </Surface>
        <div className="grid gap-4 lg:grid-cols-2">
          <PlaceholderPanel title="Supabase frontend config">
            <p>Status: {hasSupabaseConfig ? 'Configured' : 'Missing Vite env vars'}</p>
            <p className="mt-2">Use only <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in this browser app.</p>
          </PlaceholderPanel>
          <PlaceholderPanel title="Privileged action boundary">
            <p>Post, Reject, and caption regeneration actions are routed through the privileged backend boundary.</p>
            <p className="mt-2">Keep service-role credentials out of browser code; use only public frontend environment variables here.</p>
          </PlaceholderPanel>
        </div>
      </div>
    </>
  )
}
