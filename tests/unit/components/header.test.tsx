/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Header } from '@/components/header';
import { OverlayProvider, useOverlay } from '@/components/overlay/overlay-context';

jest.mock('@/lib/events/track', () => ({
  trackClickNav: jest.fn(),
  trackClickCta: jest.fn(),
  trackSessionPulseHover: jest.fn(),
  trackNavHintShown: jest.fn(),
  trackNavHintDismissed: jest.fn(),
}));

// Stub NavHint during header tests, the hint has its own focused suite
// and pulls in timers/listeners that would otherwise complicate header
// chrome assertions.
jest.mock('@/components/chrome/nav-hint', () => ({
  NavHint: () => <span data-testid="nav-hint-stub" />,
}));

let mockPathname = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

import { trackClickCta } from '@/lib/events/track';
import { LiveEventsContext } from '@/hooks/useLiveEvents';
import { HERO } from '@/lib/content/hero';
import { REVIEW_PAGE_HREF } from '@/lib/content/review';

const mockTrackClickCta = trackClickCta as jest.Mock;

function OverlayProbe() {
  const { isOpen } = useOverlay();
  return <span data-testid="overlay-status">{isOpen ? 'open' : 'closed'}</span>;
}

function renderHeader() {
  // The LiveStrip reads the page's shared live event source.
  return render(
    <LiveEventsContext.Provider value={{ events: [], source: 'dataLayer', stream: 'off' }}>
      <OverlayProvider>
        <Header />
        <OverlayProbe />
      </OverlayProvider>
    </LiveEventsContext.Provider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname = '/';
});

describe('Header, post-9E-D1 nav pivot', () => {
  it('does NOT render the conventional nav links (Home / Services / Demos / About / Contact)', () => {
    // Phase 9E D1: conventional header nav removed. The SessionPulse
    // is the only nav affordance in the header; the footer carries
    // the conventional-nav escape hatch on every page.
    renderHeader();
    expect(screen.queryByRole('link', { name: /^Home$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Services$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Demos$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^About$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Contact$/i })).not.toBeInTheDocument();
  });

  it('does NOT render a mobile hamburger menu button (MobileSheet removed)', () => {
    renderHeader();
    expect(screen.queryByRole('button', { name: /open menu/i })).not.toBeInTheDocument();
  });

  it('right-aligns the SessionPulse on mobile and left-aligns on desktop (F5 UAT S11.1)', () => {
    // Mobile: SessionPulse sits top-right (hamburger position per
    // UX_PIVOT_SPEC §3.1). Desktop: left-adjacent per §3.1 desktop treatment.
    // Assert the responsive justify classes on the header's inner row.
    const { container } = renderHeader();
    const row = container.querySelector('header > div');
    expect(row).not.toBeNull();
    expect(row!.className).toMatch(/justify-end/);
    expect(row!.className).toMatch(/md:justify-start/);
  });

  it('renders the "Back to homepage" slim bar on non-homepage routes (F5 UAT S2)', () => {
    // Non-homepage pages need an obvious back-to-/ affordance, the
    // footer was flagged as too much friction in UAT S2. The slim bar
    // sits directly below the LiveStrip so it stays in view across the
    // sticky-header block.
    mockPathname = '/services';
    renderHeader();
    const bar = screen.getByTestId('home-bar');
    expect(bar).toBeInTheDocument();
    const link = bar.querySelector('a');
    expect(link).not.toBeNull();
    expect(link!.getAttribute('href')).toBe('/');
    expect(link!.textContent).toMatch(/back to homepage/i);
  });

  it('does NOT render the home bar on the homepage itself (/)', () => {
    mockPathname = '/';
    renderHeader();
    expect(screen.queryByTestId('home-bar')).not.toBeInTheDocument();
  });

  it('does NOT render the home bar on demo routes, DemoFooterNav already provides back-nav (F8 eval Minor #10)', () => {
    for (const path of [
      '/demo/ecommerce',
      '/demo/ecommerce/tuna-plush',
      '/demo/ecommerce/cart',
      '/demo/ecommerce/confirmation',
    ]) {
      mockPathname = path;
      const { unmount } = renderHeader();
      expect(screen.queryByTestId('home-bar')).not.toBeInTheDocument();
      unmount();
    }
  });

  it('renders the SessionPulse as the primary nav affordance and opens the overlay on click', async () => {
    const user = userEvent.setup();
    renderHeader();
    const pulse = screen.getByRole('button', { name: /open your session/i });
    expect(pulse).toBeInTheDocument();

    await user.click(pulse);

    expect(screen.getByTestId('overlay-status')).toHaveTextContent('open');
    expect(mockTrackClickCta).toHaveBeenCalledWith('Session', 'session_pulse');
  });

  // 15.4: the review is the site's one offer, so every page carries a way to
  // it in the header. Its words are the homepage's signed call to action,
  // imported rather than retyped, so the two can't drift apart.
  it('links to the review page with the homepage call to action, on the other routes', () => {
    for (const path of ['/', '/services', '/contact/thanks', '/demo/ecommerce']) {
      mockPathname = path;
      const { unmount } = renderHeader();
      const link = screen.getByRole('link', { name: HERO.primaryCta });
      expect(link).toHaveAttribute('href', REVIEW_PAGE_HREF);
      unmount();
    }
  });

  // On /review the link would point at the page itself; on /contact the
  // visitor is already booking, and the link would send them back a step.
  it.each(['/review', '/contact'])('hides the review link on %s, and keeps the pulse', (path) => {
    mockPathname = path;
    renderHeader();
    expect(screen.queryByRole('link', { name: HERO.primaryCta })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open your session/i })).toBeInTheDocument();
  });

  it('fires one click_cta with the header location when the review link is clicked', async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole('link', { name: HERO.primaryCta }));
    expect(mockTrackClickCta).toHaveBeenCalledTimes(1);
    expect(mockTrackClickCta).toHaveBeenCalledWith(HERO.primaryCta, 'header_review');
  });

  // WCAG 2.5.5: the link shares a phone-width row with the SessionPulse, so
  // it keeps a 44px target and never wraps (a wrapped row would push the
  // hero's call to action below the fold).
  it('gives the review link a 44px target that stays on one line', () => {
    renderHeader();
    const link = screen.getByRole('link', { name: HERO.primaryCta });
    expect(link.className).toMatch(/min-h-\[44px\]/);
    expect(link.className).toMatch(/whitespace-nowrap/);
  });

  // The SessionPulse stays top-right on mobile (F5 UAT S11.1): the review
  // link sits first on mobile and moves after the pulse from md up.
  it('orders the review link before the pulse on mobile and after it on desktop', () => {
    const { container } = renderHeader();
    const link = screen.getByRole('link', { name: HERO.primaryCta });
    expect(link.parentElement).toBe(container.querySelector('header > div'));
    expect(link.className).toMatch(/(^|\s)order-first(\s|$)/);
    expect(link.className).toMatch(/(^|\s)mr-auto(\s|$)/);
    expect(link.className).toMatch(/md:order-none/);
    expect(link.className).toMatch(/md:ml-auto/);
    expect(link.className).toMatch(/md:mr-0/);
  });

  it('exposes a screen-reader-only home link for site identity', () => {
    renderHeader();
    const srLink = screen.getByRole('link', { name: /i am patterson, home/i });
    expect(srLink).toHaveAttribute('href', '/');
    expect(srLink.className).toContain('sr-only');
  });

  it('mounts the LiveStrip ticker', () => {
    renderHeader();
    expect(screen.getByTestId('live-strip')).toBeInTheDocument();
  });

  it('mounts the NavHint on the homepage', () => {
    mockPathname = '/';
    renderHeader();
    expect(screen.getByTestId('nav-hint-stub')).toBeInTheDocument();
  });

  it('does NOT mount the NavHint on non-homepage routes (homepage-entry-scoped)', () => {
    mockPathname = '/services';
    renderHeader();
    expect(screen.queryByTestId('nav-hint-stub')).not.toBeInTheDocument();
  });
});
