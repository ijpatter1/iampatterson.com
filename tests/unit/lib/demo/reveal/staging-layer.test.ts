import {
  STAGING_FIELD_CASTS,
  STAGING_STITCH_OPS,
  stagingRowsForProduct,
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
});
