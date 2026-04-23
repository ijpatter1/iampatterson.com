/**
 * Verifies the web GTM container spec + the deploy-phase6 script
 * agree on the Phase 6 demo event allow-list.
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
const deployScriptPath = path.resolve(__dirname, '../../infrastructure/gtm/deploy-phase6.js');

const webContainer = JSON.parse(fs.readFileSync(webContainerPath, 'utf-8'));
const deployScriptSource = fs.readFileSync(deployScriptPath, 'utf-8');

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

describe('deploy-phase6.js, Phase 6 ecommerce cart events', () => {
  it('PHASE6_TRIGGER_EVENTS lists remove_from_cart', () => {
    const triggerBlock =
      deployScriptSource.match(/const PHASE6_TRIGGER_EVENTS = \[([\s\S]*?)\];/)?.[1] ?? '';
    expect(triggerBlock).toContain("'remove_from_cart'");
  });

  it('PHASE6_TAGS declares a GA4 - remove_from_cart entry', () => {
    expect(deployScriptSource).toMatch(/name:\s*'GA4 - remove_from_cart'/);
  });

  it('GA4 - remove_from_cart tag fires on the remove_from_cart trigger', () => {
    const tagBlock =
      deployScriptSource.match(
        /name:\s*'GA4 - remove_from_cart',[\s\S]*?triggerEvent:\s*'([^']+)'/,
      )?.[1] ?? '';
    expect(tagBlock).toBe('remove_from_cart');
  });

  it('GA4 - remove_from_cart params mirror add_to_cart (product_id/name/price/quantity)', () => {
    const tagBlock = deployScriptSource.match(
      /name:\s*'GA4 - remove_from_cart',[\s\S]*?params:\s*\[([\s\S]*?)\],\s*\},/,
    )?.[1];
    expect(tagBlock).toBeDefined();
    expect(tagBlock).toContain("'product_id'");
    expect(tagBlock).toContain("'product_name'");
    expect(tagBlock).toContain("'product_price'");
    expect(tagBlock).toContain("'quantity'");
  });
});
