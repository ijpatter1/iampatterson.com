import { DATA_QUALITY_ASSERTIONS, assertionsForCart } from '@/lib/demo/reveal/data-quality';

describe('data-quality assertions', () => {
  it('exports exactly 6 assertions', () => {
    expect(DATA_QUALITY_ASSERTIONS).toHaveLength(6);
  });

  it('assertion keys match the prototype', () => {
    expect(DATA_QUALITY_ASSERTIONS.map((a) => a.k)).toEqual([
      'schema_validation',
      'null_check',
      'volume_anomaly',
      'session_join_integrity',
      'freshness',
      'referential_integrity',
    ]);
  });

  it('all assertions are OK by default', () => {
    for (const a of DATA_QUALITY_ASSERTIONS) {
      expect(a.status).toBe('OK');
      expect(a.detail).toBeTruthy();
    }
  });
});

describe('assertionsForCart', () => {
  it('returns all 6 assertions for a normal-shaped cart', () => {
    const out = assertionsForCart({ itemCount: 3, uniqueItems: 2 });
    expect(out).toHaveLength(6);
    expect(out.every((a) => a.status === 'OK')).toBe(true);
  });

  it('flags volume_anomaly as FAIL when item count exceeds the theoretical threshold', () => {
    const out = assertionsForCart({ itemCount: 20, uniqueItems: 1 });
    const va = out.find((a) => a.k === 'volume_anomaly');
    expect(va?.status).toBe('FAIL');
    expect(va?.detail).toMatch(/exceeds/i);
  });

  it('preserves original detail messages when all OK', () => {
    const out = assertionsForCart({ itemCount: 0, uniqueItems: 0 });
    const schema = out.find((a) => a.k === 'schema_validation');
    expect(schema?.detail).toMatch(/required fields/i);
  });
});
