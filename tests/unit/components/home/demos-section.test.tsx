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
      expect(banner.textContent).toMatch(/rebuilt|in development|returning/i);
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

    it('dismisses the banner on first interaction (click on the dismiss control)', async () => {
      mockSearchParams = new URLSearchParams('?rebuild=subscription');
      const user = userEvent.setup();
      render(<DemosSection />);
      expect(screen.getByTestId('rebuild-banner')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /dismiss/i }));
      expect(screen.queryByTestId('rebuild-banner')).not.toBeInTheDocument();
    });
  });
});
