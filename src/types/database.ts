export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type DealStatus = string

export type Deal = {
  id: number
  created_at: string | null
  source: string | null
  source_message_id?: string | null
  source_text?: string | null
  original_amazon_url?: string | null
  amazon_url?: string | null
  affiliate_url?: string | null
  asin: string | null
  parent_asin?: string | null
  product_family_key?: string | null
  canonical_product_name?: string | null
  variant_label?: string | null
  variant_count?: number | null
  telegram_url?: string | null
  telegram_date?: string | null
  product_name: string | null
  product_name_guess: string | null
  product_image?: string | null
  product_last_seen_price?: number | null
  product_best_seen_price?: number | null
  product_last_checked_at?: string | null
  price: number | null
  claimed_price: number | null
  claimed_discount: number | null
  verified_title?: string | null
  verified_price?: number | null
  verified_at?: string | null
  verified_availability?: string | null
  verified_image?: string | null
  live_verification_ok?: boolean | null
  verification_status?: string | null
  post_verification_code?: 'VERIFIED' | 'PRICE_CHANGED' | 'LIVE_PRICE_UNAVAILABLE' | 'PRODUCT_UNAVAILABLE' | 'WRONG_VARIANT' | 'VERIFICATION_FAILED' | string | null
  post_verification_message?: string | null
  caption?: string | null
  generated_caption?: string | null
  status: DealStatus | null
  published_message_id?: string | null
  source_trust: number | null
  deal_score: number | null
  quality_score?: number | null
  confidence_score?: number | null
  deal_grade: string | null
  score_reasons: Json | null
  risk_flags: Json | null
  category: string | null
  subcategory: string | null
  category_confidence?: number | null
  category_source?: string | null
  amazon_price_drop_percent?: number | null
  history_status?: string | null
  history_samples_7d?: number | null
  history_samples_30d?: number | null
  history_samples_90d?: number | null
  history_median_7d?: number | null
  history_median_30d?: number | null
  history_median_90d?: number | null
  history_low_7d?: number | null
  history_low_30d?: number | null
  history_low_90d?: number | null
  current_vs_30d_median_percent?: number | null
  is_30d_low?: boolean | null
}

export type DealSighting = {
  id: number
  created_at: string | null
  asin: string | null
  source: string | null
  source_message_id?: string | null
  claimed_price: number | null
  claimed_discount: number | null
  amazon_url?: string | null
}

export type WatcherHealth = {
  id: string
  last_seen: string | null
  status: string | null
  candidates: number | null
  last_error: string | null
}

export type DatabaseUsage = {
  database_bytes: number | null
  database_mb: number | null
}

export type ProductCatalogItem = {
  asin: string
  product_name: string | null
  product_image: string | null
  amazon_url?: string | null
  affiliate_url?: string | null
  last_seen_price: number | null
  best_seen_price: number | null
  last_checked_at: string | null
  last_seen_on_deals_at: string | null
  times_seen: number | null
  active: boolean | null
  created_at: string | null
  updated_at: string | null
}

export type DiscoverySettingPriority = 'OFF' | 'LOW' | 'NORMAL' | 'HIGH' | 'VERY_HIGH'

export type DiscoverySetting = {
  category: string
  priority: DiscoverySettingPriority
  discovery_enabled: boolean
  dashboard_visible: boolean
  telegram_alerts: boolean
  updated_at: string
}

export type DiscoverySettingInsert = DiscoverySetting

export type DiscoverySettingUpdate = Partial<Omit<DiscoverySetting, 'category' | 'updated_at'>> & {
  updated_at?: string
}

export type DashboardActionKind = 'POST' | 'REJECT' | 'REGENERATE_CAPTION'
export type DashboardActionStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED'

export type DashboardAction = {
  id: number
  deal_id: number | null
  action: DashboardActionKind
  requested_by: string | null
  status: DashboardActionStatus | null
  note: string | null
  result: Json | null
  created_at: string | null
  processed_at: string | null
  processing_started_at?: string | null
  finished_at?: string | null
}

export type DashboardActionInsert = {
  deal_id: number
  action: DashboardActionKind
  requested_by: string
  status?: DashboardActionStatus
  note?: string | null
}

export type Database = {
  public: {
    Tables: {
      deals: {
        Row: Deal
        Insert: never
        Update: never
        Relationships: []
      }
      deal_sightings: {
        Row: DealSighting
        Insert: never
        Update: never
        Relationships: []
      }
      watcher_health: {
        Row: WatcherHealth
        Insert: never
        Update: never
        Relationships: []
      }
      product_catalog: {
        Row: ProductCatalogItem
        Insert: never
        Update: never
        Relationships: []
      }
      discovery_settings: {
        Row: DiscoverySetting
        Insert: DiscoverySettingInsert
        Update: DiscoverySettingUpdate
        Relationships: []
      }
      dashboard_actions: {
        Row: DashboardAction
        Insert: DashboardActionInsert
        Update: never
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      get_database_usage: {
        Args: Record<string, never>
        Returns: DatabaseUsage[] | DatabaseUsage
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

