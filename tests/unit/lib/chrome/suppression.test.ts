/**
 * Claudish translator — shared chrome-suppression predicates
 * (feat/claudish M2, phase E4).
 *
 * Four routes-aware predicates that previously lived inline in three
 * separate client wrappers, extracted so a new route (here /claudish)
 * is one edit, not four. Existing behavior is pinned exactly: footer
 * hides on /demo/ecommerce*, bubbles hide on /demo*, HomeBar hides on
 * / and /demo/*; LiveStrip was unconditional before /claudish.
 */
import {
  showAmbientBubbles,
  showHomeBar,
  showLiveStrip,
  showReviewLink,
  showSiteFooter,
} from '@/lib/chrome/suppression';

describe('showSiteFooter', () => {
  it.each(['/', '/services', '/about', '/contact'])('shows on %s', (p) => {
    expect(showSiteFooter(p)).toBe(true);
  });
  it.each(['/demo/ecommerce', '/demo/ecommerce/cart', '/claudish'])('hides on %s', (p) => {
    expect(showSiteFooter(p)).toBe(false);
  });
  it('shows on the demo hub (only the ecommerce shell has its own footer)', () => {
    expect(showSiteFooter('/demo')).toBe(true);
  });
});

describe('showAmbientBubbles', () => {
  it.each(['/', '/services'])('shows on %s', (p) => {
    expect(showAmbientBubbles(p)).toBe(true);
  });
  it.each(['/demo', '/demo/ecommerce', '/claudish'])('hides on %s', (p) => {
    expect(showAmbientBubbles(p)).toBe(false);
  });
});

describe('showHomeBar', () => {
  it.each(['/services', '/about', '/contact'])('shows on %s', (p) => {
    expect(showHomeBar(p)).toBe(true);
  });
  it.each(['/', '/demo/ecommerce', '/claudish'])('hides on %s', (p) => {
    expect(showHomeBar(p)).toBe(false);
  });
  it('keeps the pre-extraction quirk: bare /demo shows the HomeBar', () => {
    // The original predicate tested startsWith('/demo/') — trailing slash —
    // so /demo itself showed the bar. Preserved verbatim by the move.
    expect(showHomeBar('/demo')).toBe(true);
  });
});

describe('showLiveStrip', () => {
  it.each(['/', '/services', '/demo/ecommerce'])('shows on %s', (p) => {
    expect(showLiveStrip(p)).toBe(true);
  });
  it('hides on /claudish — a scrolling marquee under the app bar breaks the clone', () => {
    expect(showLiveStrip('/claudish')).toBe(false);
  });
});

// 15.4: the header's review link. On /review it would link to the page
// itself, and on /contact it would send a visitor who is already booking back
// a step.
describe('showReviewLink', () => {
  it.each(['/review', '/contact'])('hides on %s', (p) => {
    expect(showReviewLink(p)).toBe(false);
  });
  it.each(['/', '/services', '/contact/thanks', '/demo/ecommerce', '/claudish'])(
    'shows on %s',
    (p) => {
      expect(showReviewLink(p)).toBe(true);
    },
  );
});
