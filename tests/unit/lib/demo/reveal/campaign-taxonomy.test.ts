import {
  UTM_TAXONOMY,
  DEFAULT_UTM,
  resolveUtm,
  classifyUtm,
  pickRandomSeedCampaign,
  randomUtmSeedParams,
} from '@/lib/demo/reveal/campaign-taxonomy';

describe('reveal/campaign-taxonomy — UTM_TAXONOMY seed map', () => {
  it('mirrors the prototype seed entries', () => {
    expect(Object.keys(UTM_TAXONOMY)).toEqual([
      'meta_prospecting_lal_tuna_q1',
      'meta_retargeting_atc_q1',
      'google_brand_tuna',
      'google_nonbrand_plush_toys',
      'tiktok_creative_unboxing_v3',
      'klaviyo_welcome_flow_3',
      'organic_newsletter_april',
    ]);
  });

  it('each seed has source, medium, bucket', () => {
    for (const [, meta] of Object.entries(UTM_TAXONOMY)) {
      expect(meta.source).toBeTruthy();
      expect(meta.medium).toBeTruthy();
      expect(meta.bucket).toBeTruthy();
    }
  });

  it('default seed is the meta prospecting LAL campaign', () => {
    expect(DEFAULT_UTM).toBe('meta_prospecting_lal_tuna_q1');
    expect(UTM_TAXONOMY[DEFAULT_UTM]).toEqual({
      source: 'Meta',
      medium: 'paid_social',
      bucket: 'Prospecting · Lookalike',
    });
  });
});

describe('resolveUtm', () => {
  it('returns the utm_campaign param when present and known', () => {
    expect(resolveUtm({ utm_campaign: 'google_brand_tuna' })).toBe('google_brand_tuna');
  });

  it('returns the utm_campaign param even when unknown (caller decides classification fallback)', () => {
    expect(resolveUtm({ utm_campaign: 'totally_made_up' })).toBe('totally_made_up');
  });

  it('falls back to DEFAULT_UTM when utm_campaign is missing', () => {
    expect(resolveUtm({})).toBe(DEFAULT_UTM);
    expect(resolveUtm({ utm_campaign: null })).toBe(DEFAULT_UTM);
    expect(resolveUtm({ utm_campaign: undefined })).toBe(DEFAULT_UTM);
    expect(resolveUtm({ utm_campaign: '' })).toBe(DEFAULT_UTM);
  });
});

describe('classifyUtm', () => {
  it('returns the seed mapping when the campaign id is in the taxonomy', () => {
    expect(classifyUtm('google_brand_tuna')).toEqual({
      source: 'Google',
      medium: 'cpc',
      bucket: 'Brand · Search',
    });
  });

  it('returns an "Unclassified" bucket for unknown campaign ids', () => {
    const result = classifyUtm('xyzzy');
    expect(result.bucket).toBe('Unclassified');
    expect(result.source).toBe('Unknown');
  });
});

// UAT r2 item 6 — random-seed UTM helpers stamp the Enter-the-demo CTA
// with a realistic utm_* triple on every click. Correctness requires the
// source + medium to match the taxonomy entry for the returned campaign,
// otherwise the listing hero would show a campaign classified by
// classifyUtm that disagreed with the utm_source the visitor just
// received. Tech-evaluator Important finding.
describe('pickRandomSeedCampaign', () => {
  it('returns one of the taxonomy keys', () => {
    const keys = Object.keys(UTM_TAXONOMY);
    for (let i = 0; i < 20; i++) {
      expect(keys).toContain(pickRandomSeedCampaign());
    }
  });

  it('injectable rng makes the pick deterministic (pin rng=0 → first key)', () => {
    const keys = Object.keys(UTM_TAXONOMY);
    expect(pickRandomSeedCampaign(() => 0)).toBe(keys[0]);
  });

  it('injectable rng spans the full key range (pin rng=0.999 → last key)', () => {
    const keys = Object.keys(UTM_TAXONOMY);
    expect(pickRandomSeedCampaign(() => 0.999)).toBe(keys[keys.length - 1]);
  });
});

describe('randomUtmSeedParams', () => {
  it('returns all three utm_* params populated', () => {
    const params = randomUtmSeedParams();
    expect(params.utm_campaign).toBeTruthy();
    expect(params.utm_source).toBeTruthy();
    expect(params.utm_medium).toBeTruthy();
  });

  it('utm_source + utm_medium are consistent with the taxonomy entry for utm_campaign', () => {
    // Run 50 random picks; every triple must be internally consistent.
    // If randomUtmSeedParams swapped source/medium or read from a stale
    // lookup, this pin would fail because the listing hero would classify
    // the utm_campaign through classifyUtm and show source/medium that
    // disagreed with the URL-encoded source/medium.
    for (let i = 0; i < 50; i++) {
      const params = randomUtmSeedParams();
      const taxonomyEntry = UTM_TAXONOMY[params.utm_campaign];
      expect(taxonomyEntry).toBeDefined();
      expect(params.utm_source).toBe(taxonomyEntry.source.toLowerCase());
      expect(params.utm_medium).toBe(taxonomyEntry.medium);
    }
  });

  it('pinned rng=0 returns a triple matching the first taxonomy entry', () => {
    const keys = Object.keys(UTM_TAXONOMY);
    const firstCampaign = keys[0];
    const expected = UTM_TAXONOMY[firstCampaign];
    expect(randomUtmSeedParams(() => 0)).toEqual({
      utm_campaign: firstCampaign,
      utm_source: expected.source.toLowerCase(),
      utm_medium: expected.medium,
    });
  });
});
