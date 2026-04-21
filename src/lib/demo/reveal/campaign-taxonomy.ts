/**
 * Tuna Shop UTM seed taxonomy (Phase 9F deliverable 5).
 *
 * Mirrors `docs/input_artifacts/design_handoff_ecommerce/app/data.js`'s
 * UTM_TAXONOMY map. Drives the listing-page session-boot toast cascade
 * (`taxonomy_classified` toast) and the listing-hero `your-utm` /
 * `classified-as` panel below the editorial copy.
 *
 * Distinct from the generic `src/lib/demo/campaign-taxonomy.ts` regex
 * classifier (which mirrors the Phase 5 BigQuery AI.CLASSIFY logic) — this
 * module is a lookup over real Tuna Shop demo seeds, deterministic for
 * screenshots and tests, and falls back to "Unclassified" rather than
 * pattern-matching on arbitrary inputs. Pre-9E `CampaignTaxonomyUnderside`
 * salvage destination per the doc spec.
 */

export interface CampaignClassification {
  source: string;
  medium: string;
  bucket: string;
}

export const UTM_TAXONOMY: Record<string, CampaignClassification> = {
  meta_prospecting_lal_tuna_q1: {
    source: 'Meta',
    medium: 'paid_social',
    bucket: 'Prospecting · Lookalike',
  },
  meta_retargeting_atc_q1: {
    source: 'Meta',
    medium: 'paid_social',
    bucket: 'Retargeting · ATC',
  },
  google_brand_tuna: {
    source: 'Google',
    medium: 'cpc',
    bucket: 'Brand · Search',
  },
  google_nonbrand_plush_toys: {
    source: 'Google',
    medium: 'cpc',
    bucket: 'Non-brand · Search',
  },
  tiktok_creative_unboxing_v3: {
    source: 'TikTok',
    medium: 'paid_social',
    bucket: 'Creative · UGC',
  },
  klaviyo_welcome_flow_3: {
    source: 'Email',
    medium: 'email',
    bucket: 'Lifecycle · Welcome',
  },
  organic_newsletter_april: {
    source: 'Email',
    medium: 'email',
    bucket: 'Newsletter · Monthly',
  },
};

/**
 * Default UTM campaign seed used when no `utm_campaign` is present in
 * `searchParams`. Deterministic — picked once and pinned so tests and
 * screenshots are reproducible. Do NOT change to a randomised pick.
 */
export const DEFAULT_UTM = 'meta_prospecting_lal_tuna_q1';

/**
 * Resolve the visitor's effective `utm_campaign` from a search-params-like
 * input. Returns the explicit value when present (even if unknown to the
 * taxonomy — the caller decides whether to display "unclassified" or fall
 * back); otherwise the deterministic default seed.
 */
export function resolveUtm(params: { utm_campaign?: string | null }): string {
  const explicit = params.utm_campaign;
  if (typeof explicit === 'string' && explicit.length > 0) return explicit;
  return DEFAULT_UTM;
}

/**
 * Classify a campaign id against the seed taxonomy. Returns an
 * `Unclassified` placeholder when the id isn't in the seed map — preserves
 * the visitor-facing "we don't pretend to recognise everything" honesty.
 */
export function classifyUtm(campaignId: string): CampaignClassification {
  const hit = UTM_TAXONOMY[campaignId];
  if (hit) return hit;
  return { source: 'Unknown', medium: 'unknown', bucket: 'Unclassified' };
}
