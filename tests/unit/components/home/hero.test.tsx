/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { HeroEditorial } from '@/components/home/hero';
import { OverlayProvider, useOverlay } from '@/components/overlay/overlay-context';

jest.mock('@/lib/events/track', () => ({
  trackClickCta: jest.fn(),
}));

import { trackClickCta } from '@/lib/events/track';

function Probe() {
  const { isOpen } = useOverlay();
  return <span data-testid="overlay-status">{isOpen ? 'open' : 'closed'}</span>;
}

function renderHero() {
  return render(
    <OverlayProvider>
      <HeroEditorial />
      <Probe />
    </OverlayProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('HeroEditorial', () => {
  it('renders the three-line masthead', () => {
    renderHero();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toMatch(/I build[\s\S]*measurement[\s\S]*infrastructure/);
  });

  it('sets the accent-current color on the italic emphasis word', () => {
    renderHero();
    const em = screen.getByText(/^measurement$/i);
    expect(em.tagName).toBe('EM');
    expect(em.className).toContain('accent-current');
  });

  it('renders the editorial lede from the prototype', () => {
    renderHero();
    expect(screen.getByText(/same stack I sell/i)).toBeInTheDocument();
    expect(screen.getByText(/Instead of describing it, I built on it/i)).toBeInTheDocument();
  });

  it('renders the long-form deck body', () => {
    renderHero();
    expect(
      screen.getByText(
        /Every scroll, every click in your session is flowing through the stack right now/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Measurement is usually invisible/i)).toBeInTheDocument();
    expect(screen.getByText(/Your session is the portfolio/i)).toBeInTheDocument();
  });

  it('primary CTA opens the overlay and fires click_cta', async () => {
    const user = userEvent.setup();
    renderHero();
    const cta = screen.getByRole('button', { name: /see your session/i });
    await user.click(cta);
    expect(screen.getByTestId('overlay-status')).toHaveTextContent('open');
    expect(trackClickCta).toHaveBeenCalledWith('See your session', 'hero');
  });

  it('ghost CTA links to the demos anchor and fires click_cta', async () => {
    const user = userEvent.setup();
    renderHero();
    const link = screen.getByRole('link', { name: /explore the demos/i });
    expect(link).toHaveAttribute('href', '/#demos');
    await user.click(link);
    expect(trackClickCta).toHaveBeenCalledWith('Explore the demos', 'hero');
  });
});
