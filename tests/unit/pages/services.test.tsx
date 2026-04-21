/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ServicesPage from '@/app/services/page';
import { OverlayProvider, useOverlay } from '@/components/overlay/overlay-context';

jest.mock('@/lib/events/track', () => ({
  trackClickCta: jest.fn(),
}));

import { trackClickCta } from '@/lib/events/track';

function Probe() {
  const { isOpen } = useOverlay();
  return <span data-testid="overlay-status">{isOpen ? 'open' : 'closed'}</span>;
}

function renderPage() {
  return render(
    <OverlayProvider>
      <ServicesPage />
      <Probe />
    </OverlayProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ServicesPage, editorial', () => {
  it('renders the positioning headline with italic "Not" emphasis', () => {
    renderPage();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toMatch(/End-to-end[\s\S]*measurement[\s\S]*infrastructure[\s\S]*Not/);
  });

  it('renders all four tier titles', () => {
    renderPage();
    // Each tier title appears in the sticky nav AND the tier section
    expect(screen.getAllByText('Measurement Foundation').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Data Infrastructure').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Business Intelligence').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Attribution & Advanced').length).toBeGreaterThanOrEqual(2);
  });

  it('renders all four tier subtitles', () => {
    renderPage();
    expect(screen.getByText(/get the data right at the source/i)).toBeInTheDocument();
    expect(screen.getByText(/turn raw events into a source of truth/i)).toBeInTheDocument();
    expect(screen.getByText(/answers, not dashboards/i)).toBeInTheDocument();
    expect(screen.getByText(/actually working/i)).toBeInTheDocument();
  });

  it('renders tier outcome summaries for each tier', () => {
    renderPage();
    expect(screen.getByText(/what you get at the end of tier 01/i)).toBeInTheDocument();
    expect(screen.getByText(/what you get at the end of tier 02/i)).toBeInTheDocument();
    expect(screen.getByText(/what you get at the end of tier 03/i)).toBeInTheDocument();
    expect(screen.getByText(/what you get at the end of tier 04/i)).toBeInTheDocument();
  });

  it('renders the sticky tier nav with links to each tier section', () => {
    renderPage();
    const nav = screen.getByTestId('tier-nav');
    expect(nav).toBeInTheDocument();
    expect(nav.querySelectorAll('a')).toHaveLength(4);
    const anchors = Array.from(nav.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(anchors).toEqual(['#tier-01', '#tier-02', '#tier-03', '#tier-04']);
  });

  it('marks the first tier active by default in the tier nav', () => {
    renderPage();
    const nav = screen.getByTestId('tier-nav');
    const first = nav.querySelector('a[href="#tier-01"]') as HTMLElement;
    expect(first.dataset.active).toBe('true');
  });

  it('syncs the active tier on mount when already scrolled past tier boundaries', () => {
    // Pretend the user hash-navigated or refreshed while scrolled. The scroll-spy
    // must pick the correct tier from offsetTop rather than leaving the default '01'.
    Object.defineProperty(window, 'scrollY', { value: 1500, configurable: true });
    // Stub offsetTop on each tier section so the scan can choose one
    const origGet = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop');
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
      configurable: true,
      get() {
        // Fire only on the tier sections
        if (this.id === 'tier-01') return 400;
        if (this.id === 'tier-02') return 1200;
        if (this.id === 'tier-03') return 2000;
        if (this.id === 'tier-04') return 2800;
        return 0;
      },
    });

    try {
      renderPage();
      const nav = screen.getByTestId('tier-nav');
      const active = nav.querySelector('a[data-active="true"]') as HTMLElement;
      // y = scrollY + 200 = 1700 → matches tier-02 (offsetTop 1200) but not tier-03 (2000)
      expect(active.getAttribute('href')).toBe('#tier-02');
    } finally {
      if (origGet) Object.defineProperty(HTMLElement.prototype, 'offsetTop', origGet);
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    }
  });

  it('distinguishes non-negotiable core from optional components on Tier 1 and 2', () => {
    renderPage();
    // "non-negotiable" appears once in the hero paragraph and once per section header (Tiers 1 + 2)
    const nonNegotiable = screen.getAllByText(/non-negotiable/i);
    expect(nonNegotiable.length).toBeGreaterThanOrEqual(2);
    // "scoped per client" is only used as the Tier 1 + 2 optional-components label
    const scopedPerClient = screen.getAllByText(/scoped per client/i);
    expect(scopedPerClient.length).toBe(2);
  });

  it('labels Tier 3 and Tier 4 as fully modular', () => {
    renderPage();
    const allModular = screen.getAllByText(/all modular/i);
    expect(allModular.length).toBe(2);
  });

  it('renders each tier section with the expected id for anchor linking', () => {
    renderPage();
    expect(screen.getByTestId('tier-01').id).toBe('tier-01');
    expect(screen.getByTestId('tier-02').id).toBe('tier-02');
    expect(screen.getByTestId('tier-03').id).toBe('tier-03');
    expect(screen.getByTestId('tier-04').id).toBe('tier-04');
  });

  it('renders the closer CTA that opens the overlay', async () => {
    const user = userEvent.setup();
    renderPage();
    const closer = screen.getByText(/Not sure where you'd start/);
    expect(closer).toBeInTheDocument();
    const cta = screen.getByRole('button', { name: /see your session/i });
    await user.click(cta);
    expect(screen.getByTestId('overlay-status')).toHaveTextContent('open');
    expect(trackClickCta).toHaveBeenCalledWith('See your session', 'services_closer');
  });

  it('closer ghost CTA links to contact', () => {
    renderPage();
    const contactLink = screen.getByRole('link', { name: /start a conversation/i });
    expect(contactLink).toHaveAttribute('href', '/contact');
  });

  // -------------------------------------------------------------------------
  // Phase 9B deliverable 7, services cross-links
  // -------------------------------------------------------------------------
  it('Tier 2 summary box links to the ecommerce demo', () => {
    renderPage();
    const tier2 = screen.getByTestId('tier-02');
    const link = within(tier2).getByRole('link', { name: /see it live/i });
    expect(link).toHaveAttribute('href', '/demo/ecommerce');
  });

  it('Tier 3 summary box links to the ecommerce confirmation page with a pre-filled order', () => {
    renderPage();
    const tier3 = screen.getByTestId('tier-03');
    const link = within(tier3).getByRole('link', { name: /see it live/i });
    const href = link.getAttribute('href') ?? '';
    // Confirmation page reads order_id, total, items from the query string, 
    // pre-filling them makes the inline Tier 3 embeds meaningful on arrival
    // rather than landing on an empty-order state.
    expect(href).toMatch(/^\/demo\/ecommerce\/confirmation\?/);
    expect(href).toMatch(/order_id=/);
    expect(href).toMatch(/total=/);
    expect(href).toMatch(/items=/);
    // The order_id must follow the ORD-* pattern so the confirmation page's
    // mono kicker reads naturally ("Order confirmed · ORD-T3-DEMO") rather
    // than leaking URL-structure language like "demo-tier3".
    expect(href).toMatch(/order_id=ORD-/);
  });

  it('does not add "See it live" links to Tier 1 or Tier 4 summary boxes', () => {
    renderPage();
    const tier1 = screen.getByTestId('tier-01');
    const tier4 = screen.getByTestId('tier-04');
    expect(within(tier1).queryByRole('link', { name: /see it live/i })).toBeNull();
    expect(within(tier4).queryByRole('link', { name: /see it live/i })).toBeNull();
  });
});
