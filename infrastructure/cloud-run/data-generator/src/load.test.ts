/**
 * Phase 10d D6 — synthetic load test for the data-generator engines.
 *
 * Gated on `LOAD_TEST=1` to keep it out of the default Jest run; the
 * regular jest suite still exercises generation correctness, this file
 * measures throughput, peak memory, and end-to-end timing on
 * representative configs.
 *
 * Methodology
 * -----------
 * Two profiles, both deterministic via a seeded RNG so re-runs are
 * comparable against committed baselines:
 *
 *   1. **Single-day high-traffic ecommerce.** 5,000 sessions in a day —
 *      well above the demo's typical synthetic volume. Measures the
 *      generator's hot loop on its biggest engine (ecommerce has the
 *      most events per session: page_view → product_view × N → add_to_cart
 *      → begin_checkout → purchase).
 *   2. **30-day backfill at typical config.** Mirrors the production
 *      ongoing-generation pattern. Measures sustained throughput, total
 *      event volume, and the event-breakdown distribution.
 *
 * Memory deltas are sampled before and after each run via
 * `process.memoryUsage()`. Heap growth is the GC-resident floor; the
 * delta is informative but noisy across runs because of GC timing.
 *
 * Network IO is intentionally NOT in scope here — the generator's
 * `sendEvents` transport hits sGTM in production, which can't be
 * load-tested without a non-prod sGTM container. The transport tests
 * (`transport.test.ts`) cover correctness; throughput-against-sGTM is
 * a Phase 11 monitoring concern, captured as a carry-forward in
 * docs/perf/load-test-2026-04-25.md.
 */
import { generateDay, generateDateRange } from './generator';
import { createEcommerceConfig } from './profiles';

const LOAD_TEST_ENABLED = process.env.LOAD_TEST === '1';
const describeIfLoadTest = LOAD_TEST_ENABLED ? describe : describe.skip;

interface LoadMetrics {
  durationMs: number;
  eventsPerSec: number;
  totalEvents: number;
  totalSessions: number;
  heapGrowthMb: number;
}

function snapshotHeap(): number {
  return process.memoryUsage().heapUsed / 1024 / 1024;
}

function measureGeneration(
  label: string,
  fn: () => { totalEvents: number; totalSessions: number },
): LoadMetrics {
  const heapBefore = snapshotHeap();
  const start = process.hrtime.bigint();
  const { totalEvents, totalSessions } = fn();
  const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
  const heapAfter = snapshotHeap();

  const eventsPerSec = (totalEvents / durationMs) * 1000;
  const heapGrowthMb = heapAfter - heapBefore;

  // eslint-disable-next-line no-console
  console.log(
    `[load] ${label}: ${totalSessions.toLocaleString()} sessions ` +
      `→ ${totalEvents.toLocaleString()} events in ` +
      `${durationMs.toFixed(0)} ms (${Math.round(eventsPerSec).toLocaleString()} events/sec, ` +
      `heap +${heapGrowthMb.toFixed(1)} MB)`,
  );

  return { durationMs, eventsPerSec, totalEvents, totalSessions, heapGrowthMb };
}

function makeEcommerceConfig(sessionsPerDay: number) {
  return createEcommerceConfig({ seed: 42, dailySessions: sessionsPerDay });
}

describeIfLoadTest('data-generator load profile (Phase 10d D6)', () => {
  it('single-day high-traffic ecommerce: 5,000 sessions inside the throughput floor', () => {
    const SESSIONS_PER_DAY = 5_000;
    const config = makeEcommerceConfig(SESSIONS_PER_DAY);
    const today = new Date('2026-04-25T12:00:00Z');

    const metrics = measureGeneration('generateDay × 5k sessions', () => {
      const result = generateDay(config, today);
      return {
        totalEvents: result.stats.totalEvents,
        totalSessions: result.stats.totalSessions,
      };
    });

    // Sessions weren't all generated due to seasonality / session-count
    // jitter — the floor checks "at least 50% of nominal."
    expect(metrics.totalSessions).toBeGreaterThan(SESSIONS_PER_DAY * 0.5);
    expect(metrics.totalEvents).toBeGreaterThan(metrics.totalSessions); // multi-event sessions
    // Throughput floor: at least 30k events/sec on a developer laptop.
    expect(metrics.eventsPerSec).toBeGreaterThan(30_000);
  });

  it('30-day backfill at typical config: completes inside time budget + sane heap', () => {
    const config = makeEcommerceConfig(500); // typical demo volume
    const endDate = new Date('2026-04-25T00:00:00Z');
    const startDate = new Date('2026-03-26T00:00:00Z');

    const metrics = measureGeneration('generateDateRange × 30 days', () => {
      const result = generateDateRange(config, startDate, endDate);
      return {
        totalEvents: result.stats.totalEvents,
        totalSessions: result.stats.totalSessions,
      };
    });

    // Full month should complete in well under 30 seconds, even with
    // generous slack for CI variation.
    expect(metrics.durationMs).toBeLessThan(30_000);
    // Total events should be in the 30k-100k range for 30 days × ~500
    // sessions × ~7 events/session.
    expect(metrics.totalEvents).toBeGreaterThan(10_000);
    expect(metrics.totalEvents).toBeLessThan(500_000);
    // Heap growth bounded — generator collects events in an array, so
    // growth roughly tracks events × payload-size. Stays under 200 MB
    // for a 30-day run; if this regresses past 500 MB the generator
    // is likely accumulating something it shouldn't.
    expect(metrics.heapGrowthMb).toBeLessThan(500);
  });

  it('determinism — same seed produces identical results', () => {
    const config = makeEcommerceConfig(1_000);
    const day = new Date('2026-04-25T12:00:00Z');

    const a = generateDay(config, day);
    const b = generateDay(config, day);

    expect(a.stats.totalEvents).toBe(b.stats.totalEvents);
    expect(a.stats.totalSessions).toBe(b.stats.totalSessions);
    expect(a.stats.eventBreakdown).toEqual(b.stats.eventBreakdown);
  });
});
