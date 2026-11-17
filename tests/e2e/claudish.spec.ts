/**
 * Claudish translator — E2E flow (feat/claudish, phase F2).
 *
 * Gated on E2E_ENABLED=1 like every Playwright spec in this repo. The
 * proxy is intercepted with a synthetic SSE body via page.route() — no
 * live Vertex, no spend — so what's under test is the real page wiring:
 * type → detect label → stream → copy → share → open the share link.
 * Run with NEXT_PUBLIC_CLAUDISH_PROXY_URL set (any https URL; it's
 * intercepted before leaving the browser).
 */
import { expect, test } from '@playwright/test';

import { CLAUDISH_SAMPLES } from '../../src/lib/claudish/samples';

const E2E_ENABLED = process.env.E2E_ENABLED === '1';

const CLAUDISH_INPUT =
  "This isn't just a refactor — it's a fundamental shift in how the pipeline thinks about state.";

const SSE_BODY = [
  'data: {"type":"meta","lane":"vertex-global","cached":false}',
  '',
  'data: {"type":"token","t":"A refactor. "}',
  '',
  'data: {"type":"token","t":"Nothing more."}',
  '',
  'data: {"type":"done","chars":25}',
  '',
  '',
].join('\n');

test.describe('Claudish translator', () => {
  test.skip(!E2E_ENABLED, 'E2E_ENABLED=1 not set, Playwright spec gated for ready environments');

  test.beforeEach(async ({ page }) => {
    await page.route('**/translate', async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Access-Control-Allow-Origin': '*',
        },
        body: SSE_BODY,
      });
    });
  });

  test('detects Claudish while typing and streams a translation', async ({ page }) => {
    await page.goto('/claudish');
    // The page opens on an example with its English tab; clearing it
    // hands the box back to Detect, as a visitor starting fresh would.
    await page.getByRole('button', { name: 'Clear source text' }).click();
    await page.getByRole('textbox').fill(CLAUDISH_INPUT);
    await expect(page.getByRole('tab', { name: 'Claudish - detected' })).toBeVisible();
    await expect(page.getByTestId('claudish-output')).toContainText(
      'A refactor. Nothing more.',
      { timeout: 5000 }
    );
  });

  test('copy and share produce a rehydratable link', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/claudish');
    // The page opens on an example with its English tab; clearing it
    // hands the box back to Detect, as a visitor starting fresh would.
    await page.getByRole('button', { name: 'Clear source text' }).click();
    await page.getByRole('textbox').fill(CLAUDISH_INPUT);
    await expect(page.getByTestId('claudish-output')).toContainText('Nothing more.');

    await page.getByRole('button', { name: 'Copy translation' }).click();
    await expect(page.getByText('Copied')).toBeVisible();

    await page.getByRole('button', { name: 'Share translation' }).click();
    const shareUrl = await page.evaluate(() => navigator.clipboard.readText());
    expect(shareUrl).toContain('/claudish?t=');

    // Opening the share link rehydrates both panels with no proxy call.
    let proxyCalls = 0;
    await page.route('**/translate', async (route) => {
      proxyCalls++;
      await route.abort();
    });
    await page.goto(shareUrl);
    await expect(page.getByRole('textbox')).toHaveValue(CLAUDISH_INPUT);
    await expect(page.getByTestId('claudish-output')).toContainText('Nothing more.');
    expect(proxyCalls).toBe(0);
    // The parse-time strip: the payload never lingers in the address bar
    // (it IS the input text — referrer/analytics must never see it).
    await expect
      .poll(() => page.url(), { timeout: 3000 })
      .not.toContain('t=');
  });

  test('opens on a translated example and a sample tap makes no proxy call', async ({ page }) => {
    // The samples are stored real output (21.3): showing one costs nothing.
    let proxyCalls = 0;
    await page.route('**/translate', async (route) => {
      proxyCalls++;
      await route.abort();
    });
    await page.goto('/claudish');
    const [first, , claudish] = CLAUDISH_SAMPLES;
    await expect(page.getByRole('textbox')).toHaveValue(first.source);
    await expect(page.getByTestId('claudish-output')).toHaveText(first.target);
    await page.getByRole('list', { name: 'Try one' }).getByRole('button').nth(2).click();
    await expect(page.getByRole('textbox')).toHaveValue(claudish.source);
    await expect(page.getByTestId('claudish-output')).toHaveText(claudish.target);
    // Well past the 600ms debounce: a late request would have landed.
    await page.waitForTimeout(1500);
    expect(proxyCalls).toBe(0);
  });

  test('suppressed chrome: no site footer, no LiveStrip marquee', async ({ page }) => {
    await page.goto('/claudish');
    // The page opens on a translated example (21.3), so both match: take the first.
    await expect(
      page.getByTestId('claudish-output').or(page.getByRole('textbox')).first(),
    ).toBeVisible();
    await expect(page.locator('[data-testid="home-bar"]')).toHaveCount(0);
    // The page's own footer exists.
    await expect(page.getByText('Not affiliated with Google. Yet.')).toBeVisible();
  });
});
