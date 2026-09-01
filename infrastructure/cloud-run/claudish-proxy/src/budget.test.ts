/**
 * claudish-proxy — budget tests (feat/claudish, proxy T7).
 */
import { BudgetTracker, usageCostUsd } from './budget';
import { RESERVATION_USD } from './config';

const DAY1 = Date.UTC(2026, 8, 1, 12, 0, 0);
const DAY2 = Date.UTC(2026, 8, 2, 0, 0, 1);

const usage = (outputTokens: number) => ({
  inputTokens: 300,
  outputTokens,
  cacheReadTokens: 2000,
  cacheWriteTokens: 0,
});

describe('usageCostUsd', () => {
  it('prices tokens per the pinned rates', () => {
    // 300 in ($1/M) + 200 out ($5/M) + 2000 cache-read ($0.10/M)
    expect(usageCostUsd(usage(200))).toBeCloseTo(0.0003 + 0.001 + 0.0002, 6);
  });
});

describe('BudgetTracker', () => {
  it('reserves worst-case then reconciles down to actual', () => {
    const tracker = new BudgetTracker(1.0, false, undefined, DAY1);
    const reservation = tracker.reserve(DAY1);
    expect(reservation).not.toBeNull();
    expect(tracker.usedPct(DAY1)).toBe(Math.round(RESERVATION_USD * 100));
    reservation!.reconcile(usage(200));
    expect(tracker.usedPct(DAY1)).toBe(0); // $0.0015 of $1 rounds to 0%
  });

  it('refuses reservations past the cap and trips', () => {
    const tracker = new BudgetTracker(RESERVATION_USD * 2.5, false, undefined, DAY1);
    expect(tracker.reserve(DAY1)).not.toBeNull();
    expect(tracker.reserve(DAY1)).not.toBeNull();
    expect(tracker.reserve(DAY1)).toBeNull(); // 3rd would exceed
    expect(tracker.isCapped(DAY1)).toBe(true);
  });

  it('resets at UTC midnight (lazy rollover)', () => {
    const tracker = new BudgetTracker(RESERVATION_USD, false, undefined, DAY1);
    expect(tracker.reserve(DAY1)).not.toBeNull();
    expect(tracker.reserve(DAY1)).toBeNull();
    expect(tracker.isCapped(DAY1)).toBe(true);
    expect(tracker.isCapped(DAY2)).toBe(false); // new UTC day
    expect(tracker.reserve(DAY2)).not.toBeNull();
  });

  it('honors the kill switch immediately', () => {
    const tracker = new BudgetTracker(100, true, undefined, DAY1);
    expect(tracker.isCapped(DAY1)).toBe(true);
    expect(tracker.reserve(DAY1)).toBeNull();
    tracker.setKillSwitch(false);
    expect(tracker.isCapped(DAY1)).toBe(false);
  });

  it('fires threshold callbacks once each at 50/80/100', () => {
    const fired: number[] = [];
    // Budget sized to the 3,000-char reservation ($0.018): 0.036 + 0.018
    // fits under 0.06, so the second reserve succeeds.
    const tracker = new BudgetTracker(0.06, false, (pct) => fired.push(pct), DAY1);
    const r1 = tracker.reserve(DAY1)!;
    r1.reconcile({ inputTokens: 0, outputTokens: 7200, cacheReadTokens: 0, cacheWriteTokens: 0 }); // $0.036 = 60%
    const r2 = tracker.reserve(DAY1)!;
    r2.reconcile({ inputTokens: 0, outputTokens: 5400, cacheReadTokens: 0, cacheWriteTokens: 0 }); // +$0.027 => 105%
    expect(fired).toEqual([50, 80, 100]);
    expect(tracker.isCapped(DAY1)).toBe(true);
  });

  it('release without usage returns the reservation untouched', () => {
    const tracker = new BudgetTracker(1, false, undefined, DAY1);
    const r = tracker.reserve(DAY1)!;
    r.release();
    r.release(); // idempotent
    expect(tracker.usedPct(DAY1)).toBe(0);
  });
});

describe('per-lane pricing (Stage 1 bundle, 2026-09-01)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { usageCostUsd } = require('./budget');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GEMINI_PRICES, PRICES } = require('./config');
  const usage = { inputTokens: 1_000_000, outputTokens: 100_000, cacheReadTokens: 0, cacheWriteTokens: 0 };

  it('prices Gemini usage at Gemini rates, well under the Haiku default', () => {
    const haiku = usageCostUsd(usage);
    const gemini = usageCostUsd(usage, GEMINI_PRICES);
    expect(haiku).toBeCloseTo(1.0 + 0.5, 6);
    expect(gemini).toBeCloseTo(0.3 + 0.25, 6);
    expect(gemini).toBeLessThan(haiku / 2);
    expect(PRICES.inputPerMTok).toBe(1.0);
  });
});
