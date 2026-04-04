import { extractUtmParams, classifyCampaign } from '@/lib/demo/campaign-taxonomy';

describe('extractUtmParams', () => {
  it('extracts all UTM params from a URL', () => {
    const utms = extractUtmParams(
      'https://example.com?utm_source=meta&utm_medium=paid&utm_campaign=prospecting_lal_q1&utm_term=tuna&utm_content=ad1',
    );
    expect(utms.utm_source).toBe('meta');
    expect(utms.utm_medium).toBe('paid');
    expect(utms.utm_campaign).toBe('prospecting_lal_q1');
    expect(utms.utm_term).toBe('tuna');
    expect(utms.utm_content).toBe('ad1');
  });

  it('returns nulls for missing UTM params', () => {
    const utms = extractUtmParams('https://example.com');
    expect(utms.utm_source).toBeNull();
    expect(utms.utm_campaign).toBeNull();
  });

  it('handles invalid URLs gracefully', () => {
    const utms = extractUtmParams('not-a-url');
    expect(utms.utm_source).toBeNull();
  });
});

describe('classifyCampaign', () => {
  it('classifies Meta prospecting lookalike campaign', () => {
    const result = classifyCampaign({
      utm_source: 'meta',
      utm_medium: 'paid',
      utm_campaign: 'prospecting_lal_tuna_q1',
      utm_term: null,
      utm_content: null,
    });
    expect(result.platform).toBe('Meta');
    expect(result.campaignType).toBe('Prospecting');
    expect(result.audience).toBe('Lookalike');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('classifies Google branded search', () => {
    const result = classifyCampaign({
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'brand_tuna_shop',
      utm_term: null,
      utm_content: null,
    });
    expect(result.platform).toBe('Google Ads');
    expect(result.campaignType).toBe('Brand');
  });

  it('classifies Facebook retargeting', () => {
    const result = classifyCampaign({
      utm_source: 'facebook',
      utm_medium: 'paid',
      utm_campaign: 'retargeting_cart_abandon',
      utm_term: null,
      utm_content: null,
    });
    expect(result.platform).toBe('Meta');
    expect(result.campaignType).toBe('Retargeting');
  });

  it('returns Direct for no UTMs', () => {
    const result = classifyCampaign({
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
    });
    expect(result.platform).toBe('Direct');
    expect(result.campaignType).toBe('Direct');
    expect(result.confidence).toBe(1.0);
  });

  it('handles TikTok source variants', () => {
    expect(
      classifyCampaign({
        utm_source: 'tiktok',
        utm_medium: 'paid',
        utm_campaign: 'awareness_broad',
        utm_term: null,
        utm_content: null,
      }).platform,
    ).toBe('TikTok');

    expect(
      classifyCampaign({
        utm_source: 'tt',
        utm_medium: 'paid',
        utm_campaign: 'awareness_broad',
        utm_term: null,
        utm_content: null,
      }).platform,
    ).toBe('TikTok');
  });

  it('classifies email campaigns', () => {
    const result = classifyCampaign({
      utm_source: 'email',
      utm_medium: 'email',
      utm_campaign: 'welcome_series_v2',
      utm_term: null,
      utm_content: null,
    });
    expect(result.platform).toBe('Email');
    expect(result.campaignType).toBe('Welcome');
  });

  it('falls back to Unclassified for unknown campaign types', () => {
    const result = classifyCampaign({
      utm_source: 'meta',
      utm_medium: 'paid',
      utm_campaign: 'abc123',
      utm_term: null,
      utm_content: null,
    });
    expect(result.platform).toBe('Meta');
    expect(result.campaignType).toBe('Unclassified');
    expect(result.confidence).toBeLessThan(0.8);
  });
});
