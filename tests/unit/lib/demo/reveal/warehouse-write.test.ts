import {
  BQ_ROW_COLUMNS,
  RAW_EVENTS_COLUMN_COUNT,
  bqRowForCart,
  FULL_PAGE_DIAGNOSTIC_LINES,
  diagnosticLinesForConsent,
} from '@/lib/demo/reveal/warehouse-write';
import { trackPurchase, trackSessionPulseHover } from '@/lib/events/track';
import * as fs from 'fs';
import * as path from 'path';

const schema: { name: string; type: string }[] = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'infrastructure/bigquery/schema.json'), 'utf-8'),
);

const CART_PRODUCTS = JSON.stringify([
  { product_id: 'tuna-plush-classic', product_name: 'Tuna Plush', price: 26, quantity: 2 },
]);

describe('warehouse-write, BQ row preview', () => {
  // The checkout tells the visitor this is the row that lands in
  // iampatterson_raw.events_raw, "N of the M real columns". So every column
  // it shows must exist there with the type it shows, and M must be the
  // table's real width. Before 2026-11-14 the preview showed nine columns the
  // table does not have and claimed 51 columns of 77.
  it('shows only columns that exist in infrastructure/bigquery/schema.json, with their real types', () => {
    const schemaTypes = new Map(schema.map((f) => [f.name, f.type]));
    const shown = bqRowForCart({ total: 0, itemCount: 0, products: CART_PRODUCTS });
    for (const c of shown) {
      expect({ column: c.k, type: schemaTypes.get(c.k) }).toEqual({ column: c.k, type: c.type });
    }
  });

  it('states the table width the schema actually has', () => {
    expect(RAW_EVENTS_COLUMN_COUNT).toBe(schema.length);
  });

  it('shows no visitor ID column: nothing forwards _iap_aid to BigQuery yet', () => {
    const keys = BQ_ROW_COLUMNS.map((c) => c.k);
    expect(keys).not.toContain('user_pseudo_id');
    expect(keys).not.toContain('anonymous_id');
  });

  // The checkout presents this as the row the purchase event writes, so it
  // must be a purchase row: event_name 'purchase', and every column specific
  // to the event is one trackPurchase actually sends. The keys are read from
  // the real function's data-layer push, not from a hand-written list.
  describe('a true purchase row', () => {
    // Columns GA4 or sGTM fill in, not the data-layer event itself.
    const PIPELINE_ADDED = new Set([
      'event_name',
      'received_timestamp',
      'client_id',
      'page_location',
      'page_referrer',
      'utm_source',
      'utm_campaign',
    ]);
    function pushedKeys(fire: () => void): Set<string> {
      window.dataLayer = [];
      document.cookie = '_iap_sid=test-session; Path=/';
      fire();
      return new Set(Object.keys(window.dataLayer[0] as object));
    }

    it("pins event_name to 'purchase'", () => {
      expect(BQ_ROW_COLUMNS.find((c) => c.k === 'event_name')?.v).toBe('"purchase"');
    });

    it('shows only event-specific columns that trackPurchase sends', () => {
      const baseKeys = pushedKeys(() => trackSessionPulseHover());
      const purchaseKeys = pushedKeys(() =>
        trackPurchase({ order_id: 'ORD-1', order_total: 1, item_count: 1, products: '[]' }),
      );
      const eventSpecific = BQ_ROW_COLUMNS.map((c) => c.k).filter(
        (k) => !baseKeys.has(k) && !PIPELINE_ADDED.has(k),
      );
      expect(eventSpecific.length).toBeGreaterThan(0);
      expect(eventSpecific.filter((k) => !purchaseKeys.has(k))).toEqual([]);
      // And the preview leaves none of the purchase's own columns out.
      const purchaseSpecific = [...purchaseKeys].filter((k) => !baseKeys.has(k) && k !== 'event');
      expect(eventSpecific.sort()).toEqual(purchaseSpecific.sort());
    });
  });

  it('includes the expected core columns', () => {
    const keys = BQ_ROW_COLUMNS.map((c) => c.k);
    expect(keys).toContain('event_name');
    expect(keys).toContain('timestamp');
    expect(keys).toContain('session_id');
    expect(keys).toContain('order_id');
    expect(keys).toContain('order_total');
    expect(keys).toContain('item_count');
    expect(keys).toContain('products');
    expect(keys).toContain('utm_source');
    expect(keys).toContain('consent_analytics');
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
  it('substitutes order_id / order_total / item_count / products with the order the form will submit', () => {
    const rows = bqRowForCart({
      total: 52.5,
      itemCount: 3,
      products: CART_PRODUCTS,
      orderId: 'ORD-LIVE123',
    });
    expect(rows.find((c) => c.k === 'order_id')?.v).toBe('"ORD-LIVE123"');
    expect(rows.find((c) => c.k === 'order_total')?.v).toBe('52.50');
    expect(rows.find((c) => c.k === 'item_count')?.v).toBe('3');
    // products is a STRING column holding the cart as JSON, as the purchase
    // event sends it.
    expect(rows.find((c) => c.k === 'products')?.v).toBe(`"${CART_PRODUCTS}"`);
  });

  it('preserves non-cart columns unchanged when no live context supplied', () => {
    const rows = bqRowForCart({ total: 0, itemCount: 0, products: CART_PRODUCTS });
    const sid = rows.find((c) => c.k === 'session_id');
    expect(sid?.v).toBe('"ses_x9b2jk3q"'); // seed
  });

  // UAT r1 items 11 + 13, checkout sidebar advertised as live but all
  // visitor-scoped columns (session_id, timestamps, consent) were static.
  describe('UAT r1 items 11 + 13, live substitutions', () => {
    it('substitutes session_id with the real id (truncated 8 chars + ellipsis)', () => {
      const rows = bqRowForCart({
        total: 26,
        itemCount: 1,
        products: CART_PRODUCTS,
        live: { sessionId: 'abc12345-6789-4def-8abc-deadbeefcafe' },
      });
      expect(rows.find((c) => c.k === 'session_id')?.v).toBe('"abc12345…"');
    });

    it('substitutes timestamp + received_timestamp with the live ISO + its ms', () => {
      const iso = '2026-04-21T18:15:02.000Z';
      const rows = bqRowForCart({
        total: 0,
        itemCount: 0,
        products: CART_PRODUCTS,
        live: { eventTimestamp: iso },
      });
      expect(rows.find((c) => c.k === 'timestamp')?.v).toBe(`"${iso}"`);
      expect(rows.find((c) => c.k === 'received_timestamp')?.v).toBe(String(Date.parse(iso)));
    });

    it('substitutes consent_analytics / consent_marketing with the real flags as BOOL', () => {
      const rows = bqRowForCart({
        total: 0,
        itemCount: 0,
        products: CART_PRODUCTS,
        live: { consentAnalytics: true, consentMarketing: false },
      });
      expect(rows.find((c) => c.k === 'consent_analytics')?.v).toBe('true');
      expect(rows.find((c) => c.k === 'consent_marketing')?.v).toBe('false');
    });

    it('consent columns fall back to seed when no live consent is supplied', () => {
      const rows = bqRowForCart({
        total: 0,
        itemCount: 0,
        products: CART_PRODUCTS,
        live: { sessionId: 'x'.repeat(36) }, // live ctx, but no consent keys
      });
      // Seed values stay intact (consent keys not in the partial ctx).
      expect(rows.find((c) => c.k === 'consent_analytics')?.v).toBe('true');
      expect(rows.find((c) => c.k === 'consent_marketing')?.v).toBe('false');
    });

    // Pass-1 product-review fix: page + utm columns were hardcoded-as-live.
    it('substitutes page_location / page_referrer when supplied', () => {
      const rows = bqRowForCart({
        total: 0,
        itemCount: 0,
        products: CART_PRODUCTS,
        live: {
          pageLocation: 'https://iampatterson.com/demo/ecommerce/checkout',
          pageReferrer: 'https://iampatterson.com/demo/ecommerce/cart',
        },
      });
      expect(rows.find((c) => c.k === 'page_location')?.v).toBe(
        '"https://iampatterson.com/demo/ecommerce/checkout"',
      );
      expect(rows.find((c) => c.k === 'page_referrer')?.v).toBe(
        '"https://iampatterson.com/demo/ecommerce/cart"',
      );
    });

    // A real-site row never carries utm_* (measured in BigQuery 2026-11-14:
    // nothing in the tag setup sends them; only the data generator fills
    // them), so the preview shows NULL, whatever the URL carried.
    it('shows utm_source and utm_campaign as NULL, as a real-site row stores them', () => {
      const rows = bqRowForCart({
        total: 0,
        itemCount: 0,
        products: CART_PRODUCTS,
        live: { sessionId: 'abc12345-6789-4def-8abc-deadbeefcafe' },
      });
      expect(rows.find((c) => c.k === 'utm_source')?.v).toBe('NULL');
      expect(rows.find((c) => c.k === 'utm_campaign')?.v).toBe('NULL');
    });

    it('shows page_referrer as NULL when the visitor has no referrer', () => {
      const rows = bqRowForCart({
        total: 0,
        itemCount: 0,
        products: CART_PRODUCTS,
        live: {
          pageLocation: 'https://iampatterson.com/demo/ecommerce/checkout',
          pageReferrer: '',
        },
      });
      expect(rows.find((c) => c.k === 'page_referrer')?.v).toBe('NULL');
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

describe('diagnosticLinesForConsent (UAT r1 item 14, real consent data)', () => {
  it('reports analytics=granted + marketing=denied on the consent-check line', () => {
    const lines = diagnosticLinesForConsent({ analytics: true, marketing: false });
    const consentLine = lines.find((l) => l.text.startsWith('consent check'));
    expect(consentLine?.text).toBe('consent check · analytics=granted, marketing=denied');
  });

  it('reports analytics=denied + marketing=granted on the consent-check line', () => {
    const lines = diagnosticLinesForConsent({ analytics: false, marketing: true });
    const consentLine = lines.find((l) => l.text.startsWith('consent check'));
    expect(consentLine?.text).toBe('consent check · analytics=denied, marketing=granted');
  });

  it('Meta CAPI line is OK + "event sent" when marketing=granted (not SKIP)', () => {
    const lines = diagnosticLinesForConsent({ analytics: true, marketing: true });
    const meta = lines.find((l) => l.text.includes('Meta CAPI'));
    expect(meta?.tag).toBe('OK');
    expect(meta?.text).toMatch(/event sent/);
  });

  it('Meta CAPI line is SKIP + "skipped" when marketing=denied', () => {
    const lines = diagnosticLinesForConsent({ analytics: true, marketing: false });
    const meta = lines.find((l) => l.text.includes('Meta CAPI'));
    expect(meta?.tag).toBe('SKIP');
    expect(meta?.text).toMatch(/skipped/);
  });

  it('final line is always the LIVE emph dashboards refresh', () => {
    const lines = diagnosticLinesForConsent({ analytics: false, marketing: false });
    const last = lines[lines.length - 1];
    expect(last.tag).toBe('LIVE');
    expect(last.emph).toBe(true);
  });
});
