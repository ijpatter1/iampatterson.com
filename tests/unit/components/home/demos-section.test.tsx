/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DemosSection } from '@/components/home/demos-section';

// Phase 9E D6 rewrite: the three-card track is replaced by a single
// full-width ecommerce section. The `rebuild` query param drives the
// honesty banner that shows when a visitor is bounced here from a 301
// redirect (`/demo/subscription/*` or `/demo/leadgen/*` — wired in D7's
// next.config.mjs).

jest.mock('@/lib/events/track', () => ({
  trackClickCta: jest.fn(),
}));

let mockSearchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

import { trackClickCta } from '@/lib/events/track';

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = new URLSearchParams();
});

describe('DemosSection — post-9E-D6 single ecommerce section', () => {
  it('keeps the anchor id "demos" to match the /#demos hash target', () => {
    render(<DemosSection />);
    expect(screen.getByTestId('demos-section').id).toBe('demos');
  });

  it('renders an editorial eyebrow kicker calling out Ecommerce / Tiers 2 + 3', () => {
    // UX_PIVOT_SPEC §3.7 suggests `Demo · Ecommerce · Tiers 2 + 3` as
    // the eyebrow framing. Exact wording is editorial; the test pins
    // the required tokens (Ecommerce + Tiers 2 + 3) rather than an
    // exact string, so copy polish passes don't break.
    render(<DemosSection />);
    const section = screen.getByTestId('demos-section');
    expect(section.textContent).toMatch(/Ecommerce/i);
    expect(section.textContent).toMatch(/Tier[s]?\s*2\s*\+\s*3/i);
  });

  it('renders an oversized serif headline for narrative framing', () => {
    render(<DemosSection />);
    const h2 = screen.getByRole('heading', { level: 2 });
    expect(h2.className).toContain('font-display');
  });

  it('renders the primary "Enter the demo →" CTA linking to /demo/ecommerce', () => {
    render(<DemosSection />);
    const cta = screen.getByRole('link', { name: /enter the demo/i });
    expect(cta).toHaveAttribute('href', '/demo/ecommerce');
  });

  it('fires click_cta with cta_location demo_card_ecommerce when the CTA is clicked', async () => {
    // `demo_card_ecommerce` is retained across the D6 rewrite to keep
    // the analytics time-series intact (no rename = no split series).
    // See schema.ts comment at the editorial/page-specific section.
    const user = userEvent.setup();
    render(<DemosSection />);
    await user.click(screen.getByRole('link', { name: /enter the demo/i }));
    expect(trackClickCta).toHaveBeenCalledWith(expect.any(String), 'demo_card_ecommerce');
  });

  it('does NOT render subscription or lead gen cards (both removed from site in D7)', () => {
    render(<DemosSection />);
    expect(screen.queryByRole('link', { name: /tuna subscription/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /tuna partnerships/i })).not.toBeInTheDocument();
  });

  it('does NOT render the mobile swipe-hint bars (3-card track retired)', () => {
    render(<DemosSection />);
    expect(screen.queryByTestId('swipe-hint')).not.toBeInTheDocument();
    expect(screen.queryByTestId('swipe-bar-0')).not.toBeInTheDocument();
  });

  // UAT r1 item 1 — the pre-rework headline + body fought non-existent
  // friction ("Instead of toggling an overlay…") and puffed significance
  // ("Watch a purchase become a KPI"). These regression pins make sure
  // the reverted phrasing does not come back.
  describe('UAT r1 item 1 — headline + body voice rework', () => {
    it('does NOT use the pre-rework headline "Watch a purchase become a KPI"', () => {
      render(<DemosSection />);
      const section = screen.getByTestId('demos-section');
      expect(section.textContent).not.toMatch(/watch a purchase become a kpi/i);
    });

    it('headline names BigQuery (specific, in-voice replacement for the abstract "KPI" headline)', () => {
      render(<DemosSection />);
      const h2 = screen.getByRole('heading', { level: 2 });
      expect(h2.textContent).toMatch(/bigquery/i);
    });

    it('body does NOT use the "Instead of toggling an overlay" framing (attacks non-existent friction)', () => {
      render(<DemosSection />);
      const section = screen.getByTestId('demos-section');
      expect(section.textContent).not.toMatch(/instead of toggling/i);
    });

    it('body does NOT use internal jargon "Tier 3 payoff"', () => {
      render(<DemosSection />);
      const section = screen.getByTestId('demos-section');
      expect(section.textContent).not.toMatch(/tier 3 payoff/i);
    });

    it('body names the real stack pieces (server-side GTM, BigQuery, Metabase)', () => {
      render(<DemosSection />);
      const section = screen.getByTestId('demos-section');
      expect(section.textContent).toMatch(/server-side gtm/i);
      expect(section.textContent).toMatch(/bigquery/i);
      expect(section.textContent).toMatch(/metabase/i);
    });
  });

  // UAT r2 item 5 — the pre-r2 "Preview · sample event" box was
  // flagged as pointless fluff + pushed the section too long on mobile.
  // Decision: drop on mobile (hide via `hidden md:block`), keep on
  // desktop as a palette-tile product hero (Tuna Plush Classic palette).
  describe('UAT r2 item 5 — demos-section hero visual', () => {
    it('does NOT render the old "Preview · sample event" pre-block', () => {
      render(<DemosSection />);
      const section = screen.getByTestId('demos-section');
      expect(section.textContent).not.toMatch(/preview · sample event/i);
      expect(section.textContent).not.toMatch(/\[OK\] schema_validation/);
    });

    it('renders a palette-tile hero element with the Tuna Plush Classic base color', () => {
      render(<DemosSection />);
      const hero = document.querySelector('[data-demos-section-hero]') as HTMLElement;
      expect(hero).not.toBeNull();
      // c1 = #E8D8BD is the Tuna Plush Classic palette base (cream).
      // jsdom normalizes inline style hex to rgb(), so assert against the
      // computed background or the resolved rgb triplet.
      const bg = hero.style.background || hero.style.backgroundColor;
      expect(bg.toLowerCase()).toMatch(/#e8d8bd|rgb\(\s*232,\s*216,\s*189\s*\)/);
    });

    it('hides the hero on mobile via `hidden md:block` (UAT r2 item 5 — mobile-length concern)', () => {
      render(<DemosSection />);
      const hero = document.querySelector('[data-demos-section-hero]') as HTMLElement;
      expect(hero.className).toMatch(/\bhidden\b/);
      expect(hero.className).toMatch(/md:block/);
    });
  });

  describe('rebuild banner (post-301-redirect landing)', () => {
    it('does NOT render the banner when ?rebuild param is absent', () => {
      render(<DemosSection />);
      expect(screen.queryByTestId('rebuild-banner')).not.toBeInTheDocument();
    });

    it('renders the banner when ?rebuild=subscription is present, naming subscription', () => {
      mockSearchParams = new URLSearchParams('?rebuild=subscription');
      render(<DemosSection />);
      const banner = screen.getByTestId('rebuild-banner');
      expect(banner.textContent).toMatch(/subscription/i);
      expect(banner.textContent).toMatch(/returning soon/i);
    });

    it('renders the banner when ?rebuild=leadgen is present, naming lead gen', () => {
      mockSearchParams = new URLSearchParams('?rebuild=leadgen');
      render(<DemosSection />);
      const banner = screen.getByTestId('rebuild-banner');
      expect(banner.textContent).toMatch(/lead[\s-]?gen/i);
    });

    it('does NOT render the banner for unknown rebuild values (defensive)', () => {
      // Guard against future URL tampering or new redirect sources —
      // banner only surfaces for the two known-removed demos so typos
      // don't produce a misleading banner.
      mockSearchParams = new URLSearchParams('?rebuild=ecommerce');
      render(<DemosSection />);
      expect(screen.queryByTestId('rebuild-banner')).not.toBeInTheDocument();
    });

    it('does NOT render the banner for Object.prototype keys like "toString" (prototype-chain safety)', () => {
      // Regression pin for Pass 1 Important finding: plain-object
      // index lookup falls through to Object.prototype for keys like
      // `toString`, `hasOwnProperty`, `__proto__`, `valueOf`. A URL
      // like `?rebuild=toString` would return a Function reference,
      // which is truthy and non-nullish, and rendering `{rebuildLabel}`
      // as JSX would throw "Objects are not valid as a React child"
      // and crash the homepage. The allowlist guard must use a
      // prototype-chain-safe lookup.
      mockSearchParams = new URLSearchParams('?rebuild=toString');
      render(<DemosSection />);
      expect(screen.queryByTestId('rebuild-banner')).not.toBeInTheDocument();
    });

    it('does NOT render the banner for "__proto__" (prototype-chain safety)', () => {
      mockSearchParams = new URLSearchParams('?rebuild=__proto__');
      render(<DemosSection />);
      expect(screen.queryByTestId('rebuild-banner')).not.toBeInTheDocument();
    });

    it('dismisses the banner on first interaction (click on the dismiss control)', async () => {
      mockSearchParams = new URLSearchParams('?rebuild=subscription');
      const user = userEvent.setup();
      render(<DemosSection />);
      expect(screen.getByTestId('rebuild-banner')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /dismiss/i }));
      expect(screen.queryByTestId('rebuild-banner')).not.toBeInTheDocument();
    });

    it('persists dismissal across remounts within the same session (sessionStorage)', async () => {
      // Pass 1 Minor: component-local useState meant a visitor who
      // dismissed and navigated away would see the banner reappear on
      // return within the same tab. Persist the dismissal to
      // sessionStorage, keyed per-label so each removed demo's
      // honesty note is an independent dismissal.
      mockSearchParams = new URLSearchParams('?rebuild=subscription');
      const user = userEvent.setup();
      const { unmount } = render(<DemosSection />);
      await user.click(screen.getByRole('button', { name: /dismiss/i }));
      expect(screen.queryByTestId('rebuild-banner')).not.toBeInTheDocument();

      // Simulate client-side nav away and back — unmount + remount.
      unmount();
      render(<DemosSection />);
      expect(screen.queryByTestId('rebuild-banner')).not.toBeInTheDocument();
    });

    it('dismissal is per-label — dismissing subscription does NOT suppress leadgen', async () => {
      mockSearchParams = new URLSearchParams('?rebuild=subscription');
      const user = userEvent.setup();
      const { unmount } = render(<DemosSection />);
      await user.click(screen.getByRole('button', { name: /dismiss/i }));
      unmount();

      // Visitor lands from the other redirect in the same session.
      mockSearchParams = new URLSearchParams('?rebuild=leadgen');
      render(<DemosSection />);
      const banner = screen.getByTestId('rebuild-banner');
      expect(banner.textContent).toMatch(/lead[\s-]?gen/i);
    });

    // F4 UAT S5.3 regression pins — deep-link redirect flow.
    // Scenario: visitor dismisses on /?rebuild=subscription, then
    // navigates to /demo/subscription/account/settings which redirects
    // to /?rebuild=subscription#demos (same label, same storage key).
    // Banner must stay dismissed; no hydration error must fire.
    it('stays dismissed after a deep-link redirect lands on the same label (F4 UAT S5.3)', async () => {
      mockSearchParams = new URLSearchParams('?rebuild=subscription');
      const user = userEvent.setup();
      const { unmount } = render(<DemosSection />);
      await user.click(screen.getByRole('button', { name: /dismiss/i }));
      expect(screen.queryByTestId('rebuild-banner')).not.toBeInTheDocument();
      unmount();

      // Deep link redirects to the SAME shallow destination URL —
      // `/demo/subscription/:path*` → `/?rebuild=subscription#demos`.
      // The banner's dismissal state is keyed on the `label`, not the
      // inbound path, so the deep-link remount reads the same storage
      // key and the banner stays hidden.
      mockSearchParams = new URLSearchParams('?rebuild=subscription');
      render(<DemosSection />);
      expect(screen.queryByTestId('rebuild-banner')).not.toBeInTheDocument();
    });

    it('end-of-effect DOM matches storage state on both paths (F4 smoke test only — not an SSR proof)', () => {
      // Honest framing (F8 eval re-fix): jsdom runs a single client pass
      // and CANNOT replay SSR/CSR hydration reconciliation. This test
      // asserts only the end-of-effect DOM: banner present when storage
      // is clear, banner absent when storage says dismissed. It passes
      // against BOTH the pre-F4 synchronous `useState(isRebuildBannerDismissed(...))`
      // initializer AND the post-F4 tri-state — the regression the F4
      // fix closes is not observable in jsdom.
      // The fix relies on code review of the tri-state pattern for its
      // SSR-safety guarantee; this test is a regression pin for
      // dismissal PERSISTENCE (cross-mount), not hydration safety.
      // If anyone reintroduces the sync initializer, this test won't
      // catch it — but the hydration error surfaces in real Next.js
      // builds (the symptom UAT S5.3 originally reported).
      mockSearchParams = new URLSearchParams('?rebuild=subscription');
      window.sessionStorage.setItem('iampatterson.rebuild_banner_dismissed.subscription', '1');
      const { unmount } = render(<DemosSection />);
      expect(screen.queryByTestId('rebuild-banner')).not.toBeInTheDocument();
      unmount();
      window.sessionStorage.clear();
      render(<DemosSection />);
      expect(screen.getByTestId('rebuild-banner')).toBeInTheDocument();
    });

    beforeEach(() => {
      window.sessionStorage.clear();
    });
  });
});
