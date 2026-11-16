/**
 * Claudish translator — shared chrome-suppression predicates
 * (feat/claudish M2, phase E4).
 *
 * Four routes-aware predicates that previously lived inline in three
 * separate client wrappers, extracted so a new route (here /claudish)
 * is one edit, not four. Footer, bubbles and HomeBar hide on the shop
 * (/demo/ecommerce*), and the HomeBar on / too; LiveStrip was
 * unconditional before /claudish. 17.1 deleted the /demo catalog, so
 * the predicates name the shop rather than the /demo prefix.
 */
import {
  showAmbientBubbles,
  showHomeBar,
  showLiveStrip,
  showReviewLink,
  showSiteFooter,
} from '@/lib/chrome/suppression';
import { REVIEW_PAGE_HREF } from '@/lib/content/review';

describe('showSiteFooter', () => {
  it.each(['/', '/services', '/about', '/contact'])('shows on %s', (p) => {
    expect(showSiteFooter(p)).toBe(true);
  });
  it.each(['/demo/ecommerce', '/demo/ecommerce/cart', '/claudish'])('hides on %s', (p) => {
    expect(showSiteFooter(p)).toBe(false);
  });
});

describe('showAmbientBubbles', () => {
  it.each(['/', '/services'])('shows on %s', (p) => {
    expect(showAmbientBubbles(p)).toBe(true);
  });
  it.each(['/demo/ecommerce', '/demo/ecommerce/cart', '/claudish'])('hides on %s', (p) => {
    expect(showAmbientBubbles(p)).toBe(false);
  });
});

describe('showHomeBar', () => {
  it.each(['/services', '/about', '/contact'])('shows on %s', (p) => {
    expect(showHomeBar(p)).toBe(true);
  });
  it.each(['/', '/demo/ecommerce', '/demo/ecommerce/cart', '/claudish'])('hides on %s', (p) => {
    expect(showHomeBar(p)).toBe(false);
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
  // The rule follows the review page's one constant, not a retyped path.
  it('hides on whatever REVIEW_PAGE_HREF is', () => {
    expect(showReviewLink(REVIEW_PAGE_HREF)).toBe(false);
  });
  it.each(['/', '/services', '/contact/thanks', '/demo/ecommerce', '/claudish'])(
    'shows on %s',
    (p) => {
      expect(showReviewLink(p)).toBe(true);
    },
  );
});
