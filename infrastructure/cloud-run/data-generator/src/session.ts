/**
 * Session generator — creates a synthetic user session with a sequence
 * of events following the business model's funnel.
 *
 * Each session represents one "visitor" interacting with a demo page.
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  ChannelConfig,
  CampaignConfig,
  GeneratorConfig,
  SeasonalityConfig,
  SyntheticBaseEvent,
  SyntheticEvent,
} from './types';
import { SeededRandom } from './random';

// ---------------------------------------------------------------------------
// Session context — shared state for all events in a single session
// ---------------------------------------------------------------------------

export interface SessionContext {
  sessionId: string;
  timestamp: Date;
  pagePath: string;
  pageTitle: string;
  channel: ChannelConfig;
  campaign: CampaignConfig | null;
  utmSource: string | undefined;
  utmMedium: string | undefined;
  utmCampaign: string | undefined;
  consentAnalytics: boolean;
  consentMarketing: boolean;
  consentPreferences: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map platform to utm_source value. */
function platformToUtmSource(platform: string): string {
  switch (platform) {
    case 'google':
      return 'google';
    case 'meta':
      return 'facebook';
    case 'tiktok':
      return 'tiktok';
    case 'email':
      return 'email';
    case 'organic':
      return 'google';
    case 'direct':
      return '(direct)';
    default:
      return platform;
  }
}

/** Map platform to utm_medium value. */
function platformToUtmMedium(platform: string): string {
  switch (platform) {
    case 'google':
      return 'cpc';
    case 'meta':
      return 'paid_social';
    case 'tiktok':
      return 'paid_social';
    case 'email':
      return 'email';
    case 'organic':
      return 'organic';
    case 'direct':
      return '(none)';
    default:
      return 'referral';
  }
}

/**
 * Get the full seasonality multiplier for a given timestamp (month × day × hour).
 * Used for intra-day distribution weighting, not for daily session counts.
 */
export function getSeasonalityMultiplier(date: Date, seasonality: SeasonalityConfig): number {
  const month = date.getMonth();
  const dayOfWeek = date.getDay();
  const hour = date.getHours();
  return (
    seasonality.monthly[month] * seasonality.dayOfWeek[dayOfWeek] * seasonality.hourOfDay[hour]
  );
}

/**
 * Get the daily seasonality multiplier (month × day-of-week only).
 * Hour-of-day is excluded because session distribution across hours
 * is handled separately by pickHour in the generator.
 */
export function getDailySeasonalityMultiplier(date: Date, seasonality: SeasonalityConfig): number {
  const month = date.getMonth();
  const dayOfWeek = date.getDay();
  return seasonality.monthly[month] * seasonality.dayOfWeek[dayOfWeek];
}

/**
 * Calculate the number of sessions for a given date, accounting for
 * seasonality and growth.
 */
export function getSessionCountForDate(
  date: Date,
  config: GeneratorConfig,
  referenceDate: Date,
): number {
  const monthsElapsed =
    (date.getFullYear() - referenceDate.getFullYear()) * 12 +
    (date.getMonth() - referenceDate.getMonth());

  const growthMultiplier = Math.pow(1 + config.monthlyGrowthRate, monthsElapsed);
  const seasonalMultiplier = getDailySeasonalityMultiplier(date, config.seasonality);

  return Math.max(1, Math.round(config.dailySessions * growthMultiplier * seasonalMultiplier));
}

/**
 * Select a channel for this session based on traffic share weights.
 */
export function selectChannel(channels: ChannelConfig[], rng: SeededRandom): ChannelConfig {
  const items: Array<readonly [ChannelConfig, number]> = channels.map((ch) => [
    ch,
    ch.trafficShare,
  ]);
  return rng.weighted(items);
}

/**
 * Select a campaign from the channel (or null for organic/direct).
 */
export function selectCampaign(channel: ChannelConfig, rng: SeededRandom): CampaignConfig | null {
  if (channel.campaigns.length === 0) return null;
  return rng.pick(channel.campaigns);
}

/**
 * Create a session context — the shared state for a visitor session.
 */
export function createSessionContext(
  config: GeneratorConfig,
  timestamp: Date,
  rng: SeededRandom,
): SessionContext {
  const channel = selectChannel(config.channels, rng);
  const campaign = selectCampaign(channel, rng);

  const sessionId = uuidv4();

  // Determine UTM params
  const utmSource = platformToUtmSource(channel.platform);
  const utmMedium = platformToUtmMedium(channel.platform);
  const utmCampaign = campaign ? rng.pick(campaign.utmVariants) : undefined;

  // Consent simulation: ~85% accept analytics, ~60% accept marketing
  const consentAnalytics = rng.chance(0.85);
  const consentMarketing = rng.chance(0.6);
  const consentPreferences = rng.chance(0.75);

  // Page path based on business model
  let pagePath: string;
  let pageTitle: string;
  switch (config.businessModel) {
    case 'ecommerce':
      pagePath = '/demo/ecommerce';
      pageTitle = 'The Tuna Shop';
      break;
    case 'subscription':
      pagePath = '/demo/subscription';
      pageTitle = 'Tuna Subscription Box';
      break;
    case 'leadgen':
      pagePath = '/demo/leadgen';
      pageTitle = 'Tuna Brand Partnerships';
      break;
  }

  return {
    sessionId,
    timestamp,
    pagePath,
    pageTitle,
    channel,
    campaign,
    utmSource,
    utmMedium,
    utmCampaign,
    consentAnalytics,
    consentMarketing,
    consentPreferences,
  };
}

/**
 * Create a base event from a session context, advancing the timestamp slightly.
 */
export function createBaseEvent(
  ctx: SessionContext,
  eventName: string,
  offsetMs: number,
): SyntheticBaseEvent {
  const ts = new Date(ctx.timestamp.getTime() + offsetMs);
  return {
    iap_source: true,
    event: eventName,
    timestamp: ts.toISOString(),
    session_id: ctx.sessionId,
    iap_session_id: ctx.sessionId,
    page_path: ctx.pagePath,
    page_title: ctx.pageTitle,
    consent_analytics: ctx.consentAnalytics,
    consent_marketing: ctx.consentMarketing,
    consent_preferences: ctx.consentPreferences,
    ...(ctx.utmSource !== '(direct)' ? { utm_source: ctx.utmSource } : {}),
    ...(ctx.utmMedium !== '(none)' ? { utm_medium: ctx.utmMedium } : {}),
    ...(ctx.utmCampaign ? { utm_campaign: ctx.utmCampaign } : {}),
  };
}
