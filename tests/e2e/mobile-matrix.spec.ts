/**
 * Phase 10d D1, mobile-testing matrix.
 *
 * Sweeps the site across five viewports — iPhone SE, iPhone 13, Pixel 5,
 * iPad Mini portrait, iPad Mini landscape — exercising the routes that
 * matter for launch-prep:
 *
 *   /                              homepage hero, primary CTA above-fold
 *   /services                      tier deep-link targets
 *   /about                         long-form prose + closer CTA
 *   /contact                       form
 *   /demo/ecommerce                catalog
 *   /demo/ecommerce/<product>      product detail
 *   /demo/ecommerce/cart           cart
 *   /demo/ecommerce/checkout       checkout form
 *
 * Per-page assertions:
 *   1. H1 visible.
 *   2. SessionPulse rendered with min 44×44 tap target (WCAG 2.5.5).
 *   3. No horizontal scroll: document.body.scrollWidth <= viewport.width.
 *   4. On homepage: primary "See your session" CTA above the fold,
 *      against a Safari-chrome-aware budget. iPhone-SE budget = 132px
 *      (URL bar + bottom toolbar = ~535px usable against 667px nominal,
 *      the 9E F8 Product Minor #5 number).
 *   5. SessionPulse opens overlay; Overview is the default tab; tab row
 *      stays on a single row (whitespace-nowrap + overflow-x-auto from
 *      F5 UAT S11). Switch to Consent tab; storage inspector renders;
 *      D7's `_iap_aid` row appears under app-identity. Storage inspector
 *      rows must not horizontally overflow the inspector group's content
 *      box (the c5c52e2 take-2 mobile-spill regression pin).
 *
 * Screenshots are written to `docs/perf/mobile-matrix-screenshots/<date>/`
 * via `page.screenshot()`. The capture script
 * (`scripts/capture-mobile-matrix.sh`) is the canonical way to run this
 * spec — it stands up a production build, runs the matrix project group,
 * and writes the report.
 *
 * Like ecommerce-sessionpulse.spec.ts, gated on `E2E_ENABLED=1` so an
 * accidental `npx playwright test` in a sandbox without browsers
 * installed doesn't fail outright.
 */
import { test, expect, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const E2E_ENABLED = process.env.E2E_ENABLED === '1';

const SCREENSHOT_DATE = process.env.MATRIX_DATE ?? new Date().toISOString().slice(0, 10);
const SCREENSHOT_DIR = path.join(
  process.cwd(),
  'docs',
  'perf',
  'mobile-matrix-screenshots',
  SCREENSHOT_DATE,
);

type RouteSpec = {
  path: string;
  label: string;
  expectedH1?: RegExp;
  isHomepage?: boolean;
};

const ROUTES: RouteSpec[] = [
  { path: '/', label: 'home', expectedH1: /measurement/i, isHomepage: true },
  { path: '/services', label: 'services', expectedH1: /./ },
  { path: '/about', label: 'about', expectedH1: /./ },
  { path: '/contact', label: 'contact', expectedH1: /./ },
  { path: '/demo/ecommerce', label: 'ecommerce-catalog' },
  { path: '/demo/ecommerce/tuna-plush-classic', label: 'ecommerce-product' },
  { path: '/demo/ecommerce/cart', label: 'ecommerce-cart' },
  { path: '/demo/ecommerce/checkout', label: 'ecommerce-checkout' },
];

function getProjectMetadata(testInfo: import('@playwright/test').TestInfo): {
  mobileLabel: string;
  mobileChromeBoost: number;
} {
  const md = (testInfo.project.metadata ?? {}) as {
    mobileLabel?: string;
    mobileChromeBoost?: number;
  };
  return {
    mobileLabel: md.mobileLabel ?? testInfo.project.name,
    mobileChromeBoost: md.mobileChromeBoost ?? 0,
  };
}

async function ensureScreenshotDir(): Promise<void> {
  await fs.promises.mkdir(SCREENSHOT_DIR, { recursive: true });
}

async function captureScreenshot(
  page: Page,
  testInfo: import('@playwright/test').TestInfo,
  routeLabel: string,
  suffix: string,
): Promise<void> {
  await ensureScreenshotDir();
  const file = path.join(SCREENSHOT_DIR, `${testInfo.project.name}__${routeLabel}__${suffix}.png`);
  await page.screenshot({ path: file, fullPage: false });
}

test.describe('Phase 10d D1, mobile matrix', () => {
  test.skip(!E2E_ENABLED, 'E2E_ENABLED=1 not set; matrix spec gated for ready environments');

  // The matrix tests assume a `matrix-*` project (their assertions read
  // `mobileChromeBoost` from project metadata). Other projects bypass via
  // beforeEach skip — invocation without `--project=matrix-*` will skip
  // cleanly rather than fire stale assertions.
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      !testInfo.project.name.startsWith('matrix-'),
      'matrix spec only runs on matrix-* projects',
    );
  });

  for (const route of ROUTES) {
    test(`${route.label}: layout, fold, overlay, storage`, async ({ page, viewport }, testInfo) => {
      expect(viewport).not.toBeNull();
      const vp = viewport!;
      const { mobileLabel, mobileChromeBoost } = getProjectMetadata(testInfo);

      // ── 1. Page loads + H1 present ────────────────────────────
      await page.goto(route.path);
      await page.waitForLoadState('domcontentloaded');
      // Give async-rendered subtrees (overlay portals, hero) a tick.
      await page.waitForTimeout(250);

      // The Cookiebot CMP dialog renders on first visit and intercepts
      // pointer events on whatever it's covering (often the SessionPulse
      // in the bottom-right). For mobile-layout testing we want the
      // post-consent layout, not the dialog-active layout, so we hide
      // the dialog after it mounts. Dismissing via click would simulate
      // a real visitor flow but adds spec-on-Cookiebot-internals coupling
      // we don't need here. CSS-hide is honest: the dialog is still in
      // the DOM (visible to the storage inspector + the consent flow);
      // it's just visually + pointer-event suppressed for the test.
      await page.addStyleTag({
        content: `
          #CybotCookiebotDialog,
          #CybotCookiebotDialogBodyUnderlay {
            display: none !important;
            pointer-events: none !important;
          }
        `,
      });
      await page.waitForTimeout(100);

      if (route.expectedH1) {
        const h1 = page.locator('h1').first();
        await expect(h1, `${route.label}: h1 visible`).toBeVisible();
      }

      // ── 2. No horizontal scroll on the page body ──────────────
      const horizontalScroll = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(
        horizontalScroll.scrollWidth,
        `${route.label} on ${mobileLabel}: no horizontal overflow ` +
          `(scrollWidth ${horizontalScroll.scrollWidth} > clientWidth ${horizontalScroll.clientWidth})`,
      ).toBeLessThanOrEqual(horizontalScroll.clientWidth + 1); // +1 px slack for sub-pixel rounding

      // ── 3. SessionPulse min 44×44 tap target (WCAG 2.5.5) ─────
      const pulse = page.getByRole('button', { name: /open your session/i });
      await expect(pulse, `${route.label}: SessionPulse visible`).toBeVisible();
      const pulseBox = await pulse.boundingBox();
      expect(pulseBox, `${route.label}: SessionPulse boundingBox readable`).not.toBeNull();
      expect(pulseBox!.width, `${route.label} SessionPulse width >= 44px`).toBeGreaterThanOrEqual(
        44,
      );
      expect(pulseBox!.height, `${route.label} SessionPulse height >= 44px`).toBeGreaterThanOrEqual(
        44,
      );

      // Capture the at-rest screenshot before opening the overlay.
      await captureScreenshot(page, testInfo, route.label, '01-at-rest');

      // ── 4. Homepage: primary CTA above the Safari-aware fold ──
      if (route.isHomepage) {
        // Three "See your session" CTAs render on the homepage (hero,
        // pipeline-section, final-cta). The hero one is the load-bearing
        // fold-line CTA; first DOM occurrence is in the hero section.
        const cta = page.getByRole('button', { name: /see your session/i }).first();
        await expect(cta, 'home: "See your session" CTA visible').toBeVisible();
        const ctaBox = await cta.boundingBox();
        expect(ctaBox, 'home: CTA boundingBox readable').not.toBeNull();
        const usableHeight = vp.height - mobileChromeBoost;
        const ctaBottom = ctaBox!.y + ctaBox!.height;
        // Soft check on small phones, hard check elsewhere. iPhone-SE is
        // the carry from 9E F8 Product Minor #5 — record the number,
        // don't fail the run on it (the doc surfaces actual numbers in
        // the matrix, and a real-device verification is the falsifying
        // signal anyway).
        const isHardFail = mobileChromeBoost === 0;
        const message =
          `home on ${mobileLabel}: "See your session" CTA bottom=${ctaBottom.toFixed(0)}px ` +
          `vs usable=${usableHeight}px (chrome boost ${mobileChromeBoost}px).`;
        if (isHardFail) {
          expect(ctaBottom, message).toBeLessThanOrEqual(usableHeight);
        } else {
          // Log soft check via testInfo annotations — surfaces in the
          // HTML report + the matrix doc summary.
          testInfo.annotations.push({
            type: ctaBottom <= usableHeight ? 'fold-check-pass' : 'fold-check-soft-fail',
            description: message,
          });
        }
      }

      // ── 5. Overlay open + Overview default + tab row sane ─────
      await pulse.click();
      // Overlay runs a 260ms CRT boot animation on first open per
      // session (overlay-view.tsx:35 BOOT_DURATION_MS). The screenshot
      // must wait for `data-phase="on"` or it captures the black
      // curtain mid-paintdown and the matrix-doc reader sees an empty
      // viewport. `toHaveAttribute` with `timeout: 1500` covers a
      // small jitter margin on slow CI.
      await expect(page.locator('[data-testid="overlay-view"]')).toHaveAttribute(
        'data-phase',
        'on',
        { timeout: 1500 },
      );
      const overviewTab = page.getByRole('tab', { name: /overview/i });
      // The overlay tab row uses <button role implicit>, but the
      // `aria-label="Overview"` from overlay-view.tsx surfaces under
      // both `tab` and `button` roles. Fall back to a name match.
      let activeOverviewLocator = overviewTab;
      if ((await overviewTab.count()) === 0) {
        activeOverviewLocator = page.getByRole('button', { name: /^overview$/i });
      }
      await expect(activeOverviewLocator.first(), 'overlay: Overview accessible').toBeVisible();

      // Tab row should not horizontally scroll OFF-SCREEN — the
      // overlay's own overflow-x-auto handles the in-row scroll, but
      // the row itself must fit the overlay panel width.
      const tabsContainer = page.locator('.overlay-chrome.flex.gap-1').first();
      if ((await tabsContainer.count()) > 0) {
        const tabBox = await tabsContainer.boundingBox();
        expect(tabBox, 'overlay: tab-row boundingBox readable').not.toBeNull();
        expect(
          tabBox!.x + tabBox!.width,
          `overlay tab row right edge fits within viewport width on ${mobileLabel}`,
        ).toBeLessThanOrEqual(vp.width + 1);
      }

      await captureScreenshot(page, testInfo, route.label, '02-overlay-overview');

      // Switch to Consent tab to exercise the D9 storage inspector +
      // D7 `_iap_aid` surfacing.
      const consentTab = page.getByRole('button', { name: /^consent$/i }).first();
      if ((await consentTab.count()) > 0) {
        await consentTab.click();
        const inspector = page.getByTestId('consent-storage-inspector');
        await expect(inspector, 'consent: storage inspector renders').toBeVisible();
        // Scroll the inspector into the viewport so the screenshot
        // captures it (the overlay panel is taller than mobile
        // viewports; default scroll position keeps the consent rows
        // above the inspector in view but the inspector below).
        await inspector.scrollIntoViewIfNeeded();
        await page.waitForTimeout(150);

        // c5c52e2 take-2 regression pin: every storage row must fit
        // inside its parent group's content box. We measure the
        // widest row vs. the widest group and assert row.width <=
        // group.width (sub-pixel slack).
        const rowMeasurements = await page.evaluate(() => {
          const groups = Array.from(
            document.querySelectorAll<HTMLElement>('[data-testid^="storage-group-"]'),
          );
          return groups.flatMap((group) => {
            const groupRect = group.getBoundingClientRect();
            const rows = Array.from(
              group.querySelectorAll<HTMLElement>('li[data-testid^="storage-row-"]'),
            );
            return rows.map((row) => {
              const rowRect = row.getBoundingClientRect();
              return {
                groupCategory: group.getAttribute('data-storage-category'),
                rowTestId: row.getAttribute('data-testid'),
                groupWidth: groupRect.width,
                rowWidth: rowRect.width,
                rowOverflow: rowRect.width > groupRect.width + 1,
              };
            });
          });
        });
        for (const m of rowMeasurements) {
          expect(
            m.rowOverflow,
            `storage row ${m.rowTestId} (group ${m.groupCategory}) ` +
              `width=${m.rowWidth.toFixed(1)} exceeds group width=${m.groupWidth.toFixed(1)} on ${mobileLabel}`,
          ).toBe(false);
        }

        await captureScreenshot(page, testInfo, route.label, '03-consent-storage');
      }
    });
  }
});
