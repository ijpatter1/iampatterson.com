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

// The hero carries the whole positioning in five words and one sentence, and
// offers the one priced first step. The reader is a paid-media buyer, not an
// engineer, so the page's only h1 is the claim they recognise.
describe('HeroEditorial', () => {
  it('is the page’s single h1 and reads "Platforms bid on your data."', () => {
    renderHero();
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent?.replace(/\s+/g, ' ').trim()).toBe(
      `${HERO.headlineFirstLine} ${HERO.headlineSecondLineLead} ${HERO.headlineAccent}`,
    );
  });

  it('keeps "Platforms bid" together on its own line', () => {
    renderHero();
    const firstLine = screen.getByText(HERO.headlineFirstLine);
    expect(firstLine.className).toContain('whitespace-nowrap');
  });

  it('sets "data." in the accent', () => {
    renderHero();
    const accent = screen.getByText(HERO.headlineAccent);
    expect(accent.tagName).toBe('EM');
    expect(accent.className).toContain('text-accent-current');
  });

  it('renders the eyebrows, the positioning sentence and the capacity note from the content module', () => {
    renderHero();
    expect(screen.getByText(HERO.eyebrowLeft)).toBeInTheDocument();
    expect(screen.getByText(HERO.eyebrowRight)).toBeInTheDocument();
    expect(screen.getByText(HERO.kicker)).toBeInTheDocument();
    expect(screen.getByText(HERO.capacityNote)).toBeInTheDocument();
  });

  it('sends the primary call to action to the contact page with the review intent, and tracks it', async () => {
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
  });
});
