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
  it('takes the second-from-last XFF entry by default (Cloud Run shape)', () => {
    expect(clientIp('203.0.113.7, 66.102.0.1', '10.0.0.1')).toBe('203.0.113.7');
  });

  it('ignores attacker-prepended entries', () => {
    expect(clientIp('6.6.6.6, 203.0.113.7, 66.102.0.1', '10.0.0.1')).toBe('203.0.113.7');
  });

  it('falls back rightward when the list is shorter than the hop count', () => {
    expect(clientIp('203.0.113.7', '10.0.0.1')).toBe('203.0.113.7');
  });

  it('falls back to the socket without a header, and honors the hop override', () => {
    expect(clientIp(undefined, '10.9.8.7')).toBe('10.9.8.7');
    expect(clientIp('a, b, c', undefined, 3)).toBe('a');
  });
});
