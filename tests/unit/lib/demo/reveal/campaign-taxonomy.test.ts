import {
  UTM_TAXONOMY,
  DEFAULT_UTM,
  resolveUtm,
  classifyUtm,
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
