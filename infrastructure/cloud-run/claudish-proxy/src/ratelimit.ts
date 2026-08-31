/**
 * claudish-proxy — per-IP rate limiting + client-IP extraction.
 *
 * The extraction is where per-IP limits usually break: Express's
 * `trust proxy` takes the LEFTMOST X-Forwarded-For entry, which is
 * attacker-supplied. On Cloud Run, Google's front end appends the real
 * client IP and then its own hop, so the trustworthy entry is
 * xff[len - TRUSTED_PROXY_HOPS] (default 2), falling back rightward,
 * then to the socket. Confirm the live shape at deploy (smoke test).
 *
 * Windows are fixed (minute/hour/day) with lazy sweep on access — no
 * setInterval; cpu_idle=true throttles background CPU. Limits are
 * per-instance; the daily spend cap is the global backstop, and the
 * README says so rather than implying per-IP limits suffice.
 */

export interface RateLimits {
  perMinute: number;
  perHour: number;
  perDay: number;
}

/** Cost-reasoned defaults: a real typist behind a 600ms debounce never hits 20/min. */
export const DEFAULT_LIMITS: RateLimits = { perMinute: 20, perHour: 200, perDay: 1000 };

interface WindowState {
  minuteStart: number;
  minuteCount: number;
  hourStart: number;
  hourCount: number;
  dayStart: number;
  dayCount: number;
  lastSeen: number;
}

const MINUTE = 60000;
const HOUR = 3600000;
const DAY = 86400000;

export interface RateDecision {
  allowed: boolean;
  retryAfterMs?: number;
}

export class RateLimiter {
  private states = new Map<string, WindowState>();
  private lastSweep = 0;

  constructor(private readonly limits: RateLimits = DEFAULT_LIMITS) {}

  check(ipKey: string, now: number = Date.now()): RateDecision {
    this.sweep(now);
    let s = this.states.get(ipKey);
    if (!s) {
      s = {
        minuteStart: now,
        minuteCount: 0,
        hourStart: now,
        hourCount: 0,
        dayStart: now,
        dayCount: 0,
        lastSeen: now,
      };
      this.states.set(ipKey, s);
    }
    s.lastSeen = now;
    if (now - s.minuteStart >= MINUTE) {
      s.minuteStart = now;
      s.minuteCount = 0;
    }
    if (now - s.hourStart >= HOUR) {
      s.hourStart = now;
      s.hourCount = 0;
    }
    if (now - s.dayStart >= DAY) {
      s.dayStart = now;
      s.dayCount = 0;
    }
    if (s.minuteCount >= this.limits.perMinute) {
      return { allowed: false, retryAfterMs: s.minuteStart + MINUTE - now };
    }
    if (s.hourCount >= this.limits.perHour) {
      return { allowed: false, retryAfterMs: s.hourStart + HOUR - now };
    }
    if (s.dayCount >= this.limits.perDay) {
      return { allowed: false, retryAfterMs: s.dayStart + DAY - now };
    }
    s.minuteCount++;
    s.hourCount++;
    s.dayCount++;
    return { allowed: true };
  }

  /** Lazy sweep: drop states idle for a day, at most once a minute. */
  private sweep(now: number): void {
    if (now - this.lastSweep < MINUTE) return;
    this.lastSweep = now;
    for (const [key, s] of this.states) {
      if (now - s.lastSeen > DAY) this.states.delete(key);
    }
  }

  get trackedIps(): number {
    return this.states.size;
  }
}

/**
 * Trustworthy client IP: XFF is least-trusted on the left. Google's
 * front end appends client-ip, then its own hop.
 */
export function clientIp(
  xffHeader: string | undefined,
  socketAddress: string | undefined,
  trustedProxyHops = 2
): string {
  if (xffHeader) {
    const parts = xffHeader
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const index = parts.length - trustedProxyHops;
    if (index >= 0 && parts[index]) return parts[index];
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return socketAddress ?? 'unknown';
}
