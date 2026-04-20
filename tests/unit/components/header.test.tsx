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

// Stub NavHint during header tests — the hint has its own focused suite
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

const mockTrackClickCta = trackClickCta as jest.Mock;

function OverlayProbe() {
  const { isOpen } = useOverlay();
  return <span data-testid="overlay-status">{isOpen ? 'open' : 'closed'}</span>;
}

function renderHeader() {
  return render(
    <OverlayProvider>
      <Header />
      <OverlayProbe />
    </OverlayProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname = '/';
});

describe('Header — post-9E-D1 nav pivot', () => {
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
    // Non-homepage pages need an obvious back-to-/ affordance — the
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

  it('renders the SessionPulse as the primary nav affordance and opens the overlay on click', async () => {
    const user = userEvent.setup();
    renderHeader();
    const pulse = screen.getByRole('button', { name: /open your session/i });
    expect(pulse).toBeInTheDocument();

    await user.click(pulse);

    expect(screen.getByTestId('overlay-status')).toHaveTextContent('open');
    expect(mockTrackClickCta).toHaveBeenCalledWith('Session', 'session_pulse');
  });

  it('exposes a screen-reader-only home link for site identity', () => {
    renderHeader();
    const srLink = screen.getByRole('link', { name: /patterson consulting — home/i });
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
