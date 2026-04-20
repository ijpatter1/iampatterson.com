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

  it('renders the Demos column with the ecommerce demo (post-9E-D7)', () => {
    // Phase 9E deliverable 7 removed the subscription + leadgen demos
    // from the site; the Demos column reduces to the ecommerce entry
    // per UX_PIVOT_SPEC §3.7. Those two event types remain in the
    // schema for Session State coverage, but the UI that fired them
    // is gone until the demos return.
    renderFooter();
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByRole('link', { name: /tuna shop/i })).toHaveAttribute(
      'href',
      '/demo/ecommerce',
    );
    expect(
      within(footer).queryByRole('link', { name: /tuna subscription/i }),
    ).not.toBeInTheDocument();
    expect(
      within(footer).queryByRole('link', { name: /tuna partnerships/i }),
    ).not.toBeInTheDocument();
  });

  it('renders the Session column with overlay-triggering buttons', async () => {
    const user = userEvent.setup();
    renderFooter();
    const liveStream = screen.getByRole('button', { name: /live event stream/i });
    await user.click(liveStream);
    expect(screen.getByTestId('overlay-status')).toHaveTextContent('open');
    // Post-F1 rename: the footer's three-entry column deep-links to the
    // three remaining overlay tabs (Overview, Timeline, Consent). The
    // column header is "Session" (F1 language rename) and the first
    // entry is "Overview" matching the default landing tab.
    expect(screen.getByRole('button', { name: /^overview$/i })).toBeInTheDocument();
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
