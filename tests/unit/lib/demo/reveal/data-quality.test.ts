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
    const out = assertionsForCart({ itemCount: 3 });
    expect(out).toHaveLength(6);
    expect(out.every((a) => a.status === 'OK')).toBe(true);
  });

  it('flags volume_anomaly as FAIL when cart itemCount exceeds the threshold (no live stream)', () => {
    // Fallback path: no live stream data → volume_anomaly branches on
    // cart itemCount. Detail text honestly names the cart (not the event
    // stream) as the signal source — pre-evaluation-fix text read
    // "N add_to_cart events in 30s" which was a lie when the count came
    // from the cart.
    const out = assertionsForCart({ itemCount: 20 });
    const va = out.find((a) => a.k === 'volume_anomaly');
    expect(va?.status).toBe('FAIL');
    expect(va?.detail).toMatch(/cart holds 20 items/i);
    expect(va?.detail).not.toMatch(/add_to_cart events in 30s/i);
  });

  it('preserves original detail messages when all OK', () => {
    const out = assertionsForCart({ itemCount: 0 });
    const schema = out.find((a) => a.k === 'schema_validation');
    expect(schema?.detail).toMatch(/required fields/i);
  });

  // UAT r1 item 8 — the cart sidebar was advertised as live but showed
  // hardcoded numbers. When live session context is supplied, the three
  // variable-by-session assertions must substitute.
  describe('UAT r1 item 8 — live substitutions', () => {
    it('volume_anomaly counts live add_to_cart events when provided', () => {
      const out = assertionsForCart({ itemCount: 3, addToCartInLast30s: 4 });
      const va = out.find((a) => a.k === 'volume_anomaly');
      expect(va?.status).toBe('OK');
      expect(va?.detail).toMatch(/4 add_to_cart in 30s/);
    });

    it('volume_anomaly FAILs on live count > threshold (not cart itemCount)', () => {
      // Cart has 3 items but 15 add_to_cart events fired in the last
      // 30s (the visitor was thrashing) — volume_anomaly should FAIL
      // on the event count, not the cart count.
      const out = assertionsForCart({ itemCount: 3, addToCartInLast30s: 15 });
      const va = out.find((a) => a.k === 'volume_anomaly');
      expect(va?.status).toBe('FAIL');
      expect(va?.detail).toMatch(/15/);
    });

    it('session_join_integrity names the real session_id when provided', () => {
      const out = assertionsForCart({
        itemCount: 1,
        sessionId: 'abc12345-6789-4def-8abc-deadbeefcafe',
      });
      const sj = out.find((a) => a.k === 'session_join_integrity');
      expect(sj?.detail).toMatch(/abc12345/);
    });

    it('freshness shows real seconds-since-last-event + event name when supplied', () => {
      const out = assertionsForCart({
        itemCount: 1,
        secondsSinceLastEvent: 7,
        lastEventName: 'add_to_cart',
      });
      const fr = out.find((a) => a.k === 'freshness');
      expect(fr?.detail).toMatch(/last add_to_cart 7s ago/);
    });

    it('freshness falls back to seed copy when no live context', () => {
      const out = assertionsForCart({ itemCount: 1 });
      const fr = out.find((a) => a.k === 'freshness');
      expect(fr?.detail).toMatch(/last raw event 2.1s ago/);
    });

    it('session_join_integrity keeps seed copy when no session_id', () => {
      const out = assertionsForCart({ itemCount: 1 });
      const sj = out.find((a) => a.k === 'session_join_integrity');
      expect(sj?.detail).toMatch(/session_id matches active session row/);
    });
  });
});
