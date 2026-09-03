/**
 * claudish-proxy — config tests (feat/claudish, proxy T2).
 */
import { loadConfig, LANE_NAMES } from './config';

describe('loadConfig', () => {
  it('provides safe defaults', () => {
    const c = loadConfig({});
    expect(c.port).toBe(8080);
    expect(c.lanes).toEqual([...LANE_NAMES]);
    expect(c.projectId).toBe('iampatterson');
    expect(c.vertexFallbackRegion).toBe('us-east5');
    expect(c.dailyBudgetUsd).toBe(23);
    expect(c.killSwitch).toBe(false);
    expect(c.requireOrigin).toBe(true);
    expect(c.trustedProxyHops).toBe(1);
    expect(c.modelIdConfirmed).toBe(false);
  });

  it('parses and validates the lane ladder from env', () => {
    const c = loadConfig({ LANES: 'anthropic-api, cache-only' });
    expect(c.lanes).toEqual(['anthropic-api', 'cache-only']);
  });

  it('rejects unknown lanes with a readable message', () => {
    expect(() => loadConfig({ LANES: 'vertex-global,warp-drive' })).toThrow(
      /unknown lane "warp-drive"/
    );
  });

  it('rejects a non-numeric budget', () => {
    expect(() => loadConfig({ DAILY_BUDGET_USD: 'lots' })).toThrow(/DAILY_BUDGET_USD/);
  });

  it('reads the kill switch and origin gate flags', () => {
    const c = loadConfig({ KILL_SWITCH: 'on', REQUIRE_ORIGIN: 'false' });
    expect(c.killSwitch).toBe(true);
    expect(c.requireOrigin).toBe(false);
  });
});

describe('MAX_INSTANCES validation (spend cap must never fail open)', () => {
  it('rejects non-numeric, zero, and fractional values', () => {
    expect(() => loadConfig({ MAX_INSTANCES: 'four' })).toThrow(/MAX_INSTANCES/);
    expect(() => loadConfig({ MAX_INSTANCES: '0' })).toThrow(/MAX_INSTANCES/);
    expect(() => loadConfig({ MAX_INSTANCES: '2.5' })).toThrow(/MAX_INSTANCES/);
  });

  it('accepts a positive integer and keeps the default at 4', () => {
    expect(loadConfig({ MAX_INSTANCES: '2' }).maxInstances).toBe(2);
    expect(loadConfig({}).maxInstances).toBe(4);
  });

  it('parses the test-only refusal token, defaulting to null', () => {
    expect(loadConfig({}).forceRefusalToken).toBeNull();
    expect(loadConfig({ FORCE_REFUSAL_TOKEN: 'xyz' }).forceRefusalToken).toBe('xyz');
  });
});

describe('TRUSTED_PROXY_HOPS (review batch 1, 2026-09-03)', () => {
  it('defaults to one hop (direct run.app: the last X-Forwarded-For entry is the client)', () => {
    expect(loadConfig({}).trustedProxyHops).toBe(1);
  });
  it('accepts a positive integer for a load-balancer deployment', () => {
    expect(loadConfig({ TRUSTED_PROXY_HOPS: '2' }).trustedProxyHops).toBe(2);
  });
  it('refuses a non-integer or zero value instead of silently collapsing all visitors onto one key', () => {
    expect(() => loadConfig({ TRUSTED_PROXY_HOPS: 'abc' })).toThrow(/TRUSTED_PROXY_HOPS/);
    expect(() => loadConfig({ TRUSTED_PROXY_HOPS: '0' })).toThrow(/TRUSTED_PROXY_HOPS/);
    expect(() => loadConfig({ TRUSTED_PROXY_HOPS: '1.5' })).toThrow(/TRUSTED_PROXY_HOPS/);
  });
});
