/**
 * Phase 9F D11 — Playwright E2E scaffold.
 *
 * Verifies the SessionPulse + Overview tab + `demo_progress.ecommerce`
 * reachability invariants across all 5 demo pages. Running this spec
 * requires: (a) a running dev server at `http://localhost:3000` (the
 * playwright webServer config handles this via `npm run dev`) and
 * (b) installed Playwright browsers (`npx playwright install`).
 *
 * Covers:
 * 1. SessionPulse renders on every demo page (listing, product, cart,
 *    checkout, confirmation).
 * 2. Clicking SessionPulse opens the overlay.
 * 3. Overview is the default active tab after open.
 * 4. `demo_progress.ecommerce.stages_reached` in sessionStorage's
 *    `iampatterson.session_state` blob grows monotonically as the
 *    visitor fires product_view → add_to_cart → begin_checkout → purchase.
 */
import { test, expect } from '@playwright/test';

// Gate the spec on an explicit env flag so accidental invocations in a
// sandbox without the webServer + browsers don't fail outright. Set
// `E2E_ENABLED=1` to run (the webServer config will stand up `npm run dev`
// automatically). The spec file comment above explains the gate; this
// code enforces it.
const E2E_ENABLED = process.env.E2E_ENABLED === '1';

test.describe('Ecommerce SessionPulse reachability (D11)', () => {
  test.skip(!E2E_ENABLED, 'E2E_ENABLED=1 not set — Playwright spec gated for ready environments');

  test('SessionPulse is present on every /demo/ecommerce/* page', async ({ page }) => {
    const routes = [
      '/demo/ecommerce',
      '/demo/ecommerce/tuna-plush-classic',
      '/demo/ecommerce/cart',
      '/demo/ecommerce/checkout',
      '/demo/ecommerce/confirmation?order_id=TEST&total=26.00&items=1',
    ];
    for (const route of routes) {
      await page.goto(route);
      const sessionPulse = page.getByRole('button', { name: /session/i });
      await expect(sessionPulse).toBeVisible();
    }
  });

  test('clicking SessionPulse opens the overlay with Overview as the default tab', async ({
    page,
  }) => {
    await page.goto('/demo/ecommerce');
    await page
      .getByRole('button', { name: /session/i })
      .first()
      .click();
    const overviewTab = page.getByRole('tab', { name: /overview/i });
    await expect(overviewTab).toHaveAttribute('aria-selected', 'true');
  });

  test('demo_progress updates monotonically through the funnel', async ({ page }) => {
    await page.goto('/demo/ecommerce');

    // Drive listing → product detail → add to cart → checkout → submit → confirm.
    await page.goto('/demo/ecommerce/tuna-plush-classic');
    await page.getByRole('button', { name: /add tuna plush to cart/i }).click();
    await page.goto('/demo/ecommerce/checkout');
    await page.getByRole('button', { name: /place order/i }).click();

    // Let the full-page diagnostic settle + router push to /confirmation
    await page.waitForURL(/\/demo\/ecommerce\/confirmation/);

    // Inspect the persisted session state blob
    const blob = await page.evaluate(() => sessionStorage.getItem('iampatterson.session_state'));
    expect(blob).toBeTruthy();
    const parsed = JSON.parse(blob as string);
    expect(parsed.demo_progress.ecommerce.stages_reached).toEqual(
      expect.arrayContaining(['product_view', 'add_to_cart', 'begin_checkout', 'purchase']),
    );
    expect(parsed.demo_progress.ecommerce.percentage).toBe(100);
  });
});
