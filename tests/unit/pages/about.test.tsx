/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AboutPage from '@/app/about/page';

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
  },
  useReducedMotion: () => false,
}));

jest.mock('@/lib/events/track', () => ({
  trackClickCta: jest.fn(),
}));

import { trackClickCta } from '@/lib/events/track';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AboutPage', () => {
  it('renders the page heading with the "I am Ian Patterson" opener (UAT r3 B15)', () => {
    render(<AboutPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/i am ian patterson/i);
  });

  // UAT r3 B16: Tuna sidebar copy update — followers framed across
  // social platforms (not Instagram alone) + revenue streams shorten
  // "live events" to "events".
  it('Tuna sidebar names "across social platforms" with the 2M+ figure (not Instagram alone)', () => {
    render(<AboutPage />);
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/over 2 million followers across social platforms/i);
    expect(text).not.toMatch(/2 million instagram followers/i);
  });

  it('Tuna sidebar lists "events" not "live events" in the revenue-stream parenthetical', () => {
    render(<AboutPage />);
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/and events\)/);
    expect(text).not.toMatch(/and live events\)/);
  });

  // UAT r3 B17: the bio section's bottom padding was reduced so the
  // gap before "What I believe" feels editorial-tight, not stretched.
  // Pin the responsive padding class set so a future polish pass
  // that restores `py-section` (symmetric 96px both sides) silently
  // undoes the B17 fix.
  it('bio section uses the B17 responsive padding pattern (UAT r3 B17)', () => {
    render(<AboutPage />);
    const h1 = screen.getByRole('heading', { level: 1 });
    // Climb to the <section> ancestor — h1 → ScrollReveal div → div.lg:col-span-3 → grid div → section-container div → section.
    const section = h1.closest('section') as HTMLElement;
    expect(section).not.toBeNull();
    // Mobile: pt-12 + pb-8. Desktop: md:pt-section + md:pb-12.
    expect(section.className).toMatch(/\bpt-12\b/);
    expect(section.className).toMatch(/\bpb-8\b/);
    expect(section.className).toMatch(/md:pt-section/);
    expect(section.className).toMatch(/md:pb-12/);
    // And does NOT regress to the pre-B17 symmetric `py-section`.
    expect(section.className).not.toMatch(/\bpy-section\b/);
  });

  it('renders the biographical content', () => {
    render(<AboutPage />);
    expect(screen.getByText(/allied global marketing/i)).toBeInTheDocument();
  });

  it('renders the Tuna Melts My Heart reference', () => {
    render(<AboutPage />);
    expect(screen.getByText(/tuna melts my heart/i)).toBeInTheDocument();
  });

  it('renders the What I believe section', () => {
    render(<AboutPage />);
    expect(screen.getByText(/measurement infrastructure is not a project/i)).toBeInTheDocument();
    expect(screen.getByText(/ai should be infrastructure/i)).toBeInTheDocument();
    expect(screen.getByText(/you should own your data and your methodology/i)).toBeInTheDocument();
  });

  it('renders the closer section with headline and body copy', () => {
    render(<AboutPage />);
    expect(screen.getByRole('heading', { name: /want to work together/i })).toBeInTheDocument();
    expect(screen.getByText(/where the numbers stop making sense/i)).toBeInTheDocument();
  });

  it('closer CTA links to /contact and fires click_cta with about_closer location', async () => {
    const user = userEvent.setup();
    render(<AboutPage />);
    const cta = screen.getByRole('link', { name: /start a conversation/i });
    expect(cta).toHaveAttribute('href', '/contact');
    await user.click(cta);
    expect(trackClickCta).toHaveBeenCalledWith('Start a conversation', 'about_closer');
  });
});
