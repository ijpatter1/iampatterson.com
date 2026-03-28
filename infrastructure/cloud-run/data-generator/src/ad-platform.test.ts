import { generateAdPlatformData } from './ad-platform';
import { createEcommerceConfig, createLeadgenConfig } from './profiles';
import { SeededRandom } from './random';

describe('generateAdPlatformData', () => {
  it('generates records for each campaign per day', () => {
    const config = createEcommerceConfig({ seed: 42 });
    const rng = new SeededRandom(42);
    const startDate = new Date('2025-06-01');
    const endDate = new Date('2025-06-03'); // 3 days

    const records = generateAdPlatformData(config, startDate, endDate, rng);

    // Count paid campaigns (non-zero spend)
    const paidCampaigns = config.channels.reduce(
      (count, ch) => count + ch.campaigns.filter((c) => c.monthlySpend > 0).length,
      0,
    );

    // Should have records for each paid campaign for each day
    expect(records.length).toBe(paidCampaigns * 3);
  });

  it('does not generate records for organic or email channels (zero spend)', () => {
    const config = createEcommerceConfig({ seed: 42 });
    const rng = new SeededRandom(42);
    const records = generateAdPlatformData(
      config,
      new Date('2025-06-01'),
      new Date('2025-06-01'),
      rng,
    );

    const platforms = new Set(records.map((r) => r.platform));
    expect(platforms).not.toContain('organic');
    expect(platforms).not.toContain('direct');
    // Email campaigns in ecommerce have $0 spend, so no records
  });

  it('records have valid numeric fields', () => {
    const config = createEcommerceConfig({ seed: 42 });
    const rng = new SeededRandom(42);
    const records = generateAdPlatformData(
      config,
      new Date('2025-06-01'),
      new Date('2025-06-07'),
      rng,
    );

    for (const record of records) {
      expect(record.impressions).toBeGreaterThanOrEqual(0);
      expect(record.clicks).toBeGreaterThanOrEqual(0);
      expect(record.spend).toBeGreaterThanOrEqual(0);
      expect(record.clicks).toBeLessThanOrEqual(record.impressions);
      expect(record.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('campaign_name_raw differs from campaign_name (naming inconsistencies)', () => {
    const config = createEcommerceConfig({ seed: 42 });
    const rng = new SeededRandom(42);
    const records = generateAdPlatformData(
      config,
      new Date('2025-06-01'),
      new Date('2025-06-30'),
      rng,
    );

    // Over 30 days, we should see raw names differing from canonical names
    const differentNames = records.filter((r) => r.campaign_name !== r.campaign_name_raw);
    expect(differentNames.length).toBeGreaterThan(0);
  });

  it('spend varies with seasonality (holidays > summer)', () => {
    const config = createEcommerceConfig({ seed: 42 });
    const rng1 = new SeededRandom(42);
    const rng2 = new SeededRandom(42);

    // June (summer, lower seasonality)
    const juneRecords = generateAdPlatformData(
      config,
      new Date('2025-06-01'),
      new Date('2025-06-30'),
      rng1,
    );
    const juneSpend = juneRecords.reduce((sum, r) => sum + r.spend, 0);

    // December (holiday, higher seasonality)
    const decRecords = generateAdPlatformData(
      config,
      new Date('2025-12-01'),
      new Date('2025-12-30'),
      rng2,
    );
    const decSpend = decRecords.reduce((sum, r) => sum + r.spend, 0);

    expect(decSpend).toBeGreaterThan(juneSpend);
  });

  it('is reproducible with the same seed', () => {
    const config = createEcommerceConfig({ seed: 42 });
    const rng1 = new SeededRandom(123);
    const rng2 = new SeededRandom(123);
    const start = new Date('2025-06-01');
    const end = new Date('2025-06-07');

    const records1 = generateAdPlatformData(config, start, end, rng1);
    const records2 = generateAdPlatformData(config, start, end, rng2);

    expect(records1.length).toBe(records2.length);
    for (let i = 0; i < records1.length; i++) {
      expect(records1[i].spend).toBe(records2[i].spend);
      expect(records1[i].campaign_name_raw).toBe(records2[i].campaign_name_raw);
    }
  });
});
