import { supabase } from '../lib/supabase'
import type { DashboardAction, DashboardActionKind } from '../types/database'

const activeStatuses = ['PENDING', 'PROCESSING'] as const

function requireSupabase() {
  if (!supabase) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY')
  }

  return supabase
}

export async function createDashboardAction(dealId: number, action: DashboardActionKind, requestedBy: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('dashboard_actions')
    .insert({
      deal_id: dealId,
      action,
      requested_by: requestedBy,
    })
    .select('id, deal_id, action, status, requested_by, note, result, created_at, processed_at')
    .single()

  if (error) throw error
  return data
}

export async function fetchDashboardActionById(actionId: number) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('dashboard_actions')
    .select('*')
    .eq('id', actionId)
    .single()

  if (error) throw error
  return data
}

export async function fetchActiveActionForDeal(dealId: number) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('dashboard_actions')
    .select('*')
    .eq('deal_id', dealId)
    .in('status', [...activeStatuses])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function fetchActionHistoryForDeal(dealId: number, limit = 6) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('dashboard_actions')
    .select('*')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data
}

export function subscribeToDashboardAction(actionId: number, onChange: (action: DashboardAction) => void) {
  const client = requireSupabase()
  const channel = client
    .channel(`dashboard-action-${actionId}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'dashboard_actions',
        filter: `id=eq.${actionId}`,
      },
      (payload) => {
        if (payload.new && typeof payload.new === 'object') {
          onChange(payload.new as DashboardAction)
        }
      },
    )
    .subscribe()

  return () => {
    void client.removeChannel(channel)
  }
}

export function isActionActive(action: DashboardAction | null | undefined) {
  return action?.status === 'PENDING' || action?.status === 'PROCESSING'
}
