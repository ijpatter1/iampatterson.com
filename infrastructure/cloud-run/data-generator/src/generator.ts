/**
 * Main generator orchestrator — coordinates event generation across
 * business models, handles backfill and ongoing generation.
 */

import type {
  GeneratorConfig,
  EcommerceProfile,
  SubscriptionProfile,
  LeadGenProfile,
  SyntheticEvent,
  AdPlatformRecord,
} from './types';
import { SeededRandom } from './random';
import { createSessionContext, getSessionCountForDate } from './session';
import { generateEcommerceSession } from './engines/ecommerce';
import { generateSubscriptionSession, generateSubscriptionLifecycle } from './engines/subscription';
import { generateLeadgenSession } from './engines/leadgen';
import { generateAdPlatformData } from './ad-platform';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GenerationResult {
  events: SyntheticEvent[];
  adPlatformRecords: AdPlatformRecord[];
  stats: GenerationStats;
}

export interface GenerationStats {
  totalSessions: number;
  totalEvents: number;
  totalAdRecords: number;
  dateRange: { start: string; end: string };
  eventBreakdown: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Backfill
// ---------------------------------------------------------------------------

/**
 * Generate historical data for a date range.
 *
 * Produces events for each day, with session counts adjusted by
 * seasonality and growth. Also generates ad platform spend data.
 */
export function generateBackfill(config: GeneratorConfig, endDate: Date): GenerationResult {
  const startDate = new Date(endDate);
  startDate.setMonth(startDate.getMonth() - config.backfillMonths);

  return generateDateRange(config, startDate, endDate);
}

/**
 * Generate events for a single day (used for ongoing generation).
 */
export function generateDay(config: GeneratorConfig, date: Date): GenerationResult {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  return generateDateRange(config, dayStart, dayEnd);
}

/**
 * Generate events for a date range.
 */
export function generateDateRange(
  config: GeneratorConfig,
  startDate: Date,
  endDate: Date,
): GenerationResult {
  const rng = new SeededRandom(config.seed ?? Date.now());
  const events: SyntheticEvent[] = [];
  const eventBreakdown: Record<string, number> = {};
  let totalSessions = 0;

  const referenceDate = new Date(startDate);
  const current = new Date(startDate);

  while (current <= endDate) {
    const daySessionCount = getSessionCountForDate(current, config, referenceDate);

    for (let i = 0; i < daySessionCount; i++) {
      // Distribute sessions across the day using hour-of-day weights
      const hour = pickHour(config, rng);
      const minute = rng.int(0, 59);
      const second = rng.int(0, 59);

      const sessionTime = new Date(current);
      sessionTime.setHours(hour, minute, second, 0);

      const ctx = createSessionContext(config, sessionTime, rng);
      const sessionEvents = generateSessionForModel(config, ctx, rng);

      for (const event of sessionEvents) {
        events.push(event);
        eventBreakdown[event.event] = (eventBreakdown[event.event] || 0) + 1;
      }

      totalSessions++;
    }

    current.setDate(current.getDate() + 1);
  }

  // Generate ad platform data
  const adPlatformRecords = generateAdPlatformData(config, startDate, endDate, rng);

  return {
    events,
    adPlatformRecords,
    stats: {
      totalSessions,
      totalEvents: events.length,
      totalAdRecords: adPlatformRecords.length,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      },
      eventBreakdown,
    },
  };
}

/**
 * Generate events for a single session based on the business model.
 */
function generateSessionForModel(
  config: GeneratorConfig,
  ctx: ReturnType<typeof createSessionContext>,
  rng: SeededRandom,
): SyntheticEvent[] {
  switch (config.profile.model) {
    case 'ecommerce':
      return generateEcommerceSession(ctx, config.profile as EcommerceProfile, rng);
    case 'subscription':
      return generateSubscriptionSession(ctx, config.profile as SubscriptionProfile, rng);
    case 'leadgen':
      return generateLeadgenSession(ctx, config.profile as LeadGenProfile, rng);
  }
}

/**
 * Pick an hour of day weighted by the seasonality config.
 */
function pickHour(config: GeneratorConfig, rng: SeededRandom): number {
  const items: Array<readonly [number, number]> = config.seasonality.hourOfDay.map(
    (weight, hour) => [hour, weight] as const,
  );
  return rng.weighted(items);
}
