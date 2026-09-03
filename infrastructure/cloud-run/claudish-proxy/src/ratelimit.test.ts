/**
 * claudish-proxy — rate limit tests (feat/claudish, proxy T5).
 */
import { clientIp, RateLimiter } from './ratelimit';

describe('RateLimiter', () => {
  it('allows up to the minute limit then denies with retry timing', () => {
    const rl = new RateLimiter({ perMinute: 3, perHour: 100, perDay: 1000 });
    expect(rl.check('ip1', 0).allowed).toBe(true);
    expect(rl.check('ip1', 1).allowed).toBe(true);
    expect(rl.check('ip1', 2).allowed).toBe(true);
    const denied = rl.check('ip1', 3);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterMs).toBe(60000 - 3);
  });

  it('refills after the window and isolates IPs', () => {
    const rl = new RateLimiter({ perMinute: 1, perHour: 100, perDay: 1000 });
    expect(rl.check('a', 0).allowed).toBe(true);
    expect(rl.check('a', 1).allowed).toBe(false);
    expect(rl.check('b', 1).allowed).toBe(true);
    expect(rl.check('a', 60001).allowed).toBe(true);
  });

  it('enforces the hour and day ceilings independently', () => {
    const rl = new RateLimiter({ perMinute: 1000, perHour: 2, perDay: 3 });
    expect(rl.check('ip', 0).allowed).toBe(true);
    expect(rl.check('ip', 1).allowed).toBe(true);
    expect(rl.check('ip', 2).allowed).toBe(false);
    expect(rl.check('ip', 3600005).allowed).toBe(true);
    expect(rl.check('ip', 3600006).allowed).toBe(false);
  });

  it('sweeps idle state lazily', () => {
    const rl = new RateLimiter();
    rl.check('old', 0);
    rl.check('new', 86500000);
    expect(rl.trackedIps).toBe(1);
  });
});

describe('clientIp', () => {
  // Review batch 1 (2026-09-03): the service runs directly on run.app, where
  // Google's front end APPENDS the connecting IP to whatever the caller sent,
  // so the trustworthy entry is the LAST one (one trusted hop). The old
  // default of two hops read the caller-supplied entry: 21 live requests with
  // rotating spoofed X-Forwarded-For values drew zero rate limits.
  it('reads the last entry by default (one trusted hop, direct Cloud Run)', () => {
    expect(clientIp('203.0.113.7, 66.102.0.1', '10.0.0.1')).toBe('66.102.0.1');
  });
  it('ignores caller-supplied entries to the left', () => {
    expect(clientIp('6.6.6.6, 203.0.113.7', '10.0.0.1')).toBe('203.0.113.7');
  });
  it('honours an explicit hop count for a load-balancer deployment', () => {
    expect(clientIp('203.0.113.7, 66.102.0.1', '10.0.0.1', 2)).toBe('203.0.113.7');
    expect(clientIp('6.6.6.6, 203.0.113.7, 66.102.0.1', '10.0.0.1', 2)).toBe('203.0.113.7');
  });
  it('falls back to the single entry or the socket address', () => {
    expect(clientIp('203.0.113.7', '10.0.0.1')).toBe('203.0.113.7');
    expect(clientIp(undefined, '10.9.8.7')).toBe('10.9.8.7');
    expect(clientIp('a, b, c', undefined, 3)).toBe('a');
  });
});
