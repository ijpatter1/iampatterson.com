/**
 * Dashboard data types matching BigQuery Dataform mart schemas.
 * These interfaces mirror the column schemas from mart_campaign_performance,
 * mart_channel_attribution, mart_customer_ltv, mart_subscription_cohorts,
 * and mart_lead_funnel.
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

// --- Subscription Dashboard Types ---

export interface SubscriptionCohortRow {
  cohort_month: string;
  plan_id: string;
  plan_name: string;
  plan_price: number;
  utm_source: string;
  utm_medium: string;
  session_id: string;
  signup_at: string;
  total_renewals: number;
  total_renewal_revenue: number;
  lifetime_revenue: number;
  last_renewal_month: number;
  has_churned: boolean;
  churn_at: string | null;
  tenure_at_churn: number | null;
  churn_reason: string | null;
  days_active: number;
}

// --- Lead Gen Dashboard Types ---

export interface LeadFunnelRow {
  session_id: string;
  session_start: string;
  report_month: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  has_page_view: boolean;
  has_form_start: boolean;
  has_form_complete: boolean;
  has_lead_qualify: boolean;
  funnel_stage: 'visited' | 'started' | 'submitted' | 'qualified' | 'unknown';
  partnership_type: string | null;
  budget_range: string | null;
  company_name: string | null;
  lead_id: string | null;
  qualification_tier: string | null;
  fields_interacted: number;
  scroll_events: number;
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

export interface CohortData {
  cohortMonth: string;
  signups: number;
  retentionByMonth: number[]; // percentage retained at month 1, 2, 3...
}

export interface ChurnBreakdown {
  reason: string;
  count: number;
  percentage: number;
}

export interface LeadQualityBreakdown {
  tier: string;
  count: number;
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

export interface SubscriptionDashboardData {
  kpis: KpiMetric[];
  mrrTrend: TimeSeriesPoint[];
  cohortRetention: CohortData[];
  trialConversionByChannel: ChannelBreakdown[];
  churnBreakdown: ChurnBreakdown[];
  ltvBySource: { source: string; avgLtv: number; customers: number }[];
}

export interface LeadGenDashboardData {
  kpis: KpiMetric[];
  leadVolumeTrend: TimeSeriesPoint[];
  funnel: FunnelStep[];
  costPerLeadByChannel: { channel: string; costPerLead: number; leads: number; spend: number }[];
  qualityDistribution: LeadQualityBreakdown[];
  conversionTimeline: TimeSeriesPoint[];
}
