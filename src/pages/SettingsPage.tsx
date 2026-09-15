import { PageHeader } from '../components/PageHeader'
import { PlaceholderPanel } from '../components/PlaceholderPanel'
import { hasSupabaseConfig } from '../lib/supabase'

export function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Configuration status for public frontend environment variables and integration boundaries."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <PlaceholderPanel title="Supabase frontend config">
          <p>Status: {hasSupabaseConfig ? 'Configured' : 'Missing Vite env vars'}</p>
          <p className="mt-2">
            Use only <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in this browser app.
          </p>
        </PlaceholderPanel>
        <PlaceholderPanel title="Privileged action boundary">
          <p>Post, Reject, and caption regeneration actions are routed through the privileged backend boundary.</p>
          <p className="mt-2">
            Keep service-role credentials out of browser code; use only public frontend environment variables here.
          </p>
        </PlaceholderPanel>
      </div>
    </>
  )
}
