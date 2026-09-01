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
    expect(c.trustedProxyHops).toBe(2);
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
