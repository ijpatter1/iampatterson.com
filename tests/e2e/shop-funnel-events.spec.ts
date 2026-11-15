/**
 * 17.1 removed the demo catalog and the shop's dashboards and kept the shop.
 * The shop is worth keeping only while it fires its events: a visitor walks
 * from a product to the confirmation page, and each step pushes its event
 * onto the data layer GTM reads. Whether those events then reach
 * `events_raw` is checked against the deployed site, not here.
 *
 * Every request that leaves localhost is aborted, so a run never sends an
 * event to the production pipeline.
 *
 * Gated on E2E_ENABLED=1, like the other specs.
 */
import { test, expect } from '@playwright/test';

const E2E_ENABLED = process.env.E2E_ENABLED === '1';
const RECORD_KEY = 'e2e.dataLayerEvents';

test.describe('the shop funnel fires its events (17.1)', () => {
  test.skip(!E2E_ENABLED, 'E2E_ENABLED=1 not set, gated for ready environments');

  test('product, cart, checkout and confirmation each push their event', async ({ page }) => {
    await page.route(
      (url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1',
      (route) => route.abort(),
    );
    // Record every event name pushed in this tab. sessionStorage survives the
    // page loads between steps, so the record covers the whole walk.
    await page.addInitScript((key) => {
      const layer: Record<string, unknown>[] =
        (window as unknown as { dataLayer?: [] }).dataLayer ?? [];
      const push = layer.push.bind(layer);
      layer.push = (...items: Record<string, unknown>[]) => {
        const seen = JSON.parse(sessionStorage.getItem(key) ?? '[]') as string[];
        for (const item of items) if (typeof item?.event === 'string') seen.push(item.event);
        sessionStorage.setItem(key, JSON.stringify(seen));
        return push(...items);
      };
      (window as unknown as { dataLayer: unknown }).dataLayer = layer;
    }, RECORD_KEY);
    const recorded = () =>
      page.evaluate(
        (key) => JSON.parse(sessionStorage.getItem(key) ?? '[]') as string[],
        RECORD_KEY,
      );

    await page.goto('/demo/ecommerce/tuna-plush-classic');
    await expect.poll(recorded).toContain('product_view');

    await page.getByRole('button', { name: /add tuna plush to cart/i }).click();
    await expect.poll(recorded).toContain('add_to_cart');

    await page.goto('/demo/ecommerce/cart');
    await page.goto('/demo/ecommerce/checkout');
    await expect.poll(recorded).toContain('begin_checkout');

    await page.getByRole('button', { name: /place order/i }).click();
    await page.waitForURL(/\/demo\/ecommerce\/confirmation/, { timeout: 10_000 });
    await expect(page.getByText(/order confirmed/i)).toBeVisible();
    await expect.poll(recorded).toContain('purchase');

    // In funnel order: each step's event lands after the one before it.
    const names = await recorded();
    const order = ['product_view', 'add_to_cart', 'begin_checkout', 'purchase'].map((n) =>
      names.indexOf(n),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});
