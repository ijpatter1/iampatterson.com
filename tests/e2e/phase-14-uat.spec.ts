/**
 * Phase 14 UAT — the checks that were asking a human to do a machine's job.
 *
 * The first draft of `docs/uat/phase-14-uat.sh` carried seven `confirm()`
 * gates. Audited, five of them were programmatically verifiable and one was
 * half so — meaning five places where a tired operator clicking through a
 * 50-check run would have produced a green tick that asserted nothing. That is
 * the same defect Phase 14 exists to eliminate (a check that cannot fail), just
 * wearing a human costume, and Rule 8's "recurring mechanical patterns graduate
 * to tests" applies.
 *
 * This spec takes the two that need a browser. The other three moved into the
 * shell script directly: the approval gate reads the deployments API (whose
 * state history literally records `waiting`), and both BI questions read
 * BigQuery and the Metabase API.
 *
 * What stays human, and should: whether the rollback runbook is usable at 3am
 * without asking anyone, and whether the overlay's *wording* is honest to a
 * declining visitor. Those are judgments about prose, not facts about state.
 *
 * Gated on E2E_ENABLED=1, against the dev server on port 3000 like the other
 * e2e specs.
 */
import { test, expect, type Page } from '@playwright/test';

const ENABLED = process.env.E2E_ENABLED === '1';

/**
 * Cookiebot's own `CookieConsent` cookie, in the all-denied shape.
 *
 * Setting the cookie rather than driving the CMP dialog is deliberate: the
 * dialog is third-party DOM that changes without our say-so, and
 * `mobile-matrix.spec.ts` already documents the cost of coupling to its
 * internals. The cookie is the contract the application itself reads —
 * `overlay-view.tsx:144` keys "has the visitor chosen" on its presence — so
 * asserting against it tests our behaviour, not Cookiebot's markup.
 */
const DENIED_CONSENT =
  '{stamp:%27uat%27,necessary:true,preferences:false,statistics:false,marketing:false,method:%27explicit%27,ver:1}';

async function withDeniedConsent(page: Page) {
  await page
    .context()
    .addCookies([{ name: 'CookieConsent', value: DENIED_CONSENT, domain: 'localhost', path: '/' }]);
}

test.describe('Phase 14 [14.1] — the consent gate actually gates', () => {
  test.skip(!ENABLED, 'E2E_ENABLED=1 required');

  test('a declining visitor leaks no analytics hit beyond the consent_update exemption', async ({
    page,
  }) => {
    // Four navigations against a COLD Next.js dev server, each compiling its
    // route on first hit. Playwright's 30s default is not enough and the test
    // flaked once inside a full UAT run — reporting FAIL when nothing was wrong,
    // which in an acceptance script is as damaging as a check that cannot fail.
    //
    // Warming the routes first would be the faster fix and is deliberately NOT
    // taken: a leak on FIRST load is a plausible shape (a page_view racing the
    // consent state), and warming would fire exactly that navigation with the
    // listener detached. The measured window must include the first load, so
    // the budget moves instead.
    test.setTimeout(180_000);

    // Recorded before navigation so nothing fires before the listener attaches.
    const collectHits: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (/google-analytics\.com\/g\/collect/.test(url) || /\/g\/collect\?/.test(url)) {
        collectHits.push(url);
      }
    });

    await withDeniedConsent(page);
    await page.goto('/');

    // Browse enough to generate the events that WOULD be sent under consent:
    // a page_view per route, scroll depth, and an engagement window.
    for (const route of ['/', '/services', '/demo/ecommerce']) {
      await page.goto(route);
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(600);
    }

    // NOT "zero hits". `GA4 - consent_update` is the container's one deliberate
    // exemption — web-container.json records "No consent requirement —
    // consent_update must fire regardless of consent state to track the consent
    // change itself" — and every other GA4 tag carries
    // consent: { analytics_storage: 'required' }.
    //
    // So the real claim is narrower and sharper: nothing BUT that exemption may
    // reach the endpoint. A leaking page_view, scroll_depth or form_submit is
    // the privacy regression, and this catches it while the categorical version
    // would have failed on correct behaviour. A human staring at DevTools would
    // have seen three /g/collect rows and had to make this same judgement on the
    // spot, with the event name buried in a 900-character query string.
    const leaked = collectHits.filter((u) => !/[?&]en=consent_update(&|$)/.test(u));
    expect(leaked, `analytics hits escaped with consent denied:\n${leaked.join('\n')}`)
      .toHaveLength(0);

    // And the exempt hits must themselves carry denied signals: gcs=G100 is
    // ad_storage=0, analytics_storage=0. An exemption that shipped granted
    // consent would be the same leak wearing the exemption's name.
    for (const hit of collectHits) {
      expect(hit, 'consent_update fired without denied consent signals').toMatch(/[?&]gcs=G10[01]/);
      expect(hit).toMatch(/ep\.consent_analytics=false/);
    }
  });

  test('the overlay does not claim delivery for events the gate blocked', async ({ page }) => {
    test.setTimeout(120_000); // cold dev-server route compiles, as above
    await withDeniedConsent(page);
    await page.goto('/');
    await page.mouse.wheel(0, 1800);
    // Dwell before opening. The property under test is that events accumulate
    // and are shown; asserting it too early is what made the previous version
    // pass on a race rather than on behaviour.
    await page.waitForTimeout(2000);

    await page
      .getByRole('button', { name: /session/i })
      .first()
      .click();
    await expect(page.getByTestId('overview-tab')).toBeVisible();
    await page.waitForTimeout(1500);

    // Assert the honesty-bearing STATE.
    //
    // Two earlier versions of this were wrong, in opposite directions. The first
    // checked the tab did not contain "delivered to GA4" — a phrase that appears
    // nowhere in src/, so it could not fail. The second asserted the coverage
    // readout was 0/27, which is worse: measured with adequate dwell the overlay
    // reports 6/27 with six chips fired, so that assertion passed only by
    // reading the readout before events accumulated. It rewarded a broken
    // overlay (permanently zero) and punished the correct one.
    //
    // The site's thesis is showing a visitor their own session. A declining
    // visitor should see their events — that is the transparency — and see that
    // they were BLOCKED rather than delivered. So the honest state is:
    // consent reads DENIED, and the timeline is NOT empty.
    for (const signal of ['analytics', 'marketing', 'preferences']) {
      await expect(page.getByTestId(`consent-row-${signal}`)).toContainText('DENIED');
    }

    // Events fired client-side and are shown. Anchored so a stuck-at-zero
    // overlay fails rather than passing as "nothing to report".
    await expect(page.getByTestId('coverage-readout')).toHaveText(/^>?\s*[1-9]\d*\/\d+/);
    const firedChips = page.locator('[data-chip="event-chip"][data-fired="true"]');
    await expect(firedChips.first()).toBeAttached();
  });
});

test.describe('Phase 14 [14.4] — web_vital reaches the overlay', () => {
  test.skip(!ENABLED, 'E2E_ENABLED=1 required');

  test('the web_vital coverage chip renders on the Overview tab', async ({ page }) => {
    test.setTimeout(120_000); // cold dev-server route compiles, as above
    await page.goto('/');
    await page
      .getByRole('button', { name: /session/i })
      .first()
      .click();

    const overview = page.getByTestId('overview-tab');
    await expect(overview).toBeVisible();

    // [14.4]'s visitor-facing payoff: the deliverable wired web_vital through
    // GTM, and the chip is where a visitor sees that it landed. Asserting the
    // chip EXISTS is the deliverable's claim; whether it has fired yet depends
    // on which vitals the browser has reported, so that is not asserted.
    const chip = page.getByTestId('chip-web_vital');
    await expect(chip).toBeAttached();
    await expect(chip).toHaveAttribute('data-chip-name', 'web_vital');

    // page_engagement shipped in the same deliverable and through the same path.
    await expect(page.getByTestId('chip-page_engagement')).toBeAttached();
  });
});
