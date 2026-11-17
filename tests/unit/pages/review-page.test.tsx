/**
 * @jest-environment jsdom
 *
 * The review page (15.10): the page the LinkedIn profile's Featured item
 * "Start with a review" links to. It sets out what the review includes, what
 * you give and get, the starting price and what it depends on, and what can
 * follow; its booking buttons go to the contact page with the review intent.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ReviewPage from '@/app/review/page';
import { REVIEW_PAGE } from '@/lib/content/review-page';
import { BOOK_REVIEW_HREF, REVIEW_COLUMNS, REVIEW_GET, REVIEW_PRICE } from '@/lib/content/review';

jest.mock('@/lib/events/track', () => ({
  trackClickCta: jest.fn(),
}));

import { trackClickCta } from '@/lib/events/track';

beforeEach(() => jest.clearAllMocks());

describe('the review page', () => {
  it("has one h1, the profile Featured item's title", () => {
    render(<ReviewPage />);
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0]).toHaveTextContent('Start with a review.');
  });

  // The price the homepage states, from the one constant, with what it
  // depends on beside it.
  it('states the starting price from the single constant, and what it depends on', () => {
    render(<ReviewPage />);
    expect(REVIEW_PAGE.price).toBe(`From ${REVIEW_PRICE}`);
    expect(screen.getByText(REVIEW_PAGE.price)).toBeInTheDocument();
    expect(screen.getByText(REVIEW_PAGE.scope)).toBeInTheDocument();
    // Ian, 2026-11-03: one brand and up to four ad platforms at the starting price.
    expect(REVIEW_PAGE.scope).toContain('up to four ad platforms and one order system');
  });

  // A turnaround, counted from full access, never an effort duration
  // (Ian, 2026-11-03). It sits by the price in the hero and under the
  // "How it runs" strip (21.1), from the one field.
  it('states the turnaround from full access, and no effort duration', () => {
    render(<ReviewPage />);
    expect(REVIEW_PAGE.turnaround).toBe(
      'About a week, once I have all the required platform and data access.',
    );
    expect(screen.getAllByText(REVIEW_PAGE.turnaround)).toHaveLength(2);
    const { turnaround, ...rest } = REVIEW_PAGE;
    expect(turnaround).toBeDefined();
    expect(JSON.stringify(rest)).not.toMatch(/two-day|\bdays?\b|\bhours?\b|\bweeks?\b/i);
  });

  it('says it changes nothing', () => {
    render(<ReviewPage />);
    expect(screen.getByText(REVIEW_PAGE.intro)).toBeInTheDocument();
    expect(REVIEW_PAGE.intro).toContain('I make no changes');
  });

  // 21.1: the page had small eyebrows and walls of text; a reader scanning
  // it could not find where one part ended. Each part now opens with a real
  // heading, at the level an outline expects, so the page reads as four
  // parts on screen and to a screen reader.
  it('opens each section with a real h2, in the order of the approved mockup', () => {
    const { container } = render(<ReviewPage />);
    const sections = [...container.querySelectorAll('main > section')];
    const [hero, ...rest] = sections;
    expect(hero.querySelector('h1, h2, h3')?.tagName).toBe('H1');
    expect(rest.map((s) => s.querySelector('h1, h2, h3')?.tagName)).toEqual([
      'H2',
      'H2',
      'H2',
      'H2',
    ]);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'What it includes',
      'What you give me, and what you get',
      'How it runs',
      'What can follow',
    ]);
  });

  it('never skips a heading level', () => {
    render(<ReviewPage />);
    const levels = screen.getAllByRole('heading').map((h) => Number(h.tagName.slice(1)));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeLessThanOrEqual(levels[i - 1] + 1);
    }
  });

  function sectionOf(title: string): HTMLElement {
    const h2 = screen.getByRole('heading', { level: 2, name: title });
    return h2.closest('section') as HTMLElement;
  }

  // 21.1: the six areas become an icon grid, each with a short title Ian
  // approved on the mockup, so a scanning reader gets the six areas from
  // the titles alone. The sentences under them are his, unchanged
  // (2026-11-03).
  it('sets the six areas out as an icon grid with the approved short titles', () => {
    render(<ReviewPage />);
    const grid = within(sectionOf('What it includes')).getByRole('list');
    const cards = within(grid).getAllByRole('listitem');
    expect(cards).toHaveLength(6);
    expect(cards.map((c) => within(c).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'What counts as a conversion',
      'Tag Manager and analytics',
      'Attribution settings',
      'Claims against your orders',
      'Weekly reporting',
      'What your team can change',
    ]);
    // The icons are decoration: the title says what the card is.
    for (const card of cards) {
      const icon = card.querySelector('svg');
      expect(icon).not.toBeNull();
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    }
    expect(cards.map((c) => c.querySelector('p')?.textContent)).toEqual([
      'Your conversion definitions and events: what counts as a purchase or a sign-up, and where each one fires.',
      'Tag Manager, web and server, and your analytics with its warehouse export.',
      "Each ad platform's attribution settings, deduplication and click IDs.",
      "Each platform's claims read against your orders: what it claimed, how many match a real order, and how many orders you had.",
      'How your weekly reporting is built, and who it depends on.',
      'What your team can change without developers, and what server-side tagging would take.',
    ]);
  });

  // The give and get sentences were signed 2026-10-12 and rewritten by Ian on
  // 2026-11-03. 21.1 sets them as lists, one sentence per item, with no word
  // changed: joined back up they are the paragraphs he signed.
  it('sets "You give me" as a three-item list of the signed sentences', () => {
    render(<ReviewPage />);
    const section = sectionOf('What you give me, and what you get');
    const heading = within(section).getByRole('heading', { level: 3, name: 'You give me' });
    const list = heading.parentElement!.querySelector('ul')!;
    const items = within(list)
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(items).toEqual([
      'Read access to Tag Manager, your analytics and its warehouse, and the ad accounts.',
      'An order export from your system of record.',
      'A kickoff session with your team.',
    ]);
    expect(items.join(' ')).toBe(
      'Read access to Tag Manager, your analytics and its warehouse, and the ad accounts. An order export from your system of record. A kickoff session with your team.',
    );
  });

  it('sets "You get" as a five-item checklist of the signed sentences, each opening in bold', () => {
    render(<ReviewPage />);
    const section = sectionOf('What you give me, and what you get');
    const heading = within(section).getByRole('heading', { level: 3, name: 'You get' });
    const list = heading.parentElement!.querySelector('ul')!;
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items.map((li) => li.textContent).join(' ')).toBe(
      "A first summary after the kickoff. A recorded walkthrough with your team. The written review, with each platform's claims against your orders and the evidence for each finding. The plan as a working tracker: ranked, with owners and estimated effort. Your data back, and deleted on my side when the work ends.",
    );
    expect(items.map((li) => li.querySelector('strong')?.textContent)).toEqual([
      'A first summary',
      'A recorded walkthrough',
      'The written review',
      'The plan as a working tracker',
      'Your data back',
    ]);
    // The tick is decoration; the list is the structure.
    for (const li of items) expect(li.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  // The bold lead is cut from the front of the signed sentence, so a reword
  // that moved it would garble the copy. Every lead must open its sentence.
  it('opens every checklist sentence with its own bold lead', () => {
    for (const item of REVIEW_GET.items) expect(item.text.startsWith(item.lead)).toBe(true);
  });

  // The accent is dynamic (`--accent`, swapped by the overlay), as on
  // /contact: the icons and the strip's last node follow it.
  it('draws the icons and the last step in the dynamic accent, not a fixed colour', () => {
    const { container } = render(<ReviewPage />);
    expect(container.innerHTML).not.toMatch(/persimmon/);
    const cards = within(sectionOf('What it includes')).getAllByRole('listitem');
    for (const card of cards) expect(card.querySelector('svg')).toHaveClass('text-accent-current');
    const steps = within(sectionOf('How it runs')).getAllByRole('listitem');
    expect(steps[steps.length - 1].querySelector('.bg-accent-current')).not.toBeNull();
  });

  // The data comes back, and is deleted when the work ends, which may be
  // after a build that follows the review.
  it('promises the data back, deleted when the work ends', () => {
    expect(REVIEW_COLUMNS.map((c) => c.label)).toEqual(['You give me', 'You get']);
    expect(REVIEW_COLUMNS[1].items.map((i) => i.text)).toContain(
      'Your data back, and deleted on my side when the work ends.',
    );
  });

  // 21.1: the strip shows the order the review runs in, and the one timing
  // the page states is the approved turnaround, counted from full access.
  // No step carries a duration: a per-step time would read as an effort
  // estimate, which the page never gives (Ian, 2026-11-03).
  it('shows how it runs as five ordered steps under the approved sentence, with no step duration', () => {
    render(<ReviewPage />);
    const section = sectionOf('How it runs');
    const strip = within(section).getByRole('list');
    expect(strip.tagName).toBe('OL');
    const steps = within(strip).getAllByRole('listitem');
    expect(
      steps.map((li) => [
        within(li).getByRole('heading', { level: 3 }).textContent,
        li.querySelector('p')?.textContent,
      ]),
    ).toEqual([
      ['Access', 'Read access and an order export.'],
      ['Kickoff', 'A session with your team.'],
      ['First summary', 'After the kickoff.'],
      ['Walkthrough', 'Recorded, with your team.'],
      ['Written review', 'Findings, evidence and the ranked plan.'],
    ]);
    // Each step shows its number, title and caption, and nothing else.
    steps.forEach((li, i) => {
      const [label, caption] = [REVIEW_PAGE.runs[i].label, REVIEW_PAGE.runs[i].caption];
      expect(li.textContent).toBe(`0${i + 1}${label}${caption}`);
      expect(`${label} ${caption}`).not.toMatch(
        /\d|\b(minutes?|hours?|days?|weeks?|months?|same-day|overnight)\b/i,
      );
    });
    expect(
      within(section).getByText(
        'About a week, once I have all the required platform and data access.',
      ),
    ).toBeInTheDocument();
  });

  // What follows the review is said once, in "What can follow", and Build
  // keeps what sets it apart: the agreed measure, accounts in your name and a
  // runbook.
  it('says the build agrees its measure first and leaves everything in your name', () => {
    const build = REVIEW_PAGE.follows[0].text;
    expect(build).toContain("Before it starts, we agree how we'll measure what it changes.");
    expect(build).toContain(
      'your data, accounts and assets sit in your name, with a runbook at handoff.',
    );
    // The AI in the homepage's words: what it does, not a label.
    expect(build).toContain(
      'your team asks about spend and sales, and checks the answers in data they trust.',
    );
  });

  it('says what can follow: a build, then a retainer or fractional leadership', () => {
    render(<ReviewPage />);
    for (const item of REVIEW_PAGE.follows) {
      expect(screen.getByText(item.label)).toBeInTheDocument();
      expect(screen.getByText(item.text)).toBeInTheDocument();
    }
  });

  // Each button reports its own place, so the click data says whether
  // visitors book from the top of the page or after reading it (15.4).
  it('books the review on the contact page with the review intent, from both buttons, tracked apart', async () => {
    render(<ReviewPage />);
    const buttons = screen.getAllByRole('link', { name: REVIEW_PAGE.cta });
    expect(buttons).toHaveLength(2);
    for (const b of buttons) {
      expect(b).toHaveAttribute('href', BOOK_REVIEW_HREF);
      b.addEventListener('click', (e) => e.preventDefault());
      await userEvent.click(b);
    }
    expect((trackClickCta as jest.Mock).mock.calls).toEqual([
      [REVIEW_PAGE.cta, 'review_page_top'],
      [REVIEW_PAGE.cta, 'review_page_bottom'],
    ]);
  });

  // The homepage's design system: neighbouring sections never share a
  // background. Since 21.1 a section-size heading opens each section below
  // the hero, so the hero's "The review" is the page's only eyebrow.
  it('keeps the one eyebrow in the hero, with alternating backgrounds', () => {
    const { container } = render(<ReviewPage />);
    const sections = [...container.querySelectorAll('main > section')];
    expect(sections).toHaveLength(5);
    expect(sections.map((s) => s.querySelectorAll('[data-eyebrow]').length)).toEqual([
      1, 0, 0, 0, 0,
    ]);
    const tones = sections.map((s) => (s.className.includes('bg-paper-alt') ? 'alt' : 'paper'));
    for (let i = 1; i < tones.length; i++) expect(tones[i]).not.toBe(tones[i - 1]);
  });
});
