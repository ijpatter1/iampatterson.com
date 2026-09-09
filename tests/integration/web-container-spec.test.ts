/**
 * Verifies the web GTM container spec declares the Phase 6 demo events.
 *
 * Until 2026-09-08 this also parsed `deploy-phase6.js`'s source and asserted
 * the two agreed. Neither was an input to the other, so the pin compared two
 * hand-maintained lists; the script has been retired and the spec is now what
 * the reconciler applies.
 *
 * Guards against the drift pattern flagged in
 * MEMORY.md → project_hardcoded_allowlists.md: schema adds a new
 * event (e.g. remove_from_cart) but the downstream GTM trigger/tag
 * pair never follows, so the near-cart toast claims routing to GA4
 * + BigQuery while the web container has no tag bound to the event.
 */
import * as fs from 'fs';
import * as path from 'path';

const webContainerPath = path.resolve(__dirname, '../../infrastructure/gtm/web-container.json');

const webContainer = JSON.parse(fs.readFileSync(webContainerPath, 'utf-8'));

type Trigger = { name: string; type: string; eventName?: string };
type TagParams = Record<string, string>;
type Tag = {
  name: string;
  type: string;
  eventName?: string;
  parameters?: TagParams;
  firingTrigger?: string;
};

const triggers: Trigger[] = webContainer.triggers;
const tags: Tag[] = webContainer.tags;

function findTrigger(eventName: string): Trigger | undefined {
  return triggers.find((t) => t.eventName === eventName && t.type === 'customEvent');
}

function findGA4Tag(eventName: string): Tag | undefined {
  return tags.find((t) => t.name === `GA4 - ${eventName}`);
}

describe('web GTM container spec, Phase 6 ecommerce cart events', () => {
  describe('add_to_cart (baseline pattern to mirror)', () => {
    it('has a customEvent trigger', () => {
      const trigger = findTrigger('add_to_cart');
      expect(trigger).toBeDefined();
      expect(trigger?.name).toBe('ce - add_to_cart');
    });

    it('has a GA4 event tag firing on that trigger with the product param set', () => {
      const tag = findGA4Tag('add_to_cart');
      expect(tag).toBeDefined();
      expect(tag?.eventName).toBe('add_to_cart');
      expect(tag?.firingTrigger).toBe('ce - add_to_cart');
      expect(tag?.parameters).toEqual(
        expect.objectContaining({
          product_id: expect.any(String),
          product_name: expect.any(String),
          product_price: expect.any(String),
          quantity: expect.any(String),
        }),
      );
    });
  });

  describe('remove_from_cart (must mirror add_to_cart)', () => {
    it('has a customEvent trigger', () => {
      const trigger = findTrigger('remove_from_cart');
      expect(trigger).toBeDefined();
      expect(trigger?.name).toBe('ce - remove_from_cart');
    });

    it('has a GA4 event tag firing on that trigger', () => {
      const tag = findGA4Tag('remove_from_cart');
      expect(tag).toBeDefined();
      expect(tag?.eventName).toBe('remove_from_cart');
      expect(tag?.firingTrigger).toBe('ce - remove_from_cart');
    });

    it('GA4 tag forwards the same 4 product params as add_to_cart', () => {
      const tag = findGA4Tag('remove_from_cart');
      expect(tag?.parameters).toEqual(
        expect.objectContaining({
          product_id: '{{dlv - product_id}}',
          product_name: '{{dlv - product_name}}',
          product_price: '{{dlv - product_price}}',
          quantity: '{{dlv - quantity}}',
        }),
      );
    });

    it('GA4 tag requires analytics_storage consent (mirrors siblings)', () => {
      const tag = findGA4Tag('remove_from_cart');
      expect(
        (tag as unknown as { consentSettings: { analytics_storage: string } }).consentSettings
          .analytics_storage,
      ).toBe('required');
    });
  });
});

/**
 * Re-homed 2026-09-08 ([14.1]) off `deploy-phase6.js`'s source text.
 *
 * Four assertions here used to parse the deploy script with regexes —
 * PHASE6_TRIGGER_EVENTS, the `GA4 - remove_from_cart` block, its trigger and
 * its params. They existed to catch the drift the file header names: the
 * schema gains an event and the GTM trigger/tag pair never follows. But they
 * checked a hardcoded JS constant against a JSON file where neither was an
 * input to the other, and the script has now been retired.
 *
 * The reconciler applies the committed spec, so the spec is what production
 * runs. Asserting against it is both a real pin and a stronger one: this
 * generalises to every ecommerce event rather than hardcoding the one that
 * happened to go missing in 2026-04.
 */
describe('every ecommerce event the schema declares is wired in the container', () => {
  const ECOMMERCE_EVENTS = [
    'product_view',
    'add_to_cart',
    'remove_from_cart',
    'begin_checkout',
    'purchase',
  ];

  it.each(ECOMMERCE_EVENTS)('%s has a customEvent trigger', (eventName) => {
    expect(findTrigger(eventName)).toBeDefined();
  });

  it.each(ECOMMERCE_EVENTS)('%s has a GA4 tag bound to that trigger', (eventName) => {
    const tag = findGA4Tag(eventName);
    expect(tag).toBeDefined();
    expect(tag?.firingTrigger).toBe(`ce - ${eventName}`);
  });

  it('cart events carry the product parameters the demo claims to send', () => {
    // The near-cart toast tells a visitor the event routed to GA4 and
    // BigQuery with these fields. A tag missing them makes that a false claim.
    for (const eventName of ['add_to_cart', 'remove_from_cart']) {
      const params = findGA4Tag(eventName)?.parameters ?? {};
      for (const field of ['product_id', 'product_name', 'product_price', 'quantity']) {
        expect(Object.keys(params)).toContain(field);
      }
    }
  });
});

/**
 * `web_vital` and `page_engagement` wiring (Phase 14, deliverable 14.4).
 *
 * Both events have been in `DATA_LAYER_EVENT_NAMES` since Phases 10b and 10d,
 * `schema.test.ts` has asserted them for as long, and `schema.json` carries all
 * seven of their columns. The container had no trigger and no tag for either,
 * so they fired into the data layer and stopped there.
 *
 * Measured 2026-09-09, after the version 9 publish: a production session fired
 * six `web_vital` and two `page_engagement` events with analytics consent
 * granted, and `events_raw` received none of them. `web_vital` is deliberately
 * rendered as a coverage chip on the Overview tab (`schema.ts:415` — "Hiding
 * `web_vital` would contradict the 'making the invisible visible' thesis"), so
 * until this lands the overlay shows visitors a chip for an event the pipeline
 * does not carry.
 */
describe('14.4 — web_vital and page_engagement reach the container', () => {
  const WIRED = {
    web_vital: ['metric_name', 'metric_value', 'metric_rating', 'metric_id', 'navigation_type'],
    page_engagement: ['engagement_seconds', 'max_scroll_pct'],
  } as const;

  const variableNames = new Set(webContainer.variables.map((v: { name: string }) => v.name));

  it.each(Object.keys(WIRED))('%s has a customEvent trigger', (eventName) => {
    expect(findTrigger(eventName)).toBeDefined();
  });

  it.each(Object.keys(WIRED))('%s has a GA4 tag bound to that trigger', (eventName) => {
    const tag = findGA4Tag(eventName);
    expect(tag).toBeDefined();
    expect(tag?.firingTrigger).toBe(`ce - ${eventName}`);
  });

  it.each(Object.entries(WIRED))(
    '%s declares a data layer variable for every parameter it sends',
    (_eventName, params) => {
      for (const param of params) {
        expect(variableNames).toContain(`dlv - ${param}`);
      }
    },
  );

  it.each(Object.entries(WIRED))('%s binds each parameter to its variable', (eventName, params) => {
    // The failure this catches: the dlv exists, the tag never references it,
    // the BigQuery column lands null, and the overlay claims a field that was
    // never sent. Asserting the binding rather than the variable's existence
    // is the difference.
    const tag = findGA4Tag(eventName);
    for (const param of params) {
      expect(tag?.parameters?.[param]).toBe(`{{dlv - ${param}}}`);
    }
  });

  it('gates both on analytics consent, like every other GA4 event tag', () => {
    // Published version 9 requires analytics_storage on 21 of 22 tags. A new
    // tag that forgot it would collect from declining visitors — the exact
    // posture Ian chose against.
    for (const eventName of Object.keys(WIRED)) {
      expect(findGA4Tag(eventName)?.consentSettings?.analytics_storage).toBe('required');
    }
  });
});
