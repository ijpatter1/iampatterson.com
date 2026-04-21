/**
 * Dashboard data types matching BigQuery Dataform mart schemas.
 * These interfaces mirror the column schemas from mart_campaign_performance,
 * mart_channel_attribution, and mart_customer_ltv.
 *
 * Phase 9E deliverable 7 removed the subscription and lead gen demos;
 * their dashboard-data type bundles (`SubscriptionDashboardData`,
 * `LeadGenDashboardData`, `SubscriptionCohortRow`, `LeadFunnelRow`,
 * `CohortData`, `ChurnBreakdown`, `LeadQualityBreakdown`) were deleted
 * because they had no remaining consumers. The corresponding
 * `mart_subscription_cohorts` + `mart_lead_funnel` mart models in
 * `infrastructure/dataform/` stay untouched, the warehouse tables are
 * still built on the simulated historical data, they just aren't
 * rendered in the UI while the demos are off-site.
 */

// --- E-commerce Dashboard Types ---

export interface CampaignPerformanceRow {
  report_date: string;
  platform: string;
  business_model: string;
  campaign_name: string;
  campaign_name_raw: string;
  impressions: number;
  clicks: number;
  spend_usd: number;
  sessions: number;
  product_views: number;
  add_to_carts: number;
  purchases: number;
  purchase_revenue: number;
  cost_per_session: number;
  cost_per_purchase: number;
  roas: number;
}

export interface ChannelAttributionRow {
  report_month: string;
  business_model: string;
  utm_source: string;
  utm_medium: string;
  sessions: number;
  converting_sessions: number;
  attributed_revenue: number;
  conversion_rate: number;
  revenue_per_session: number;
  trial_signups: number;
  trial_signup_rate: number;
  form_completions: number;
  qualified_leads: number;
  form_completion_rate: number;
  lead_qualification_rate: number;
}

export interface CustomerLtvRow {
  client_id: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  first_purchase_at: string;
  last_purchase_at: string;
  customer_tenure_days: number;
  total_orders: number;
  purchase_sessions: number;
  total_revenue: number;
  avg_order_value: number;
  total_items: number;
  annualized_revenue: number;
  acquisition_month: string;
}

// --- Aggregated Dashboard View Models ---

export interface KpiMetric {
  label: string;
  value: string;
  change: number; // percentage change from prior period
  prefix?: string;
  suffix?: string;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
  label?: string;
}

export interface ChannelBreakdown {
  channel: string;
  sessions: number;
  conversions: number;
  revenue: number;
  conversionRate: number;
  costPerAcquisition: number;
  roas: number;
}

export interface ProductPerformance {
  productName: string;
  views: number;
  addToCarts: number;
  purchases: number;
  revenue: number;
  conversionRate: number;
}

export interface FunnelStep {
  label: string;
  value: number;
  percentage: number;
}

// --- Dashboard Data Bundles ---

export interface EcommerceDashboardData {
  kpis: KpiMetric[];
  revenueTrend: TimeSeriesPoint[];
  channelBreakdown: ChannelBreakdown[];
  productPerformance: ProductPerformance[];
  acquisitionFunnel: FunnelStep[];
  campaignPerformance: CampaignPerformanceRow[];
}
