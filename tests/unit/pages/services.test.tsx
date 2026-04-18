/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
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

describe('ServicesPage — editorial', () => {
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
    const cta = screen.getByRole('button', { name: /look under the hood/i });
    await user.click(cta);
    expect(screen.getByTestId('overlay-status')).toHaveTextContent('open');
    expect(trackClickCta).toHaveBeenCalledWith('Look under the hood', 'services-closer');
  });

  it('closer ghost CTA links to contact', () => {
    renderPage();
    const contactLink = screen.getByRole('link', { name: /start a conversation/i });
    expect(contactLink).toHaveAttribute('href', '/contact');
  });
});
