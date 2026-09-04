/**
 * Route-aware chrome-suppression predicates.
 *
 * One module answers "which site chrome renders on this pathname" for
 * the four suppressible pieces, so adding a route (the /claudish
 * Translate clone was the fourth consumer) is one edit here instead of
 * a hunt across client wrappers. The pre-extraction behavior of every
 * predicate is pinned verbatim in tests/unit/lib/chrome/suppression.test.ts.
 *
 * /claudish suppresses everything below except the Header shell:
 * SessionPulse stays (Translate has an app bar, and the pulse is the
 * site's thesis affordance), while LiveStrip / HomeBar / Footer /
 * AmbientBubbles would each break the clone's fidelity.
 */

const CLAUDISH = '/claudish';

export function showSiteFooter(pathname: string): boolean {
  if (pathname.startsWith('/demo/ecommerce')) return false;
  if (pathname.startsWith(CLAUDISH)) return false;
  return true;
}

export function showAmbientBubbles(pathname: string): boolean {
  if (pathname.startsWith('/demo')) return false;
  if (pathname.startsWith(CLAUDISH)) return false;
  return true;
}

/**
 * Moved verbatim from header.tsx (F8 eval Minor #10 rationale preserved):
 * demo routes ship their own back-nav affordances; stacking HomeBar
 * would triple the chrome. Note `/demo/` keeps its original trailing
 * slash, so bare /demo intentionally still shows the bar.
 */
export function showHomeBar(pathname: string): boolean {
  if (pathname === '/') return false;
  if (pathname.startsWith('/demo/')) return false;
  if (pathname.startsWith(CLAUDISH)) return false;
  return true;
}

/** LiveStrip was unconditional until /claudish: a marquee of SESSION /
 * STACK / CONSENT directly under the app bar reads as site chrome, not
 * as Google Translate. */
export function showLiveStrip(pathname: string): boolean {
  return !pathname.startsWith(CLAUDISH);
}
