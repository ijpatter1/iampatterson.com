/**
 * Core types for the background data generator.
 *
 * These define the configuration schema, business model profiles,
 * channel definitions, and synthetic event shapes.
 */

// ---------------------------------------------------------------------------
// Business models
// ---------------------------------------------------------------------------

export type BusinessModel = 'ecommerce' | 'subscription' | 'leadgen';

// ---------------------------------------------------------------------------
// Channel & campaign definitions
// ---------------------------------------------------------------------------

export type Platform = 'google' | 'meta' | 'tiktok' | 'email' | 'organic' | 'direct';

export interface ChannelConfig {
  /** Platform identifier. */
  platform: Platform;
  /** Share of traffic from this channel (0–1, all channels should sum to ~1). */
  trafficShare: number;
  /** Campaign definitions for this channel. */
  campaigns: CampaignConfig[];
}

export interface CampaignConfig {
  /** Canonical campaign name (used internally). */
  name: string;
  /**
   * UTM-style names as they would appear across platforms.
   * Includes intentional inconsistencies (casing, abbreviations, delimiters)
   * for the campaign taxonomy layer to clean up.
   */
  utmVariants: string[];
  /** Monthly spend in dollars (used for ad platform data generation). */
  monthlySpend: number;
  /** Average CPC for this campaign. */
  avgCpc: number;
  /** Click-through rate (0–1). */
  ctr: number;
}

// ---------------------------------------------------------------------------
// E-commerce specific
// ---------------------------------------------------------------------------

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  /** Relative popularity weight (higher = more likely to be viewed/purchased). */
  weight: number;
}

export interface EcommerceProfile {
  model: 'ecommerce';
  products: Product[];
  /** Average order value target — actual AOV emerges from product mix. */
  targetAov: number;
  /** Funnel conversion rates. */
  funnelRates: {
    viewToCart: number;
    cartToCheckout: number;
    checkoutToPurchase: number;
  };
  /** Average items per order. */
  avgItemsPerOrder: number;
}

// ---------------------------------------------------------------------------
// Subscription specific
// ---------------------------------------------------------------------------

export interface SubscriptionPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  /** Share of new signups choosing this plan (0–1, all plans sum to ~1). */
  signupShare: number;
}

export interface SubscriptionProfile {
  model: 'subscription';
  plans: SubscriptionPlan[];
  /** Trial-to-paid conversion rate (0–1). */
  trialConversionRate: number;
  /** Monthly churn rates by cohort age (month 1, month 2, ...). */
  churnCurve: number[];
  /** Upgrade rate per month (fraction of active subscribers). */
  upgradeRate: number;
  /** Downgrade rate per month. */
  downgradeRate: number;
}

// ---------------------------------------------------------------------------
// Lead gen specific
// ---------------------------------------------------------------------------

export type PartnershipType =
  | 'sponsored_content'
  | 'product_collaboration'
  | 'event_sponsorship'
  | 'licensing'
  | 'not_sure';

export type BudgetRange = 'under_5k' | '5k_15k' | '15k_50k' | '50k_plus' | 'prefer_to_discuss';

export interface LeadGenProfile {
  model: 'leadgen';
  /** Form start rate (fraction of page visitors who begin filling the form). */
  formStartRate: number;
  /** Form completion rate (fraction of form starters who submit). */
  formCompletionRate: number;
  /** Lead qualification rate (fraction of submissions that are qualified). */
  qualificationRate: number;
  /** Meeting conversion rate (fraction of qualified leads that book a meeting). */
  meetingRate: number;
  /** Distribution of partnership types chosen (should sum to ~1). */
  partnershipDistribution: Record<PartnershipType, number>;
  /** Distribution of budget ranges chosen (should sum to ~1). */
  budgetDistribution: Record<BudgetRange, number>;
}

// ---------------------------------------------------------------------------
// Union profile type
// ---------------------------------------------------------------------------

export type BusinessModelProfile = EcommerceProfile | SubscriptionProfile | LeadGenProfile;

// ---------------------------------------------------------------------------
// Seasonality
// ---------------------------------------------------------------------------

export interface SeasonalityConfig {
  /** Monthly multipliers (Jan=0 through Dec=11). 1.0 = baseline. */
  monthly: [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  /** Day-of-week multipliers (Sun=0 through Sat=6). 1.0 = baseline. */
  dayOfWeek: [number, number, number, number, number, number, number];
  /** Hour-of-day multipliers (0–23). 1.0 = baseline. */
  hourOfDay: [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
}

// ---------------------------------------------------------------------------
// Top-level generator config
// ---------------------------------------------------------------------------

export interface GeneratorConfig {
  /** Which business model this config targets. */
  businessModel: BusinessModel;
  /** Business-model-specific profile. */
  profile: BusinessModelProfile;
  /** Channel & campaign configuration. */
  channels: ChannelConfig[];
  /** Seasonality curves. */
  seasonality: SeasonalityConfig;
  /** Baseline daily sessions (before seasonality multipliers). */
  dailySessions: number;
  /** How many months of historical data to generate on first run. */
  backfillMonths: number;
  /** Growth rate per month (e.g. 0.03 = 3% MoM growth). */
  monthlyGrowthRate: number;
  /** Random seed for reproducible generation (optional). */
  seed?: number;
}

// ---------------------------------------------------------------------------
// Synthetic events (output of the generator)
// ---------------------------------------------------------------------------

/** Base shape matching the site's data layer BaseEvent. */
export interface SyntheticBaseEvent {
  iap_source: true;
  event: string;
  timestamp: string;
  session_id: string;
  iap_session_id: string;
  page_path: string;
  page_title: string;
  consent_analytics: boolean;
  consent_marketing: boolean;
  consent_preferences: boolean;
  /** UTM parameters for attribution. */
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

/** Page view event (all business models). */
export interface SyntheticPageViewEvent extends SyntheticBaseEvent {
  event: 'page_view';
  page_referrer: string;
}

/** E-commerce events. */
export interface ProductViewEvent extends SyntheticBaseEvent {
  event: 'product_view';
  product_id: string;
  product_name: string;
  product_price: number;
  product_category: string;
}

export interface AddToCartEvent extends SyntheticBaseEvent {
  event: 'add_to_cart';
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
}

export interface BeginCheckoutEvent extends SyntheticBaseEvent {
  event: 'begin_checkout';
  cart_total: number;
  item_count: number;
}

export interface PurchaseEvent extends SyntheticBaseEvent {
  event: 'purchase';
  order_id: string;
  order_total: number;
  item_count: number;
  products: Array<{ product_id: string; product_name: string; price: number; quantity: number }>;
}

/** Subscription events. */
export interface TrialSignupEvent extends SyntheticBaseEvent {
  event: 'trial_signup';
  plan_id: string;
  plan_name: string;
  plan_price: number;
}

export interface PlanSelectEvent extends SyntheticBaseEvent {
  event: 'plan_select';
  plan_id: string;
  plan_name: string;
  plan_price: number;
}

export interface SubscriptionRenewalEvent extends SyntheticBaseEvent {
  event: 'subscription_renewal';
  plan_id: string;
  plan_name: string;
  renewal_month: number;
  revenue: number;
}

export interface SubscriptionChurnEvent extends SyntheticBaseEvent {
  event: 'subscription_churn';
  plan_id: string;
  plan_name: string;
  tenure_months: number;
  reason: string;
}

/** Lead gen events. */
export interface FormCompleteEvent extends SyntheticBaseEvent {
  event: 'form_complete';
  form_name: string;
  partnership_type: PartnershipType;
  budget_range: BudgetRange;
  company_name: string;
}

export interface LeadQualifyEvent extends SyntheticBaseEvent {
  event: 'lead_qualify';
  lead_id: string;
  qualification_tier: 'high' | 'medium' | 'low';
  partnership_type: PartnershipType;
  budget_range: BudgetRange;
}

/** Union of all synthetic event types. */
export type SyntheticEvent =
  | SyntheticBaseEvent
  | SyntheticPageViewEvent
  | ProductViewEvent
  | AddToCartEvent
  | BeginCheckoutEvent
  | PurchaseEvent
  | TrialSignupEvent
  | PlanSelectEvent
  | SubscriptionRenewalEvent
  | SubscriptionChurnEvent
  | FormCompleteEvent
  | LeadQualifyEvent;

// ---------------------------------------------------------------------------
// Ad platform data (separate from event stream)
// ---------------------------------------------------------------------------

export interface AdPlatformRecord {
  date: string;
  platform: Platform;
  campaign_name: string;
  /** Raw campaign name with intentional inconsistencies. */
  campaign_name_raw: string;
  impressions: number;
  clicks: number;
  spend: number;
  /** Cost per click (derived). */
  cpc: number;
  /** Click-through rate (derived). */
  ctr: number;
}
