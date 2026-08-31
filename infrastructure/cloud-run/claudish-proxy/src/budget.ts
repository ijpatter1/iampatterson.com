/**
 * claudish-proxy — spend accounting, auto-trip, kill switch.
 *
 * The actual cost control (max-instances is blast radius, not budget).
 * Reservation model: a worst-case estimate is committed at request
 * start and reconciled against real usage on completion or abort — so a
 * concurrent burst can never commit spend no counter has seen. The
 * budget is per-instance (DAILY_BUDGET_USD / MAX_INSTANCES): deliberately
 * conservative and skew-unfair rather than putting a network round trip
 * in the latency-critical path. Trips force cache-only until UTC
 * midnight. All rollover is lazy (checked on access — no timers;
 * cpu_idle=true).
 */
import { PRICES, RESERVATION_USD } from './config';

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export function usageCostUsd(usage: Usage): number {
  return (
    (usage.inputTokens * PRICES.inputPerMTok +
      usage.outputTokens * PRICES.outputPerMTok +
      usage.cacheReadTokens * PRICES.cacheReadPerMTok +
      usage.cacheWriteTokens * PRICES.cacheWritePerMTok) /
    1_000_000
  );
}

export interface Reservation {
  /** Replace the reservation with the actual cost (call exactly once). */
  reconcile(usage: Usage): void;
  /** Release with a partial estimate (abort path). */
  release(partial?: Usage): void;
}

export class BudgetTracker {
  private spentUsd = 0;
  private reservedUsd = 0;
  private dayKey: string;
  private tripped = false;
  private lastThresholdPct = 0;

  constructor(
    private readonly dailyBudgetUsd: number,
    private killSwitchOn: boolean,
    private readonly onThreshold: (pct: number) => void = () => undefined,
    now: number = Date.now()
  ) {
    this.dayKey = BudgetTracker.utcDay(now);
  }

  private static utcDay(now: number): string {
    return new Date(now).toISOString().slice(0, 10);
  }

  private rollover(now: number): void {
    const day = BudgetTracker.utcDay(now);
    if (day !== this.dayKey) {
      this.dayKey = day;
      this.spentUsd = 0;
      this.reservedUsd = 0;
      this.tripped = false;
      this.lastThresholdPct = 0;
    }
  }

  setKillSwitch(on: boolean): void {
    this.killSwitchOn = on;
  }

  /** True when only the cache-only lane may serve. */
  isCapped(now: number = Date.now()): boolean {
    this.rollover(now);
    return this.killSwitchOn || this.tripped;
  }

  usedPct(now: number = Date.now()): number {
    this.rollover(now);
    return Math.round(((this.spentUsd + this.reservedUsd) / this.dailyBudgetUsd) * 100);
  }

  /**
   * Reserve worst-case spend for one request. Returns null when the
   * budget (incl. reservations) has no room — the request must go
   * cache-only.
   */
  reserve(now: number = Date.now()): Reservation | null {
    this.rollover(now);
    if (this.isCapped(now)) return null;
    if (this.spentUsd + this.reservedUsd + RESERVATION_USD > this.dailyBudgetUsd) {
      this.tripped = true;
      this.onThreshold(100);
      return null;
    }
    this.reservedUsd += RESERVATION_USD;
    let settled = false;
    const settle = (usd: number) => {
      if (settled) return;
      settled = true;
      this.reservedUsd = Math.max(0, this.reservedUsd - RESERVATION_USD);
      this.spentUsd += usd;
      this.checkThresholds();
    };
    return {
      reconcile: (usage: Usage) => settle(usageCostUsd(usage)),
      release: (partial?: Usage) => settle(partial ? usageCostUsd(partial) : 0),
    };
  }

  private checkThresholds(): void {
    const pct = (this.spentUsd / this.dailyBudgetUsd) * 100;
    for (const threshold of [50, 80, 100]) {
      if (pct >= threshold && this.lastThresholdPct < threshold) {
        this.lastThresholdPct = threshold;
        this.onThreshold(threshold);
      }
    }
    if (pct >= 100) this.tripped = true;
  }
}
