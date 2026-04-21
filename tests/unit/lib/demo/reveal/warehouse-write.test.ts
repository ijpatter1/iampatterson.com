import {
  BQ_ROW_COLUMNS,
  bqRowForCart,
  FULL_PAGE_DIAGNOSTIC_LINES,
} from '@/lib/demo/reveal/warehouse-write';

describe('warehouse-write — BQ row preview', () => {
  it('exposes 21 representative columns from the ~51-col raw schema', () => {
    expect(BQ_ROW_COLUMNS).toHaveLength(21);
  });

  it('includes the expected core columns', () => {
    const keys = BQ_ROW_COLUMNS.map((c) => c.k);
    expect(keys).toContain('event_name');
    expect(keys).toContain('session_id');
    expect(keys).toContain('cart_value');
    expect(keys).toContain('cart_item_count');
    expect(keys).toContain('items');
    expect(keys).toContain('utm_source');
    expect(keys).toContain('channel_classified');
    expect(keys).toContain('consent_analytics');
    expect(keys).toContain('ingested_at');
  });

  it('each column has key, value, and type', () => {
    for (const c of BQ_ROW_COLUMNS) {
      expect(c.k).toBeTruthy();
      expect(c.v).toBeTruthy();
      expect(c.type).toBeTruthy();
    }
  });
});

describe('bqRowForCart', () => {
  it('substitutes cart_value / cart_item_count / items with visitor cart state', () => {
    const rows = bqRowForCart({ total: 52.5, itemCount: 3, uniqueItems: 2 });
    expect(rows.find((c) => c.k === 'cart_value')?.v).toBe('52.50');
    expect(rows.find((c) => c.k === 'cart_item_count')?.v).toBe('3');
    expect(rows.find((c) => c.k === 'items')?.v).toBe('ARRAY<STRUCT>(2)');
  });

  it('preserves non-cart columns unchanged when no live context supplied', () => {
    const rows = bqRowForCart({ total: 0, itemCount: 0, uniqueItems: 0 });
    const channel = rows.find((c) => c.k === 'channel_classified');
    expect(channel?.v).toBe('"Meta · Prospecting"');
    const sid = rows.find((c) => c.k === 'session_id');
    expect(sid?.v).toBe('"ses_x9b2jk3q"'); // seed
  });

  // UAT r1 items 11 + 13 — checkout sidebar advertised as live but all
  // visitor-scoped columns (session_id, timestamps, consent) were static.
  describe('UAT r1 items 11 + 13 — live substitutions', () => {
    it('substitutes session_id with the real id (truncated 8 chars + ellipsis)', () => {
      const rows = bqRowForCart({
        total: 26,
        itemCount: 1,
        uniqueItems: 1,
        live: { sessionId: 'abc12345-6789-4def-8abc-deadbeefcafe' },
      });
      expect(rows.find((c) => c.k === 'session_id')?.v).toBe('"abc12345…"');
    });

    it('substitutes event_timestamp + received_timestamp with the live ISO + its ms', () => {
      const iso = '2026-04-21T18:15:02.000Z';
      const rows = bqRowForCart({
        total: 0,
        itemCount: 0,
        uniqueItems: 0,
        live: { eventTimestamp: iso },
      });
      expect(rows.find((c) => c.k === 'event_timestamp')?.v).toBe(`"${iso}"`);
      expect(rows.find((c) => c.k === 'received_timestamp')?.v).toBe(String(Date.parse(iso)));
    });

    it('substitutes consent_analytics / consent_marketing with the real flags', () => {
      const rows = bqRowForCart({
        total: 0,
        itemCount: 0,
        uniqueItems: 0,
        live: { consentAnalytics: true, consentMarketing: false },
      });
      expect(rows.find((c) => c.k === 'consent_analytics')?.v).toBe('"granted"');
      expect(rows.find((c) => c.k === 'consent_marketing')?.v).toBe('"denied"');
    });

    it('consent columns fall back to seed when no live consent is supplied', () => {
      const rows = bqRowForCart({
        total: 0,
        itemCount: 0,
        uniqueItems: 0,
        live: { sessionId: 'x'.repeat(36) }, // live ctx, but no consent keys
      });
      // Seed values stay intact (consent keys not in the partial ctx).
      expect(rows.find((c) => c.k === 'consent_analytics')?.v).toBe('"granted"');
      expect(rows.find((c) => c.k === 'consent_marketing')?.v).toBe('"denied"');
    });
  });
});

describe('FULL_PAGE_DIAGNOSTIC_LINES', () => {
  it('is the 7-line pipeline-journey sequence', () => {
    expect(FULL_PAGE_DIAGNOSTIC_LINES).toHaveLength(7);
  });

  it('first line is the purchase fire, final line is the dashboards refresh (emphasised)', () => {
    expect(FULL_PAGE_DIAGNOSTIC_LINES[0].text).toMatch(/purchase event fired/i);
    const last = FULL_PAGE_DIAGNOSTIC_LINES[FULL_PAGE_DIAGNOSTIC_LINES.length - 1];
    expect(last.text).toMatch(/dashboards.*revenue kpi/i);
    expect(last.emph).toBe(true);
    expect(last.tag).toBe('LIVE');
  });

  it('includes the Meta CAPI skip line', () => {
    const skip = FULL_PAGE_DIAGNOSTIC_LINES.find((l) => l.tag === 'SKIP');
    expect(skip?.text).toMatch(/Meta CAPI/i);
  });

  it('references the real BQ raw table', () => {
    const bq = FULL_PAGE_DIAGNOSTIC_LINES.find((l) => l.text.includes('BigQuery'));
    expect(bq?.text).toContain('iampatterson_raw.events_raw');
  });
});
