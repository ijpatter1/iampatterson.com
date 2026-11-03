/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { HeroEditorial } from '@/components/home/hero';
import { OverlayProvider, useOverlay } from '@/components/overlay/overlay-context';
import { HERO, REVIEW_HREF } from '@/lib/content/hero';

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

// The hero says what the LinkedIn profile's banner says, so a visitor who
// arrives from the profile reads the same line. The page's only h1 is that
// line, and the accent sits on the promise, "can count on."
describe('HeroEditorial', () => {
  it('is the page’s single h1 and reads "Numbers your marketing team can count on."', () => {
    renderHero();
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Numbers your marketing team can count on.',
    );
    expect(headings[0].textContent?.replace(/\s+/g, ' ').trim()).toBe(
      `${HERO.headlineLines.join(' ')} ${HERO.headlineAccent}`,
    );
  });

  it('keeps each line of the headline unbroken', () => {
    renderHero();
    for (const line of HERO.headlineLines) {
      expect(screen.getByText(line).className).toContain('whitespace-nowrap');
    }
    expect(screen.getByText(HERO.headlineAccent).closest('span')?.className).toContain(
      'whitespace-nowrap',
    );
  });

  it('sets "can count on." in the accent', () => {
    renderHero();
    const accent = screen.getByText(HERO.headlineAccent);
    expect(accent.tagName).toBe('EM');
    expect(accent.textContent).toBe('can count on.');
    expect(accent.className).toContain('text-accent-current');
  });

  it('renders the eyebrows, the positioning sentence and the capacity note from the content module', () => {
    renderHero();
    expect(screen.getByText(HERO.eyebrowLeft)).toBeInTheDocument();
    expect(screen.getByText(HERO.eyebrowRight)).toBeInTheDocument();
    expect(screen.getByText(HERO.kicker)).toBeInTheDocument();
    expect(screen.getByText(HERO.capacityNote)).toBeInTheDocument();
  });

  it('sends the primary call to action to the review page, and tracks it', async () => {
    renderHero();
    const link = screen.getByRole('link', { name: HERO.primaryCta });
    expect(link).toHaveAttribute('href', REVIEW_HREF);
    link.addEventListener('click', (e) => e.preventDefault());
    await userEvent.click(link);
    expect(trackClickCta).toHaveBeenCalledWith(HERO.primaryCta, 'hero');
  });

  it('opens the overlay from "See your session" and tracks it', async () => {
    renderHero();
    expect(screen.getByTestId('overlay-status')).toHaveTextContent('closed');
    await userEvent.click(screen.getByRole('button', { name: /see your session/i }));
    expect(screen.getByTestId('overlay-status')).toHaveTextContent('open');
    expect(trackClickCta).toHaveBeenCalledWith(HERO.ghostCta, 'hero');
  });

  it('no longer links to the demo or names the old positioning', () => {
    const { container } = renderHero();
    expect(container.querySelector('a[href*="demo"]')).toBeNull();
    expect(container.textContent).not.toMatch(/measurement infrastructure|explore the demo/i);
    expect(container.textContent).not.toMatch(/Patterson Consulting|two-day/i);
  });
});
