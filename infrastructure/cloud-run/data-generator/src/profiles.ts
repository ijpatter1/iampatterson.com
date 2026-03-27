/**
 * Default business model profiles and channel configs for the three demos.
 *
 * Products, plans, and campaigns are based on the Tuna brand
 * from docs/CONTENT_GUIDE.md.
 */

import type {
  BusinessModel,
  ChannelConfig,
  EcommerceProfile,
  GeneratorConfig,
  LeadGenProfile,
  SeasonalityConfig,
  SubscriptionProfile,
} from './types';

// ---------------------------------------------------------------------------
// Shared seasonality curves
// ---------------------------------------------------------------------------

const defaultSeasonality: SeasonalityConfig = {
  // Jan–Dec: dip in Jan, build through spring, summer lull, holiday spike
  monthly: [0.8, 0.85, 0.95, 1.0, 1.05, 0.95, 0.9, 0.9, 1.0, 1.1, 1.3, 1.5],
  // Sun–Sat: lower weekends for B2B, higher for B2C
  dayOfWeek: [0.7, 1.1, 1.15, 1.1, 1.1, 1.0, 0.75],
  // Hour 0–23: overnight low, morning ramp, lunch peak, afternoon steady, evening peak, late drop
  hourOfDay: [
    0.2, 0.15, 0.1, 0.1, 0.1, 0.15,
    0.3, 0.6, 0.9, 1.1, 1.2, 1.3,
    1.2, 1.1, 1.0, 1.0, 1.1, 1.2,
    1.3, 1.2, 1.0, 0.8, 0.5, 0.3,
  ],
};

const b2bSeasonality: SeasonalityConfig = {
  ...defaultSeasonality,
  // Weekdays stronger, weekends much lower for B2B
  dayOfWeek: [0.3, 1.2, 1.25, 1.2, 1.15, 1.0, 0.35],
};

// ---------------------------------------------------------------------------
// E-commerce: Tuna Shop
// ---------------------------------------------------------------------------

const ecommerceChannels: ChannelConfig[] = [
  {
    platform: 'google',
    trafficShare: 0.3,
    campaigns: [
      {
        name: 'Google - Brand - Tuna Merch',
        utmVariants: [
          'google_brand_tuna_merch',
          'Google Brand - Tuna Merch',
          'g_brand_tunamerch',
          'google-brand-tuna-merch',
        ],
        monthlySpend: 800,
        avgCpc: 0.45,
        ctr: 0.08,
      },
      {
        name: 'Google - Shopping - All Products',
        utmVariants: [
          'google_shopping_all',
          'Google Shopping - All Products',
          'g_shopping_allproducts',
          'GOOGLE_SHOPPING_ALL',
        ],
        monthlySpend: 1200,
        avgCpc: 0.35,
        ctr: 0.04,
      },
      {
        name: 'Google - Prospecting - Cat Lovers',
        utmVariants: [
          'google_prosp_catlovers',
          'Google Prospecting Cat Lovers',
          'g_prospect_cat-lovers',
        ],
        monthlySpend: 600,
        avgCpc: 0.55,
        ctr: 0.03,
      },
    ],
  },
  {
    platform: 'meta',
    trafficShare: 0.35,
    campaigns: [
      {
        name: 'Meta - Retargeting - Cart Abandoners',
        utmVariants: [
          'meta_retarget_cart',
          'FB Retargeting - Cart Abandoners',
          'fb_rtg_cart_abandoners',
          'Meta-Retargeting-CartAbandoners',
        ],
        monthlySpend: 500,
        avgCpc: 0.6,
        ctr: 0.025,
      },
      {
        name: 'Meta - Lookalike - Purchasers',
        utmVariants: [
          'meta_lal_purchasers',
          'FB LAL Purchasers 1%',
          'meta-lookalike-purchasers',
          'fb_lal_purch_1pct',
        ],
        monthlySpend: 900,
        avgCpc: 0.5,
        ctr: 0.02,
      },
      {
        name: 'Meta - Broad - Cat Content',
        utmVariants: [
          'meta_broad_catcontent',
          'FB Broad Cat Content',
          'META_BROAD_CAT',
          'meta-broad-cat-content',
        ],
        monthlySpend: 700,
        avgCpc: 0.4,
        ctr: 0.015,
      },
    ],
  },
  {
    platform: 'tiktok',
    trafficShare: 0.1,
    campaigns: [
      {
        name: 'TikTok - Interest - Pet Owners',
        utmVariants: [
          'tiktok_interest_pets',
          'TT Interest - Pet Owners',
          'tt_int_petowners',
          'tiktok-interest-petowners',
        ],
        monthlySpend: 400,
        avgCpc: 0.3,
        ctr: 0.012,
      },
    ],
  },
  {
    platform: 'email',
    trafficShare: 0.1,
    campaigns: [
      {
        name: 'Email - Newsletter - Weekly',
        utmVariants: [
          'email_newsletter_weekly',
          'Email Newsletter Weekly',
          'email-newsletter-wkly',
        ],
        monthlySpend: 0,
        avgCpc: 0,
        ctr: 0.15,
      },
      {
        name: 'Email - Promo - Seasonal Sale',
        utmVariants: [
          'email_promo_seasonal',
          'Email Promo - Seasonal Sale',
          'email-promo-sale',
        ],
        monthlySpend: 0,
        avgCpc: 0,
        ctr: 0.12,
      },
    ],
  },
  {
    platform: 'organic',
    trafficShare: 0.1,
    campaigns: [],
  },
  {
    platform: 'direct',
    trafficShare: 0.05,
    campaigns: [],
  },
];

const ecommerceProfile: EcommerceProfile = {
  model: 'ecommerce',
  products: [
    { id: 'tuna-plush', name: 'Tuna Plush Toy', price: 24.99, category: 'toys', weight: 3 },
    { id: 'tuna-calendar', name: 'Tuna 2026 Calendar', price: 19.99, category: 'accessories', weight: 2.5 },
    { id: 'tuna-pin-set', name: 'Tuna Enamel Pin Set', price: 14.99, category: 'accessories', weight: 2 },
    { id: 'tuna-tote', name: 'Tuna Tote Bag', price: 29.99, category: 'bags', weight: 1.5 },
    { id: 'tuna-ornament', name: 'Tuna Holiday Ornament', price: 12.99, category: 'seasonal', weight: 1.5 },
    { id: 'tuna-mug', name: 'Tuna Mug', price: 17.99, category: 'kitchen', weight: 2 },
  ],
  targetAov: 28.0,
  funnelRates: {
    viewToCart: 0.12,
    cartToCheckout: 0.55,
    checkoutToPurchase: 0.75,
  },
  avgItemsPerOrder: 1.6,
};

// ---------------------------------------------------------------------------
// Subscription: Tuna Subscription Box
// ---------------------------------------------------------------------------

const subscriptionChannels: ChannelConfig[] = [
  {
    platform: 'google',
    trafficShare: 0.25,
    campaigns: [
      {
        name: 'Google - Brand - Tuna Sub Box',
        utmVariants: [
          'google_brand_tuna_sub',
          'Google Brand Tuna Subscription',
          'g_brand_tunasub',
          'GOOGLE_BRAND_TUNA_SUB',
        ],
        monthlySpend: 600,
        avgCpc: 0.5,
        ctr: 0.07,
      },
      {
        name: 'Google - Search - Cat Subscription Box',
        utmVariants: [
          'google_search_catsub',
          'Google Search - Cat Subscription Box',
          'g_srch_cat_sub_box',
        ],
        monthlySpend: 900,
        avgCpc: 0.65,
        ctr: 0.05,
      },
    ],
  },
  {
    platform: 'meta',
    trafficShare: 0.35,
    campaigns: [
      {
        name: 'Meta - Broad - Pet Subscriptions',
        utmVariants: [
          'meta_broad_petsub',
          'FB Broad Pet Subscriptions',
          'meta-broad-pet-subs',
          'fb_broad_petsubs',
        ],
        monthlySpend: 1100,
        avgCpc: 0.45,
        ctr: 0.02,
      },
      {
        name: 'Meta - Retargeting - Trial Visitors',
        utmVariants: [
          'meta_rtg_trial',
          'FB Retargeting Trial Visitors',
          'meta-retarget-trial-visitors',
        ],
        monthlySpend: 400,
        avgCpc: 0.55,
        ctr: 0.035,
      },
    ],
  },
  {
    platform: 'tiktok',
    trafficShare: 0.15,
    campaigns: [
      {
        name: 'TikTok - Creator - Unboxing',
        utmVariants: [
          'tiktok_creator_unbox',
          'TT Creator Unboxing',
          'tt_creator_unboxing_2024',
        ],
        monthlySpend: 500,
        avgCpc: 0.25,
        ctr: 0.01,
      },
    ],
  },
  {
    platform: 'email',
    trafficShare: 0.1,
    campaigns: [
      {
        name: 'Email - Win-back - Lapsed Subscribers',
        utmVariants: [
          'email_winback_lapsed',
          'Email Win-Back Lapsed',
          'email-winback-lapsed-subs',
        ],
        monthlySpend: 0,
        avgCpc: 0,
        ctr: 0.1,
      },
    ],
  },
  {
    platform: 'organic',
    trafficShare: 0.1,
    campaigns: [],
  },
  {
    platform: 'direct',
    trafficShare: 0.05,
    campaigns: [],
  },
];

const subscriptionProfile: SubscriptionProfile = {
  model: 'subscription',
  plans: [
    { id: 'pup', name: 'The Pup', monthlyPrice: 19.99, signupShare: 0.35 },
    { id: 'good-boy', name: 'The Good Boy', monthlyPrice: 34.99, signupShare: 0.45 },
    { id: 'big-tuna', name: 'The Big Tuna', monthlyPrice: 49.99, signupShare: 0.2 },
  ],
  trialConversionRate: 0.62,
  // Monthly churn curve: high early, decreasing over time
  churnCurve: [0.15, 0.10, 0.08, 0.06, 0.05, 0.04, 0.035, 0.03, 0.025, 0.02, 0.02, 0.02],
  upgradeRate: 0.03,
  downgradeRate: 0.015,
};

// ---------------------------------------------------------------------------
// Lead gen: Tuna Brand Partnerships
// ---------------------------------------------------------------------------

const leadgenChannels: ChannelConfig[] = [
  {
    platform: 'google',
    trafficShare: 0.3,
    campaigns: [
      {
        name: 'Google - Search - Pet Brand Partnerships',
        utmVariants: [
          'google_search_petpartner',
          'Google Search Pet Brand Partnerships',
          'g_srch_pet_brand_partner',
        ],
        monthlySpend: 500,
        avgCpc: 1.2,
        ctr: 0.04,
      },
      {
        name: 'Google - Search - Influencer Collab',
        utmVariants: [
          'google_search_influencer',
          'Google Search - Influencer Collab',
          'g_srch_influencer_collab',
          'GOOGLE_SEARCH_INFLUENCER',
        ],
        monthlySpend: 400,
        avgCpc: 1.5,
        ctr: 0.035,
      },
    ],
  },
  {
    platform: 'meta',
    trafficShare: 0.25,
    campaigns: [
      {
        name: 'Meta - B2B - Brand Decision Makers',
        utmVariants: [
          'meta_b2b_decisionmakers',
          'FB B2B Brand Decision Makers',
          'meta-b2b-decision-makers',
        ],
        monthlySpend: 600,
        avgCpc: 1.8,
        ctr: 0.015,
      },
    ],
  },
  {
    platform: 'organic',
    trafficShare: 0.25,
    campaigns: [],
  },
  {
    platform: 'direct',
    trafficShare: 0.1,
    campaigns: [],
  },
  {
    platform: 'email',
    trafficShare: 0.1,
    campaigns: [
      {
        name: 'Email - Outreach - Brand Contacts',
        utmVariants: [
          'email_outreach_brands',
          'Email Outreach - Brand Contacts',
          'email-outreach-brands',
        ],
        monthlySpend: 0,
        avgCpc: 0,
        ctr: 0.08,
      },
    ],
  },
];

const leadgenProfile: LeadGenProfile = {
  model: 'leadgen',
  formStartRate: 0.25,
  formCompletionRate: 0.45,
  qualificationRate: 0.4,
  meetingRate: 0.35,
  partnershipDistribution: {
    sponsored_content: 0.3,
    product_collaboration: 0.25,
    event_sponsorship: 0.15,
    licensing: 0.15,
    not_sure: 0.15,
  },
  budgetDistribution: {
    under_5k: 0.2,
    '5k_15k': 0.3,
    '15k_50k': 0.25,
    '50k_plus': 0.1,
    prefer_to_discuss: 0.15,
  },
};

// ---------------------------------------------------------------------------
// Full configs
// ---------------------------------------------------------------------------

function clone<T>(obj: T): T {
  return structuredClone(obj);
}

export function createEcommerceConfig(overrides?: Partial<GeneratorConfig>): GeneratorConfig {
  return {
    businessModel: 'ecommerce',
    profile: clone(ecommerceProfile),
    channels: clone(ecommerceChannels),
    seasonality: clone(defaultSeasonality),
    dailySessions: 250,
    backfillMonths: 18,
    monthlyGrowthRate: 0.04,
    ...overrides,
  };
}

export function createSubscriptionConfig(overrides?: Partial<GeneratorConfig>): GeneratorConfig {
  return {
    businessModel: 'subscription',
    profile: clone(subscriptionProfile),
    channels: clone(subscriptionChannels),
    seasonality: clone(defaultSeasonality),
    dailySessions: 180,
    backfillMonths: 18,
    monthlyGrowthRate: 0.05,
    ...overrides,
  };
}

export function createLeadgenConfig(overrides?: Partial<GeneratorConfig>): GeneratorConfig {
  return {
    businessModel: 'leadgen',
    profile: clone(leadgenProfile),
    channels: clone(leadgenChannels),
    seasonality: clone(b2bSeasonality),
    dailySessions: 80,
    backfillMonths: 18,
    monthlyGrowthRate: 0.03,
    ...overrides,
  };
}

export function createConfig(model: BusinessModel, overrides?: Partial<GeneratorConfig>): GeneratorConfig {
  switch (model) {
    case 'ecommerce':
      return createEcommerceConfig(overrides);
    case 'subscription':
      return createSubscriptionConfig(overrides);
    case 'leadgen':
      return createLeadgenConfig(overrides);
    default: {
      const _exhaustive: never = model;
      throw new Error(`Unknown business model: ${_exhaustive}`);
    }
  }
}
