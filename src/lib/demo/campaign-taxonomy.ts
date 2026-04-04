/**
 * Client-side campaign taxonomy classification.
 * Mirrors the BigQuery AI.CLASSIFY logic from Phase 5 Dataform models.
 * Classifies raw UTM parameters into a standardized taxonomy.
 */

export interface UtmParams {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
}

export interface ClassifiedCampaign {
  platform: string;
  campaignType: string;
  audience: string;
  confidence: number;
}

const PLATFORM_MAP: Record<string, string> = {
  meta: 'Meta',
  facebook: 'Meta',
  fb: 'Meta',
  instagram: 'Meta',
  ig: 'Meta',
  google: 'Google Ads',
  gads: 'Google Ads',
  adwords: 'Google Ads',
  tiktok: 'TikTok',
  tt: 'TikTok',
  email: 'Email',
  mailchimp: 'Email',
  klaviyo: 'Email',
  linkedin: 'LinkedIn',
  li: 'LinkedIn',
  bing: 'Microsoft Ads',
  msn: 'Microsoft Ads',
};

const CAMPAIGN_TYPE_PATTERNS: [RegExp, string][] = [
  [/prospect/i, 'Prospecting'],
  [/retarget/i, 'Retargeting'],
  [/remarket/i, 'Retargeting'],
  [/brand/i, 'Brand'],
  [/generic/i, 'Generic'],
  [/non.?brand/i, 'Generic'],
  [/lal|lookalike/i, 'Lookalike'],
  [/dpa|dynamic.?product/i, 'Dynamic Product'],
  [/conv/i, 'Conversion'],
  [/aware/i, 'Awareness'],
  [/nurture/i, 'Nurture'],
  [/welcome/i, 'Welcome'],
  [/cart.?abandon/i, 'Cart Abandonment'],
];

const AUDIENCE_PATTERNS: [RegExp, string][] = [
  [/lal|lookalike/i, 'Lookalike'],
  [/broad/i, 'Broad'],
  [/interest/i, 'Interest-Based'],
  [/custom/i, 'Custom Audience'],
  [/retarget|remarket/i, 'Retargeting'],
  [/subscriber/i, 'Subscribers'],
  [/vip/i, 'VIP'],
  [/all/i, 'All'],
];

export function extractUtmParams(url: string): UtmParams {
  try {
    const parsed = new URL(url);
    return {
      utm_source: parsed.searchParams.get('utm_source'),
      utm_medium: parsed.searchParams.get('utm_medium'),
      utm_campaign: parsed.searchParams.get('utm_campaign'),
      utm_term: parsed.searchParams.get('utm_term'),
      utm_content: parsed.searchParams.get('utm_content'),
    };
  } catch {
    return {
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
    };
  }
}

export function classifyCampaign(utms: UtmParams): ClassifiedCampaign {
  if (!utms.utm_source && !utms.utm_campaign) {
    return { platform: 'Direct', campaignType: 'Direct', audience: 'N/A', confidence: 1.0 };
  }

  const source = (utms.utm_source ?? '').toLowerCase();
  const campaign = (utms.utm_campaign ?? '').toLowerCase();
  const combined = `${source} ${campaign} ${utms.utm_medium ?? ''} ${utms.utm_content ?? ''}`;

  // Platform
  const platform = PLATFORM_MAP[source] ?? capitalizeFirst(source);

  // Campaign type
  let campaignType = 'Unclassified';
  let confidence = 0.6;
  for (const [pattern, label] of CAMPAIGN_TYPE_PATTERNS) {
    if (pattern.test(campaign) || pattern.test(combined)) {
      campaignType = label;
      confidence = 0.92;
      break;
    }
  }

  // Audience
  let audience = 'General';
  for (const [pattern, label] of AUDIENCE_PATTERNS) {
    if (pattern.test(campaign) || pattern.test(combined)) {
      audience = label;
      break;
    }
  }

  return { platform, campaignType, audience, confidence };
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
