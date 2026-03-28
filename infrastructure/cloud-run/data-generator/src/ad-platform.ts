/**
 * Ad platform data generator — produces simulated campaign spend,
 * impressions, and clicks records for BigQuery.
 *
 * Includes intentional naming inconsistencies (raw campaign names
 * vs canonical names) for the campaign taxonomy layer to clean up.
 */

import type { AdPlatformRecord, ChannelConfig, GeneratorConfig, SeasonalityConfig } from './types';
import { SeededRandom } from './random';

/**
 * Generate ad platform records for a date range.
 *
 * Returns one record per campaign per day.
 */
export function generateAdPlatformData(
  config: GeneratorConfig,
  startDate: Date,
  endDate: Date,
  rng: SeededRandom,
): AdPlatformRecord[] {
  const records: AdPlatformRecord[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];

    for (const channel of config.channels) {
      for (const campaign of channel.campaigns) {
        if (campaign.monthlySpend <= 0) continue; // Skip non-paid (email, organic)

        const dailySpend = getDailySpend(campaign.monthlySpend, current, config.seasonality, rng);
        const impressions = Math.round(dailySpend / (campaign.avgCpc * campaign.ctr) || 0);
        const clicks = Math.round(impressions * campaign.ctr * (0.8 + rng.next() * 0.4));
        const cpc = clicks > 0 ? dailySpend / clicks : 0;
        const ctr = impressions > 0 ? clicks / impressions : 0;

        // Pick a raw campaign name (intentionally inconsistent)
        const rawName = rng.pick(campaign.utmVariants);

        records.push({
          date: dateStr,
          platform: channel.platform,
          campaign_name: campaign.name,
          campaign_name_raw: rawName,
          impressions,
          clicks,
          spend: Math.round(dailySpend * 100) / 100,
          cpc: Math.round(cpc * 100) / 100,
          ctr: Math.round(ctr * 10000) / 10000,
        });
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return records;
}

/**
 * Calculate daily spend for a campaign, applying seasonality and variance.
 */
function getDailySpend(
  monthlySpend: number,
  date: Date,
  seasonality: SeasonalityConfig,
  rng: SeededRandom,
): number {
  const baseDailySpend = monthlySpend / 30;
  const monthMultiplier = seasonality.monthly[date.getMonth()];
  const dayMultiplier = seasonality.dayOfWeek[date.getDay()];

  // Add ±20% daily variance
  const variance = 0.8 + rng.next() * 0.4;

  return Math.max(0, baseDailySpend * monthMultiplier * dayMultiplier * variance);
}
