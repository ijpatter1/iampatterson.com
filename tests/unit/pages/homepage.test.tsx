/**
 * @jest-environment jsdom
 *
 * The homepage composes section components, each has its own dedicated
 * test file (hero.test.tsx, pipeline.test.tsx, etc.). This file only
 * verifies that the composition itself is in place.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import HomePage from '@/app/page';
import { Footer } from '@/components/footer';
import { Header } from '@/components/header';
import { OverlayProvider } from '@/components/overlay/overlay-context';
import { LiveEventsContext } from '@/hooks/useLiveEvents';
import { CERTIFICATIONS } from '@/lib/content/certifications';
import { DONE_WHERE } from '@/lib/content/done-where';
import { PROBLEMS_EYEBROW } from '@/lib/content/problems';
import { PROOF } from '@/lib/content/proof';
import { HOW_WE_WORK } from '@/lib/content/review';
import { trackClickCta } from '@/lib/events/track';

jest.mock('@/lib/events/track', () => ({
  trackClickCta: jest.fn(),
  trackClickNav: jest.fn(),
  trackSessionPulseHover: jest.fn(),
}));

// The hint has its own suite and runs timers this file doesn't need.
jest.mock('@/components/chrome/nav-hint', () => ({ NavHint: () => null }));

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/',
}));

function renderHome() {
  return render(
    <LiveEventsContext.Provider value={{ events: [], source: 'dataLayer', stream: 'off' }}>
      <OverlayProvider>
        <HomePage />
      </OverlayProvider>
    </LiveEventsContext.Provider>,
  );
}

describe('HomePage composition', () => {
  it('renders the editorial hero masthead', () => {
    renderHome();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Numbers your[\s\S]*marketing team[\s\S]*can count on\./,
    );
  });

  // The order of the redesign (15.4, as Ian changed it on 2026-11-03): the
  // claim, the three questions, how teams work with me, the proof, and where
  // I've done it. "Why it matters" is gone (its figures sit under the first
  // question), and the certifications wait until one is completed. The old
  // demo, services and pipeline sections are gone.
  it('composes the new sections in order, and none of the old ones', () => {
    const { container } = renderHome();
    const markers = [
      'Numbers your',
      PROBLEMS_EYEBROW,
      HOW_WE_WORK.title,
      PROOF.title,
      DONE_WHERE.eyebrow,
    ].map((text) => screen.getAllByText(text)[0]);
    for (let i = 1; i < markers.length; i++) {
      expect(
        markers[i - 1].compareDocumentPosition(markers[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    expect(container.querySelector('#demos')).toBeNull();
    expect(screen.queryByText('Why it matters')).not.toBeInTheDocument();
    // Hidden, not deleted: the section returns once a certification is completed.
    expect(CERTIFICATIONS.completed).toHaveLength(0);
    expect(container.querySelector('#certifications')).toBeNull();
    expect(container.textContent).not.toMatch(/Patterson Consulting|two-day review/i);
  });

  // One design system (Ian, 2026-11-03): every section after the hero goes
  // through the shared Section frame, so its eyebrow comes first and is the
  // shared one. A section that skips the shared frame fails here.
  it('frames every section with the shared eyebrow first', () => {
    const { container } = renderHome();
    const sections = [...container.querySelectorAll('main > section')];
    expect(sections.length).toBeGreaterThanOrEqual(5);
    for (const section of sections.slice(1)) {
      expect(section.querySelectorAll('[data-eyebrow]')).toHaveLength(1);
      // The eyebrow comes first in the section, above its layout.
      expect(section.querySelector('[data-eyebrow]')).toBe(
        section.querySelector('div > [data-eyebrow]:first-child'),
      );
    }
  });

  // Each section reads as its own room: neighbouring sections never share a
  // background, so the page needs no oversized gaps to separate them.
  it('alternates section backgrounds', () => {
    const { container } = renderHome();
    const tones = [...container.querySelectorAll('main > section')].map((s) =>
      s.className.includes('bg-paper-alt') ? 'alt' : 'paper',
    );
    for (let i = 1; i < tones.length; i++) expect(tones[i]).not.toBe(tones[i - 1]);
  });

  // 15.4 acceptance, with the overlay closed: the page and its chrome carry
  // none of the old offer's words. The overlay's own copy belongs to 16.1
  // and 17.2, and the overlay isn't rendered here.
  it('carries none of the old positioning, in the page or the header and footer', () => {
    const { container } = render(
      <LiveEventsContext.Provider value={{ events: [], source: 'dataLayer', stream: 'off' }}>
        <OverlayProvider>
          <Header />
          <HomePage />
          <Footer />
        </OverlayProvider>
      </LiveEventsContext.Provider>,
    );
    expect(container.textContent).not.toMatch(
      /\btiers?\b|measurement infrastructure|\bdemos?\b|tuna shop|explore your session first|metabase/i,
    );
    for (const a of container.querySelectorAll('a')) {
      expect(a.getAttribute('href')).not.toMatch(/demo|#demos/);
    }
  });

  // One h1, and no heading skips a level on the way down, chrome included.
  it('has one h1 and headings in order', () => {
    const { container } = render(
      <LiveEventsContext.Provider value={{ events: [], source: 'dataLayer', stream: 'off' }}>
        <OverlayProvider>
          <Header />
          <HomePage />
          <Footer />
        </OverlayProvider>
      </LiveEventsContext.Provider>,
    );
    const levels = [...container.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) =>
      Number(h.tagName[1]),
    );
    expect(levels.filter((l) => l === 1)).toHaveLength(1);
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeLessThanOrEqual(levels[i - 1] + 1);
    }
  });

  // 15.4 acceptance: every call to action on the page fires exactly one
  // click_cta, and no two share a location, so each can be read on its own
  // in BigQuery. The proof panel is a clickable region, not a button.
  it('fires exactly one click_cta per call to action, each with its own location', async () => {
    const user = userEvent.setup();
    const { container } = renderHome();
    const main = container.querySelector('main')!;
    const targets = [
      ...main.querySelectorAll<HTMLElement>('a, button'),
      screen.getByTestId('proof-panel'),
    ];
    const locations: string[] = [];
    for (const target of targets) {
      (trackClickCta as jest.Mock).mockClear();
      target.addEventListener('click', (e) => e.preventDefault());
      await user.click(target);
      expect([target.textContent, (trackClickCta as jest.Mock).mock.calls.length]).toEqual([
        target.textContent,
        1,
      ]);
      locations.push((trackClickCta as jest.Mock).mock.calls[0][1]);
    }
    expect(locations.sort()).toEqual(
      [
        'hero_review',
        'hero_session',
        'how_we_work_link',
        'how_we_work_review',
        'proof_button',
        'proof_panel',
      ].sort(),
    );
  });
});
