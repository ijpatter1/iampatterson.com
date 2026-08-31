/**
 * claudish-proxy — circuit breaker tests (feat/claudish, proxy T8).
 */
import { CircuitBreaker } from './lanes';

describe('CircuitBreaker', () => {
  it('opens after three consecutive failures', () => {
    const cb = new CircuitBreaker(3, 30000);
    cb.recordFailure('vertex-global', 0);
    cb.recordFailure('vertex-global', 1);
    expect(cb.isOpen('vertex-global', 2)).toBe(false);
    cb.recordFailure('vertex-global', 2);
    expect(cb.isOpen('vertex-global', 3)).toBe(true);
  });

  it('half-opens after the cooldown and re-opens on the next failure', () => {
    const cb = new CircuitBreaker(3, 30000);
    for (let i = 0; i < 3; i++) cb.recordFailure('lane', i);
    expect(cb.isOpen('lane', 30001)).toBe(true); // opened at t=2: still cooling
    expect(cb.isOpen('lane', 30002)).toBe(false); // cooldown elapsed: probe allowed
    cb.recordFailure('lane', 30003); // probe failed: open again immediately
    expect(cb.isOpen('lane', 30004)).toBe(true);
  });

  it('success resets the count', () => {
    const cb = new CircuitBreaker(3, 30000);
    cb.recordFailure('lane', 0);
    cb.recordFailure('lane', 1);
    cb.recordSuccess('lane');
    cb.recordFailure('lane', 2);
    expect(cb.isOpen('lane', 3)).toBe(false);
  });

  it('tracks lanes independently', () => {
    const cb = new CircuitBreaker(1, 30000);
    cb.recordFailure('a', 0);
    expect(cb.isOpen('a', 1)).toBe(true);
    expect(cb.isOpen('b', 1)).toBe(false);
  });
});
