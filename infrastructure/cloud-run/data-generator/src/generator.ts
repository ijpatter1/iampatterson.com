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
import { sendEvents } from './transport';
import type { TransportConfig, SendResult } from './transport';

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
 *
 * For subscriptions, also generates lifecycle events (renewals, churn)
 * if the visitor signed up for a trial.
 */
function generateSessionForModel(
  config: GeneratorConfig,
  ctx: ReturnType<typeof createSessionContext>,
  rng: SeededRandom,
): SyntheticEvent[] {
  switch (config.profile.model) {
    case 'ecommerce':
      return generateEcommerceSession(ctx, config.profile as EcommerceProfile, rng);
    case 'subscription': {
      const profile = config.profile as SubscriptionProfile;
      const sessionEvents = generateSubscriptionSession(ctx, profile, rng);

      // If the visitor signed up, generate lifecycle events
      const signup = sessionEvents.find((e) => e.event === 'trial_signup');
      if (signup) {
        const planId = (signup as { plan_id: string }).plan_id;
        const plan = profile.plans.find((p) => p.id === planId) || profile.plans[0];
        // Generate up to 12 months of lifecycle from the signup date
        const lifecycleEvents = generateSubscriptionLifecycle(
          ctx,
          profile,
          plan,
          ctx.timestamp,
          12,
          rng,
        );
        return [...sessionEvents, ...lifecycleEvents];
      }
      return sessionEvents;
    }
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

// ---------------------------------------------------------------------------
// Streaming backfill — generates and sends one day at a time
// ---------------------------------------------------------------------------

export interface StreamingBackfillResult {
  stats: GenerationStats;
  sendResult: SendResult;
}

/**
 * Generate and send historical data day-by-day, keeping memory constant.
 *
 * Unlike generateBackfill() which builds all events in memory,
 * this generates one day's events, sends them immediately, then
 * discards them before generating the next day.
 */
export async function streamingBackfill(
  config: GeneratorConfig,
  endDate: Date,
  transportConfig: TransportConfig,
  dryRun: boolean,
  onProgress?: (day: string, dayEvents: number, totalSent: number) => void,
): Promise<StreamingBackfillResult> {
  const startDate = new Date(endDate);
  startDate.setMonth(startDate.getMonth() - config.backfillMonths);

  const rng = new SeededRandom(config.seed ?? Date.now());
  const referenceDate = new Date(startDate);
  const current = new Date(startDate);

  const stats: GenerationStats = {
    totalSessions: 0,
    totalEvents: 0,
    totalAdRecords: 0,
    dateRange: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    },
    eventBreakdown: {},
  };

  const sendResult: SendResult = { sent: 0, failed: 0, errors: [] };

  while (current <= endDate) {
    // Generate one day's events
    const dayEvents: SyntheticEvent[] = [];
    const daySessionCount = getSessionCountForDate(current, config, referenceDate);

    for (let i = 0; i < daySessionCount; i++) {
      const hour = pickHour(config, rng);
      const minute = rng.int(0, 59);
      const second = rng.int(0, 59);

      const sessionTime = new Date(current);
      sessionTime.setHours(hour, minute, second, 0);

      const ctx = createSessionContext(config, sessionTime, rng);
      const sessionEvents = generateSessionForModel(config, ctx, rng);

      for (const event of sessionEvents) {
        dayEvents.push(event);
        stats.eventBreakdown[event.event] = (stats.eventBreakdown[event.event] || 0) + 1;
      }

      stats.totalSessions++;
    }

    stats.totalEvents += dayEvents.length;

    // Send this day's events immediately, then discard
    if (!dryRun && dayEvents.length > 0) {
      const dayResult = await sendEvents(dayEvents, transportConfig);
      sendResult.sent += dayResult.sent;
      sendResult.failed += dayResult.failed;
      if (dayResult.errors.length > 0) {
        // Keep only the last few errors to avoid memory growth
        sendResult.errors = dayResult.errors.slice(-5);
      }
    }

    if (onProgress) {
      onProgress(current.toISOString().split('T')[0], dayEvents.length, sendResult.sent);
    }

    current.setDate(current.getDate() + 1);
  }

  return { stats, sendResult };
}
