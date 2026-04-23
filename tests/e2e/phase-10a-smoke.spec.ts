/**
 * Phase 10a D6 interactive browser smoke.
 *
 * Complements the HTTP-surface smoke the Pass-1 fix-pack ran via
 * `next start` (10/10 routes 200, SSR HTML content signatures verified,
 * server log clean) with a real-Chromium pass that exercises what
 * jsdom can't: React 19 hydration timing, Suspense boundaries, overlay
 * interaction, add-to-cart toast rendering, and the Metabase iframe
 * cold-load path on `/demo/ecommerce/confirmation`.
 *
 * Gated on `E2E_ENABLED=1` matching the ecommerce-sessionpulse spec
 * convention. Assumes the dev server is already running on port 3000
 * (user's own, or via the playwright.config.ts webServer config) on
 * Next 16.2.4 + React 19.
 *
 * Scope priorities from session-2026-04-23-002 handoff Next Steps #2:
 *   1. Homepage hero renders, no hydration warnings in console.
 *   2. SessionPulse overlay boot + tab cycle (Overview/Timeline/Consent)
 *      without render-loops — specifically targeting the overlay-view.tsx
 *      / overview-tab.tsx / session-state-provider.tsx hooks suppressed by
 *      the four disabled `react-hooks/*` React-Compiler rules. If any of
 *      the rule-suppressed patterns were actually harmful under React 19,
 *      the symptom would land here.
 *   3. Ecommerce listing → product → add-to-cart toast → cart → checkout
 *      → confirmation flow completes, toast animates in.
 *   4. Confirmation page renders the Metabase iframe (or env-gate
 *      fallback) — verifies the async-searchParams codemod landed
 *      cleanly and the Server Component resolves without error.
 *
 * Implementation notes:
 * - Overlay tabs are plain `<button>` with `aria-label`, not
 *   `role="tab"` — select via `getByRole('button', { name: /.../i })`.
 * - Toast event name is the raw dataLayer name (`add_to_cart`), not a
 *   humanised string.
 * - Confirmation-page `page.goto` must use `waitUntil: 'domcontentloaded'`
 *   because the `after()` hook fires a fetch to `bi.iampatterson.com`
 *   that in dev can hang `networkidle` well past the 30s test timeout.
 *   The D2 contract only requires the Server Component to render; the
 *   warmup deliberately doesn't block render.
 */
import { test, expect, type ConsoleMessage } from '@playwright/test';

const E2E_ENABLED = process.env.E2E_ENABLED === '1';

type Severity = 'error' | 'warning';
interface ConsoleIssue {
  severity: Severity;
  text: string;
  location?: string;
}

const IGNORED_CONSOLE_PATTERNS = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  /Cookiebot/i,
  /cookieinformation/i,
  /preload.*was preloaded using link preload but not used/i,
  /net::ERR_BLOCKED_BY_CLIENT/i,
  // Dev-mode Next 16 chatter
  /\[webpack\.cache/i,
  /\[turbopack\]/i,
];

function shouldIgnore(msg: string): boolean {
  return IGNORED_CONSOLE_PATTERNS.some((rx) => rx.test(msg));
}

function wireConsoleCapture(page: import('@playwright/test').Page, bucket: ConsoleIssue[]): void {
  page.on('console', (msg: ConsoleMessage) => {
    const type = msg.type();
    if (type !== 'error' && type !== 'warning') return;
    const text = msg.text();
    if (shouldIgnore(text)) return;
    bucket.push({
      severity: type,
      text,
      location: msg.location().url,
    });
  });
  page.on('pageerror', (err) => {
    if (shouldIgnore(err.message)) return;
    bucket.push({ severity: 'error', text: `pageerror: ${err.message}` });
  });
}

test.describe('Phase 10a D6 interactive smoke', () => {
  test.skip(!E2E_ENABLED, 'E2E_ENABLED=1 not set, gated for ready environments');

  test('homepage hydrates cleanly — no console errors, no hydration warnings', async ({ page }) => {
    const issues: ConsoleIssue[] = [];
    wireConsoleCapture(page, issues);

    await page.goto('/');

    const hero = page.getByRole('heading', { level: 1 });
    await expect(hero).toBeVisible();
    await expect(hero).toHaveText(/I build/i);

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const hydrationIssues = issues.filter((i) =>
      /hydrat|did not match|text content does not match|server rendered html/i.test(i.text),
    );
    expect(hydrationIssues).toEqual([]);

    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toEqual([]);
  });

  test('SessionPulse overlay boots, tabs cycle, closes and reopens cleanly', async ({ page }) => {
    const issues: ConsoleIssue[] = [];
    wireConsoleCapture(page, issues);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // SessionPulse is the amber pill affordance in the header chrome.
    // aria-label="Open your session" per `src/components/chrome/session-pulse.tsx`.
    await page.getByRole('button', { name: /open your session/i }).click();

    // The homepage has a non-overlay "Overview" button in the footer/chrome
    // area, so scope tab selectors to the overlay root via its testid.
    // Overlay tabs are plain `<button>` with `aria-label={tab.label}`
    // (see Tabs component in `src/components/overlay/overlay-view.tsx:70-120`),
    // not `role="tab"`. Overview is the default active tab on open.
    const overlay = page.getByTestId('overlay-view');
    const overviewBtn = overlay.getByRole('button', { name: /^overview$/i });
    await expect(overviewBtn).toBeVisible();

    // Cycle all three tabs. If `set-state-in-effect` or `refs`
    // suppressed patterns in overlay-view.tsx / overview-tab.tsx caused
    // cascading renders or stale-ref reads, tab interaction would hang,
    // flicker, or surface a console error here.
    const timelineBtn = overlay.getByRole('button', { name: /^timeline$/i });
    await timelineBtn.click();

    const consentBtn = overlay.getByRole('button', { name: /^consent$/i });
    await consentBtn.click();

    await overviewBtn.click();

    // Close + reopen. The close path exercises overlay-view.tsx's
    // `hasBooted.current` ref read (flagged by react-hooks/refs).
    // A stale-ref regression would show as the overlay failing to
    // re-enter the boot animation or remaining in a mid-state.
    // The overlay stays in the DOM after close (for the boot animation
    // replay on reopen), but becomes aria-hidden + pointer-events-none;
    // check the testid attribute rather than visibility.
    await page.keyboard.press('Escape');
    await expect(overlay).toHaveAttribute('aria-hidden', 'true');

    await page.getByRole('button', { name: /open your session/i }).click();
    await expect(overlay).toHaveAttribute('aria-hidden', 'false');
    await expect(overviewBtn).toBeVisible();

    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toEqual([]);
  });

  test('ecommerce flow: listing → product → add-to-cart toast → cart → checkout → confirmation', async ({
    page,
  }) => {
    const issues: ConsoleIssue[] = [];
    wireConsoleCapture(page, issues);

    await page.goto('/demo/ecommerce');
    await expect(page.getByRole('heading', { name: /tuna/i }).first()).toBeVisible();

    await page.goto('/demo/ecommerce/tuna-plush-classic');

    await page.getByRole('button', { name: /add tuna plush to cart/i }).click();

    // Toast headline is the raw event name (`add_to_cart`), not a
    // humanised string. The toast-provider exposes `role="status"` on
    // each card — match by the event name text which is the visible
    // amber line inside the card.
    const toast = page.getByText(/^add_to_cart$/i).first();
    await expect(toast).toBeVisible({ timeout: 5000 });

    await page.goto('/demo/ecommerce/cart');
    await expect(page.getByRole('heading', { name: /cart/i })).toBeVisible();

    await page.goto('/demo/ecommerce/checkout');
    await page.getByRole('button', { name: /place order/i }).click();

    await page.waitForURL(/\/demo\/ecommerce\/confirmation/);
    await expect(page.getByText(/order confirmed/i)).toBeVisible();

    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toEqual([]);
  });

  test('confirmation page renders the Metabase dashboard iframe (or env-gate fallback) without errors', async ({
    page,
  }) => {
    const issues: ConsoleIssue[] = [];
    wireConsoleCapture(page, issues);

    // `after()` fires a warmup fetch to `bi.iampatterson.com` that
    // doesn't block render. `waitUntil: 'domcontentloaded'` is enough
    // — `'networkidle'` would hang on the warmup's network chain.
    await page.goto('/demo/ecommerce/confirmation?order_id=SMOKE-10a&total=44.98&items=2', {
      waitUntil: 'domcontentloaded',
    });

    // Wait for the closing beat (always-present) to confirm the Server
    // Component resolved its `await props.searchParams`.
    await expect(page.getByText(/Dashboards are not the payoff/i)).toBeVisible({
      timeout: 10000,
    });

    // Two valid outcomes depending on env config (both exercise the
    // D1 codemod + D2 `after()` wiring correctly):
    //   (a) Signed iframe: src starts with
    //       https://bi.iampatterson.com/embed/dashboard/...
    //   (b) Fallback copy when MB_EMBEDDING_SECRET_KEY /
    //       METABASE_EMBED_CONFIG env vars aren't wired.
    const iframeSrc = await page
      .locator('iframe')
      .first()
      .getAttribute('src')
      .catch(() => null);
    const fallbackText = page.getByText(/signing env vars aren't wired|dashboard embeds disabled/i);
    const fallbackVisible = await fallbackText.isVisible().catch(() => false);

    const iframeOk =
      typeof iframeSrc === 'string' &&
      /^https:\/\/bi\.iampatterson\.com\/embed\/dashboard\//.test(iframeSrc);

    expect(
      iframeOk || fallbackVisible,
      `Expected signed Metabase iframe or env-gate fallback. iframeSrc=${iframeSrc ?? 'null'}, fallbackVisible=${fallbackVisible}`,
    ).toBe(true);

    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toEqual([]);
  });
});
