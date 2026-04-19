/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Header } from '@/components/header';
import { OverlayProvider, useOverlay } from '@/components/overlay/overlay-context';

jest.mock('@/lib/events/track', () => ({
  trackClickNav: jest.fn(),
  trackClickCta: jest.fn(),
}));

import { trackClickCta, trackClickNav } from '@/lib/events/track';

const mockTrackClickNav = trackClickNav as jest.Mock;
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
});

describe('Header — editorial chrome', () => {
  it('renders nav links for the five top-level pages', () => {
    renderHeader();
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByRole('link', { name: /^Home$/i })).toHaveAttribute('href', '/');
    expect(within(nav).getByRole('link', { name: /^Services$/i })).toHaveAttribute(
      'href',
      '/services',
    );
    expect(within(nav).getByRole('link', { name: /^Demos$/i })).toHaveAttribute('href', '/#demos');
    expect(within(nav).getByRole('link', { name: /^About$/i })).toHaveAttribute('href', '/about');
    expect(within(nav).getByRole('link', { name: /^Contact$/i })).toHaveAttribute(
      'href',
      '/contact',
    );
  });

  it('renders a mobile menu button', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });

  it('renders a SessionPulse button that opens the overlay', async () => {
    const user = userEvent.setup();
    renderHeader();
    const pulse = screen.getByRole('button', { name: /look under the hood — live session/i });
    expect(pulse).toBeInTheDocument();

    await user.click(pulse);

    expect(screen.getByTestId('overlay-status')).toHaveTextContent('open');
    expect(mockTrackClickCta).toHaveBeenCalledWith('Under the hood', 'session_pulse');
  });

  it('fires trackClickNav when a nav link is clicked', async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole('link', { name: /^Services$/i }));
    expect(mockTrackClickNav).toHaveBeenCalledWith('Services', '/services');
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
});
