/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Footer } from '@/components/footer';
import { OverlayProvider, useOverlay } from '@/components/overlay/overlay-context';

jest.mock('@/lib/events/track', () => ({
  trackClickNav: jest.fn(),
  trackClickCta: jest.fn(),
}));

function Probe() {
  const { isOpen } = useOverlay();
  return <span data-testid="overlay-status">{isOpen ? 'open' : 'closed'}</span>;
}

function renderFooter() {
  return render(
    <OverlayProvider>
      <Footer />
      <Probe />
    </OverlayProvider>,
  );
}

describe('Footer — editorial', () => {
  it('renders the Patterson wordmark', () => {
    renderFooter();
    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent(/patterson/i);
  });

  it('renders the Pages column with all top-level nav links', () => {
    renderFooter();
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByRole('link', { name: /^Home$/i })).toHaveAttribute('href', '/');
    expect(within(footer).getByRole('link', { name: /^Services$/i })).toHaveAttribute(
      'href',
      '/services',
    );
    expect(within(footer).getByRole('link', { name: /^About$/i })).toHaveAttribute(
      'href',
      '/about',
    );
    expect(within(footer).getByRole('link', { name: /^Contact$/i })).toHaveAttribute(
      'href',
      '/contact',
    );
  });

  it('renders the Demos column with all three demos', () => {
    renderFooter();
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByRole('link', { name: /tuna shop/i })).toHaveAttribute(
      'href',
      '/demo/ecommerce',
    );
    expect(within(footer).getByRole('link', { name: /tuna subscription/i })).toHaveAttribute(
      'href',
      '/demo/subscription',
    );
    expect(within(footer).getByRole('link', { name: /tuna partnerships/i })).toHaveAttribute(
      'href',
      '/demo/leadgen',
    );
  });

  it('renders the Under-the-hood column with overlay-triggering buttons', async () => {
    const user = userEvent.setup();
    renderFooter();
    const liveStream = screen.getByRole('button', { name: /live event stream/i });
    await user.click(liveStream);
    expect(screen.getByTestId('overlay-status')).toHaveTextContent('open');
    // Post-D2 the footer's three-entry column deep-links to the three
    // remaining overlay tabs (Session State, Timeline, Consent). The
    // pre-D2 "Pipeline architecture" entry routed to Overview, which
    // was removed; it's replaced with a "Session state" entry matching
    // the new default landing tab.
    expect(screen.getByRole('button', { name: /session state/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /consent state/i })).toBeInTheDocument();
  });

  it('renders the email link', () => {
    renderFooter();
    const email = screen.getByRole('link', { name: /ian@iampatterson\.com/i });
    expect(email).toHaveAttribute('href', 'mailto:ian@iampatterson.com');
  });

  it('renders the copyright and stack credit', () => {
    renderFooter();
    expect(screen.getByText(/2026 Patterson Consulting/i)).toBeInTheDocument();
    expect(screen.getByText(/BigQuery · Dataform/i)).toBeInTheDocument();
  });
});
