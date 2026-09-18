import { supabase } from '../lib/supabase'
import type { DiscoverySetting, DiscoverySettingUpdate } from '../types/database'

const discoverySettingSelect = 'category, priority, discovery_enabled, dashboard_visible, telegram_alerts, updated_at'

function getClient() {
  if (!supabase) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY')
  }

  return supabase
}

export async function fetchDiscoverySettings(): Promise<DiscoverySetting[]> {
  const { data, error } = await getClient()
    .from('discovery_settings')
    .select(discoverySettingSelect)
    .order('category', { ascending: true })

  if (error) throw error
  return data as DiscoverySetting[]
}

export async function updateDiscoverySetting(category: string, patch: DiscoverySettingUpdate): Promise<void> {
  const { error } = await getClient()
    .from('discovery_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('category', category)

  if (error) throw error
}
