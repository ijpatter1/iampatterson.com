import {
  STAGING_FIELD_CASTS,
  STAGING_STITCH_OPS,
  stagingRowsForProduct,
  stitchOpsForSession,
} from '@/lib/demo/reveal/staging-layer';

describe('staging-layer — field casts and stitch ops', () => {
  it('includes core event fields with types and example values', () => {
    const keys = STAGING_FIELD_CASTS.map((f) => f.k);
    expect(keys).toEqual([
      'event_name',
      'event_timestamp',
      'session_id',
      'product_id',
      'product_price',
      'page_path',
    ]);
    for (const f of STAGING_FIELD_CASTS) {
      expect(f.raw).toBeTruthy();
      expect(f.typed).toBeTruthy();
      expect(f.cast).toBeTruthy();
    }
  });

  it('product_price field declares STRING → FLOAT64 cast', () => {
    const priceField = STAGING_FIELD_CASTS.find((f) => f.k === 'product_price');
    expect(priceField?.cast).toContain('FLOAT64');
  });

  it('four stitch operations marked [OK]', () => {
    expect(STAGING_STITCH_OPS).toHaveLength(4);
    const ops = STAGING_STITCH_OPS.map((o) => o.op);
    expect(ops).toEqual(['dedupe', 'session_stitch', 'param_extract', 'geo_enrich']);
    for (const o of STAGING_STITCH_OPS) {
      expect(o.status).toBe('OK');
      expect(o.detail).toBeTruthy();
    }
  });
});

describe('stagingRowsForProduct', () => {
  it('substitutes product_id and product_price with the given product values', () => {
    const rows = stagingRowsForProduct({ id: 'colin-plush', price: 16 });
    const idRow = rows.find((r) => r.k === 'product_id');
    const priceRow = rows.find((r) => r.k === 'product_price');
    expect(idRow?.raw).toBe('"colin-plush"');
    expect(idRow?.typed).toBe('"colin-plush"');
    expect(priceRow?.raw).toBe('"16"');
    expect(priceRow?.typed).toBe('16');
  });

  it('preserves the other fields verbatim', () => {
    const rows = stagingRowsForProduct({ id: 'x', price: 1 });
    const nonProductKeys = rows.filter((r) => r.k !== 'product_id' && r.k !== 'product_price');
    const originalNonProductRows = STAGING_FIELD_CASTS.filter(
      (r) => r.k !== 'product_id' && r.k !== 'product_price',
    );
    expect(nonProductKeys).toEqual(originalNonProductRows);
  });

  // UAT r1 item 6 — the sidebar was advertised as live but session_id +
  // event_timestamp were hardcoded seeds. When live context is supplied,
  // those fields must substitute with the visitor's real values.
  it('substitutes session_id with the live value (truncated to 8 chars + ellipsis)', () => {
    const rows = stagingRowsForProduct(
      { id: 'x', price: 1 },
      { session_id: 'abc12345-6789-4def-8abc-deadbeefcafe' },
    );
    const sessionRow = rows.find((r) => r.k === 'session_id');
    expect(sessionRow?.raw).toBe('"abc12345…"');
    expect(sessionRow?.typed).toBe('"abc12345…"');
  });

  it('leaves session_id as the seed when no live session is provided', () => {
    const rows = stagingRowsForProduct({ id: 'x', price: 1 });
    const sessionRow = rows.find((r) => r.k === 'session_id');
    const seedRow = STAGING_FIELD_CASTS.find((f) => f.k === 'session_id');
    expect(sessionRow?.raw).toBe(seedRow?.raw);
  });

  it('substitutes event_timestamp with the live last-event ISO value', () => {
    const rows = stagingRowsForProduct(
      { id: 'x', price: 1 },
      { last_event_at: '2026-04-21T18:15:02.000Z' },
    );
    const tsRow = rows.find((r) => r.k === 'event_timestamp');
    expect(tsRow?.raw).toBe('"2026-04-21T18:15:02.000Z"');
  });

  it('leaves event_timestamp as the seed when no live timestamp is provided', () => {
    const rows = stagingRowsForProduct({ id: 'x', price: 1 });
    const tsRow = rows.find((r) => r.k === 'event_timestamp');
    const seedRow = STAGING_FIELD_CASTS.find((f) => f.k === 'event_timestamp');
    expect(tsRow?.raw).toBe(seedRow?.raw);
  });
});

describe('stitchOpsForSession', () => {
  it('returns the seed ops verbatim when no live context is provided', () => {
    expect(stitchOpsForSession()).toEqual(STAGING_STITCH_OPS);
  });

  it('rewrites session_stitch.detail with the real session id + event count', () => {
    const ops = stitchOpsForSession({
      session_id: 'abc12345-6789-4def-8abc-deadbeefcafe',
      events_in_session: 7,
    });
    const stitch = ops.find((o) => o.op === 'session_stitch');
    expect(stitch?.detail).toMatch(/abc12345/);
    expect(stitch?.detail).toMatch(/7 events/);
  });

  it('leaves dedupe / param_extract / geo_enrich unchanged even with live context', () => {
    const ops = stitchOpsForSession({ session_id: 'x'.repeat(36), events_in_session: 99 });
    for (const op of ['dedupe', 'param_extract', 'geo_enrich']) {
      const live = ops.find((o) => o.op === op);
      const seed = STAGING_STITCH_OPS.find((o) => o.op === op);
      expect(live).toEqual(seed);
    }
  });

  // Pass-1 eval fix — session_stitch.detail must NOT emit
  // "linked to abc12345… (0 events)" during the pre-first-event window
  // when cookie is loaded but no events have flowed. It's a lie — there
  // are no events yet.
  it('leaves session_stitch as seed when session_id is set but events_in_session=0', () => {
    const ops = stitchOpsForSession({
      session_id: 'abc12345-6789-4def-8abc-deadbeefcafe',
      events_in_session: 0,
    });
    const stitch = ops.find((o) => o.op === 'session_stitch');
    const seed = STAGING_STITCH_OPS.find((o) => o.op === 'session_stitch');
    expect(stitch).toEqual(seed);
  });
});
