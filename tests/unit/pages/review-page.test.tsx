/**
 * @jest-environment jsdom
 *
 * The review page (15.10): the page the LinkedIn profile's Featured item
 * "Start with a review" links to. It sets out what the review includes, what
 * you give and get, the starting price and what it depends on, and what can
 * follow; its booking buttons go to the contact page with the review intent.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ReviewPage from '@/app/review/page';
import { REVIEW_PAGE } from '@/lib/content/review-page';
import { BOOK_REVIEW_HREF, REVIEW_COLUMNS, REVIEW_PRICE } from '@/lib/content/review';

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
  // (Ian, 2026-11-03).
  it('states the turnaround from full access, and no effort duration', () => {
    render(<ReviewPage />);
    expect(REVIEW_PAGE.turnaround).toBe(
      'About a week, once I have all the required platform and data access.',
    );
    expect(screen.getByText(REVIEW_PAGE.turnaround)).toBeInTheDocument();
    expect(JSON.stringify(REVIEW_PAGE)).not.toMatch(/two-day|\bdays?\b|\bhours?\b/i);
  });

  // What the review covers, as Ian set it on 2026-11-03: six areas.
  it('lists the six areas a review covers', () => {
    expect(REVIEW_PAGE.includes).toHaveLength(6);
  });

  it('says it changes nothing, and lists what the review looks at', () => {
    render(<ReviewPage />);
    expect(screen.getByText(REVIEW_PAGE.intro)).toBeInTheDocument();
    expect(REVIEW_PAGE.intro).toContain('I make no changes');
    for (const item of REVIEW_PAGE.includes) expect(screen.getByText(item)).toBeInTheDocument();
  });

  // The give and get columns: signed 2026-10-12, with "You give me"
  // and "You get" rewritten by Ian on 2026-11-03 (he signed the page as
  // rendered). They render from the one content module.
  it('renders the give and get columns', () => {
    render(<ReviewPage />);
    for (const column of REVIEW_COLUMNS) {
      expect(screen.getByText(column.label)).toBeInTheDocument();
      expect(screen.getByText(column.text)).toBeInTheDocument();
    }
  });

  // Ian, 2026-11-03: the review covers what the team can change without
  // developers and what server-side tagging would take; the three numbers
  // are named the same way as on the homepage.
  it('names the developer question and the three numbers in plain terms', () => {
    expect(REVIEW_PAGE.includes).toContain(
      'What your team can change without developers, and what server-side tagging would take.',
    );
    expect(REVIEW_PAGE.includes).toContain(
      "Each platform's claims read against your orders: what it claimed, how many match a real order, and how many orders you had.",
    );
  });

  // The data comes back, and is deleted when the work ends, which may be
  // after a build that follows the review.
  it('promises the data back, deleted when the work ends', () => {
    expect(REVIEW_COLUMNS.map((c) => c.label)).toEqual(['You give me', 'You get']);
    expect(REVIEW_COLUMNS[1].text).toContain(
      'Your data back, and deleted on my side when the work ends.',
    );
  });

  // What follows the review is said once, in "What can follow", and Build
  // keeps what sets it apart: the agreed measure, accounts in your name and a
  // runbook.
  it('says the build agrees its measure first and leaves everything in your name', () => {
    const build = REVIEW_PAGE.follows[0].text;
    expect(build).toContain("Before it starts, we agree how we'll measure what it changes.");
    expect(build).toContain('Every account and asset in your name, and a runbook at handoff.');
  });

  it('says what can follow: a build, then a retainer or fractional leadership', () => {
    render(<ReviewPage />);
    for (const item of REVIEW_PAGE.follows) {
      expect(screen.getByText(item.label)).toBeInTheDocument();
      expect(screen.getByText(item.text)).toBeInTheDocument();
    }
  });

  it('books the review on the contact page with the review intent, from both buttons, tracked', async () => {
    render(<ReviewPage />);
    const buttons = screen.getAllByRole('link', { name: REVIEW_PAGE.cta });
    expect(buttons).toHaveLength(2);
    for (const b of buttons) {
      expect(b).toHaveAttribute('href', BOOK_REVIEW_HREF);
      b.addEventListener('click', (e) => e.preventDefault());
      await userEvent.click(b);
    }
    expect(trackClickCta).toHaveBeenCalledTimes(2);
    expect(trackClickCta).toHaveBeenCalledWith(REVIEW_PAGE.cta, 'review');
  });

  // The homepage's design system: one shared eyebrow per section, and
  // neighbouring sections never share a background.
  it('uses the shared section frame, with alternating backgrounds', () => {
    const { container } = render(<ReviewPage />);
    const sections = [...container.querySelectorAll('main > section')];
    expect(sections.length).toBeGreaterThanOrEqual(4);
    for (const section of sections) {
      expect(section.querySelectorAll('[data-eyebrow]')).toHaveLength(1);
    }
    const tones = sections.map((s) => (s.className.includes('bg-paper-alt') ? 'alt' : 'paper'));
    for (let i = 1; i < tones.length; i++) expect(tones[i]).not.toBe(tones[i - 1]);
  });
});
