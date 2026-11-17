/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ContactPage from '@/app/contact/page';
import { ContactForm } from '@/components/contact/contact-form';
import { CONTACT_COPY, CONTACT_EMAIL, CONTACT_INTROS, PRINCIPLES } from '@/lib/content/contact';
import { DONE_WHERE } from '@/lib/content/done-where';
import { NETWORKS_LABEL } from '@/lib/content/networks';
import { REVIEW_PAGE_HREF, REVIEW_PRICE } from '@/lib/content/review';
import { REVIEW_PAGE } from '@/lib/content/review-page';
import { RENDERABLE_EVENT_NAMES } from '@/lib/events/schema';

// Mock the track module
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/events/track', () => ({
  trackClickCta: jest.fn(),
  trackFormStart: jest.fn(),
  trackFormFieldFocus: jest.fn(),
  trackFormSubmit: jest.fn(),
}));

const mockLoadRecaptcha = jest.fn(() => Promise.resolve());
const mockGetRecaptchaToken = jest.fn(() => Promise.resolve('recaptcha-token'));
jest.mock('@/lib/contact/recaptcha-client', () => ({
  loadRecaptcha: () => mockLoadRecaptcha(),
  getRecaptchaToken: () => mockGetRecaptchaToken(),
}));

const mockFetch = jest.fn();

// Default the SessionStateProvider hook to null so the existing assertions
// run against a form that does NOT render the D8 ride-along block. Tests
// that exercise D8 integration override via `setMockSessionState(...)` below.
let mockSessionState: import('@/lib/session-state/types').SessionState | null = null;
jest.mock('@/components/session-state-provider', () => ({
  useSessionState: () => mockSessionState,
}));

import {
  trackClickCta,
  trackFormStart,
  trackFormFieldFocus,
  trackFormSubmit,
} from '@/lib/events/track';
import type { SessionState } from '@/lib/session-state/types';

const mockTrackClickCta = trackClickCta as jest.Mock;
const mockTrackFormStart = trackFormStart as jest.Mock;
const mockTrackFormFieldFocus = trackFormFieldFocus as jest.Mock;
const mockTrackFormSubmit = trackFormSubmit as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockPush.mockClear();
  mockSessionState = null;
  mockFetch.mockResolvedValue({ ok: true, status: 200 });
  global.fetch = mockFetch as unknown as typeof fetch;
});

async function fillAndSend(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^name$/i), 'Test User');
  await user.type(screen.getByLabelText(/^email$/i), 'test@example.com');
  await user.type(screen.getByLabelText(/^message$/i), 'Hello');
  await user.click(screen.getByRole('button', { name: /send/i }));
}

function sentBody(): Record<string, unknown> {
  return JSON.parse(mockFetch.mock.calls[0][1].body);
}

async function renderPage(searchParams: Record<string, string | string[]> = {}) {
  render(await ContactPage({ searchParams: Promise.resolve(searchParams) }));
}

describe('ContactPage, the merged contact and about page (16.2)', () => {
  it('has one h1, the general heading, when no intent is given', async () => {
    await renderPage();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent(CONTACT_INTROS.default.title);
    expect(screen.getByText(CONTACT_INTROS.default.intro)).toBeInTheDocument();
  });

  // The review buttons send visitors here with ?intent=review: they have
  // already decided, so the page greets them as booking the review and
  // restates the price and turnaround they just read.
  it('greets ?intent=review with the review heading, intro, price and turnaround', async () => {
    await renderPage({ intent: 'review' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      CONTACT_INTROS.review.title,
    );
    expect(screen.getByText(CONTACT_INTROS.review.intro)).toBeInTheDocument();
    expect(screen.queryByText(CONTACT_INTROS.default.intro)).not.toBeInTheDocument();
    // The price and the turnaround render as separate strings, each exactly
    // as /review states it, so the claims check can match the turnaround.
    expect(screen.getByText(REVIEW_PAGE.price)).toHaveTextContent(REVIEW_PRICE);
    expect(screen.getByText(REVIEW_PAGE.turnaround)).toBeInTheDocument();
  });

  // A visitor on the general page hasn't decided on the review yet, so the
  // page names the priced first step and links to what it covers. The review
  // intent already shows the price and turnaround, so it doesn't repeat it.
  it('points the general page at the review page, with its price', async () => {
    await renderPage();
    const link = screen.getByRole('link', { name: /what it includes/i });
    expect(link).toHaveAttribute('href', REVIEW_PAGE_HREF);
    expect(screen.getByText(/^start with the review, from/i)).toHaveTextContent(REVIEW_PRICE);
  });

  it('does not repeat the review pointer on the review intent', async () => {
    await renderPage({ intent: 'review' });
    expect(screen.queryByRole('link', { name: /what it includes/i })).not.toBeInTheDocument();
  });

  // The page hands its intent to the form, so the inquiry carries it.
  it.each([
    [{ intent: 'review' }, 'review'],
    [{}, 'default'],
    [{ intent: 'sales' }, 'default'],
  ])('passes %j to the form as the %s intent', async (params, intent) => {
    const user = userEvent.setup();
    await renderPage(params);
    await fillAndSend(user);
    expect(sentBody().intent).toBe(intent);
  });

  it('treats an unknown or repeated intent as the general page', async () => {
    await renderPage({ intent: 'services' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      CONTACT_INTROS.default.title,
    );
    await renderPage({ intent: ['review', 'review'] });
    expect(screen.getAllByRole('heading', { level: 1 })[1]).toHaveTextContent(
      CONTACT_INTROS.default.title,
    );
  });

  // 21.2: the three principles become short cards. The wording is the
  // profile's (15.9) and stays exactly as it was; only the layout changes.
  it('shows the three principles as cards, each with its title, its text and an icon', async () => {
    await renderPage();
    const list = screen.getByRole('list', { name: PRINCIPLES.title });
    const cards = within(list).getAllByRole('listitem');
    expect(cards).toHaveLength(3);
    cards.forEach((card, i) => {
      const principle = PRINCIPLES.items[i];
      expect(within(card).getByRole('heading', { level: 3 })).toHaveTextContent(principle.title);
      expect(within(card).getByText(principle.body)).toBeInTheDocument();
      // The icon is decoration: hidden from screen readers.
      expect(card.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it("keeps the principles' wording as approved", () => {
    expect(PRINCIPLES.items.map((p) => p.title)).toEqual([
      'I look before I change anything.',
      "You'll know whether it worked.",
      'What I build stays yours.',
    ]);
  });

  // 21.2: "Where I've done it" is cut to the four names with their years or
  // role. The full cards stay on the homepage; here they would push the page
  // past what a visitor about to write needs.
  it('cuts "Where I\'ve done it" to the four names with their years or role', async () => {
    await renderPage();
    const list = screen.getByRole('list', { name: DONE_WHERE.eyebrow });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(
      DONE_WHERE.cards.map((card) => `${card.name}${card.when}`),
    );
    expect(items).toHaveLength(4);
  });

  it('leaves the long cards, the networks and the closing paragraph on the homepage', async () => {
    await renderPage();
    for (const card of DONE_WHERE.cards) {
      expect(screen.queryByText(card.text)).not.toBeInTheDocument();
    }
    expect(screen.queryByText(DONE_WHERE.closing)).not.toBeInTheDocument();
    expect(screen.queryByText(NETWORKS_LABEL)).not.toBeInTheDocument();
  });

  // Headings in order, with no level skipped, for both intents: the page
  // title, the form, then the two sections, with the principles under theirs.
  it.each([
    [{}, 'default'],
    [{ intent: 'review' }, 'review'],
  ] as const)('keeps its headings in order for %j', async (params, intent) => {
    await renderPage(params);
    const outline = screen.getAllByRole('heading').map((h) => `${h.tagName}:${h.textContent}`);
    expect(outline).toEqual([
      `H1:${CONTACT_INTROS[intent].title}`,
      `H2:${CONTACT_COPY.formTitle}`,
      `H2:${PRINCIPLES.title}`,
      ...PRINCIPLES.items.map((p) => `H3:${p.title}`),
      `H2:${DONE_WHERE.eyebrow}`,
    ]);
  });

  // 21.2: the heading moved into the left column, beside the form, so the
  // form starts at the top of the page rather than under a full-width title.
  // (The fold itself is checked by the 1440 by 900 screenshot.)
  it('puts the heading in the column beside the form, not above it', async () => {
    await renderPage();
    const h1 = screen.getByRole('heading', { level: 1 });
    const form = screen.getByRole('heading', { name: CONTACT_COPY.formTitle }).closest('form')!;
    // The form's column and the heading's column share one row.
    const row = form.parentElement!.parentElement!;
    expect(row).toContainElement(h1);
  });

  it('keeps the form on the page, so both intents reach the same inquiry endpoint', async () => {
    await renderPage({ intent: 'review' });
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('renders the email address and the response expectation', async () => {
    await renderPage();
    const emailLink = screen.getAllByRole('link', { name: /ian@iampatterson\.com/i })[0];
    expect(emailLink).toHaveAttribute('href', 'mailto:ian@iampatterson.com');
    expect(screen.getByText(/reply within 24 hours/i)).toBeInTheDocument();
  });

  // 15.4: each call to action on the page fires one click_cta with its own
  // location. The form reports through form_* events instead.
  it('tracks the review link and the address, each with its own location', async () => {
    const user = userEvent.setup();
    await renderPage();
    const review = screen.getByRole('link', { name: CONTACT_INTROS.default.reviewLink!.text });
    const email = screen.getByRole('link', { name: CONTACT_EMAIL });
    const calls: unknown[][] = [];
    for (const link of [review, email]) {
      mockTrackClickCta.mockClear();
      link.addEventListener('click', (e) => e.preventDefault());
      await user.click(link);
      expect(mockTrackClickCta).toHaveBeenCalledTimes(1);
      calls.push(mockTrackClickCta.mock.calls[0]);
    }
    expect(calls).toEqual([
      [expect.stringContaining(CONTACT_INTROS.default.reviewLink!.text), 'contact_review_link'],
      [CONTACT_EMAIL, 'contact_email'],
    ]);
  });

  it('drops the old offer: no measurement stack, no tiers', async () => {
    const { container } = render(await ContactPage({ searchParams: Promise.resolve({}) }));
    expect(container.textContent).not.toMatch(
      /measurement stack|tiers?\b|measurement infrastructure/i,
    );
  });
});

describe('ContactForm', () => {
  it('renders a contact form with name, email, and message fields', () => {
    render(<ContactForm />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
  });

  // The hint tells the visitor what makes a useful first message, and is
  // tied to the field so a screen reader announces it with the label.
  it('describes the message field with what to include', () => {
    render(<ContactForm />);
    const message = screen.getByLabelText(/^message$/i);
    expect(message).toHaveAccessibleDescription(CONTACT_COPY.messageHint);
  });

  // 21.2: Name and Email split into two columns only at lg. From md the form
  // column sits beside the intro and is about 340px wide, so a split there
  // would leave each field about 160px.
  it('puts Name and Email side by side only from lg, where the form column has room', () => {
    render(<ContactForm />);
    const row = screen.getByLabelText(/^name$/i).parentElement!.parentElement!;
    expect(row).toContainElement(screen.getByLabelText(/^email$/i));
    expect(row).toHaveClass('lg:grid-cols-2');
    expect(row.className).not.toMatch(/\b(sm|md):grid-cols-2\b/);
  });

  it('renders a submit button', () => {
    render(<ContactForm />);
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('fires form_start on first field focus', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);
    await user.click(screen.getByLabelText(/name/i));
    expect(mockTrackFormStart).toHaveBeenCalledWith('contact');
    expect(mockTrackFormStart).toHaveBeenCalledTimes(1);
  });

  it('fires form_field_focus on each field focus', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);
    await user.click(screen.getByLabelText(/name/i));
    await user.click(screen.getByLabelText(/email/i));
    expect(mockTrackFormFieldFocus).toHaveBeenCalledWith('contact', 'name');
    expect(mockTrackFormFieldFocus).toHaveBeenCalledWith('contact', 'email');
    expect(mockTrackFormFieldFocus).toHaveBeenCalledTimes(2);
  });

  it('fires form_start only once across multiple field focuses', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);
    await user.click(screen.getByLabelText(/name/i));
    await user.click(screen.getByLabelText(/email/i));
    await user.click(screen.getByLabelText(/message/i));
    expect(mockTrackFormStart).toHaveBeenCalledTimes(1);
  });

  // Phase 16, deliverable 16.3: the form used to go straight to the thanks
  // page and deliver nothing. Now the thanks page means the inquiry was sent.
  it('posts the inquiry with a reCAPTCHA token, then shows the thanks page', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);
    await fillAndSend(user);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/contact',
      expect.objectContaining({ method: 'POST' }),
    );
    // The request has a deadline, so a hung route ends in the failure message.
    expect(mockFetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(sentBody()).toMatchObject({
      name: 'Test User',
      email: 'test@example.com',
      message: 'Hello',
      token: 'recaptcha-token',
    });
    expect(mockTrackFormSubmit).toHaveBeenCalledWith('contact', true);
    expect(mockPush).toHaveBeenCalledWith('/contact/thanks');
  });

  // The inquiry records its intent (Ian, 2026-11-14): a visitor who came from
  // a "Book the review" button is a review lead, and the mailbox and the
  // form analytics can tell those apart from general questions.
  it('posts the default intent and reports form_name contact without a review intent', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);
    await fillAndSend(user);
    expect(sentBody().intent).toBe('default');
    expect(mockTrackFormStart).toHaveBeenCalledWith('contact');
    expect(mockTrackFormFieldFocus.mock.calls.map((c) => c[0])).toEqual([
      'contact',
      'contact',
      'contact',
    ]);
    expect(mockTrackFormSubmit).toHaveBeenCalledWith('contact', true);
  });

  it('posts the review intent and reports form_name contact_review on every form event', async () => {
    const user = userEvent.setup();
    render(<ContactForm intent="review" />);
    await fillAndSend(user);
    expect(sentBody().intent).toBe('review');
    expect(mockTrackFormStart).toHaveBeenCalledWith('contact_review');
    expect(mockTrackFormFieldFocus.mock.calls.map((c) => c[0])).toEqual([
      'contact_review',
      'contact_review',
      'contact_review',
    ]);
    expect(mockTrackFormSubmit).toHaveBeenCalledWith('contact_review', true);
  });

  it('reports a failed review submission under contact_review too', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 502 });
    const user = userEvent.setup();
    render(<ContactForm intent="review" />);
    await fillAndSend(user);
    await screen.findByRole('alert');
    expect(mockTrackFormSubmit).toHaveBeenCalledWith('contact_review', false);
  });

  // The form's analytics carry the field names only, never what was typed.
  it('puts no message text in any form event', async () => {
    const user = userEvent.setup();
    render(<ContactForm intent="review" />);
    await fillAndSend(user);
    const calls = [
      ...mockTrackFormStart.mock.calls,
      ...mockTrackFormFieldFocus.mock.calls,
      ...mockTrackFormSubmit.mock.calls,
    ];
    expect(JSON.stringify(calls)).not.toMatch(/Hello|Test User|test@example\.com/);
  });

  it('says the message did not send, and offers the email address, when the server refuses it', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 502 });
    const user = userEvent.setup();
    render(<ContactForm />);
    await fillAndSend(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(/didn.t send/i);
    expect(screen.getByRole('alert')).toHaveTextContent('ian@iampatterson.com');
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockTrackFormSubmit).toHaveBeenCalledWith('contact', false);
  });

  it('says so too when reCAPTCHA cannot load, and sends nothing', async () => {
    mockGetRecaptchaToken.mockRejectedValueOnce(new Error('blocked'));
    const user = userEvent.setup();
    render(<ContactForm />);
    await fillAndSend(user);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // A page view alone must make no request to a reCAPTCHA host.
  it('loads reCAPTCHA only when the visitor starts the form', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);
    expect(mockLoadRecaptcha).not.toHaveBeenCalled();
    await user.click(screen.getByLabelText(/^name$/i));
    expect(mockLoadRecaptcha).toHaveBeenCalledTimes(1);
  });

  describe('Phase 9E D8, session-state ride-along integration', () => {
    function stateFixture(marketing: 'granted' | 'denied'): SessionState {
      return {
        session_id: 'sid-contact-test',
        started_at: '2026-04-20T10:00:00.000Z',
        page_count: 5,
        visited_paths: ['/', '/services'],
        events_fired: {},
        event_type_coverage: {
          fired: ['page_view', 'scroll_depth', 'click_cta'],
          total: ['page_view', 'scroll_depth', 'click_cta', 'form_start'],
        },
        demo_progress: { ecommerce: { stages_reached: [], percentage: 0 } },
        consent_snapshot: { analytics: 'granted', marketing, preferences: 'granted' },
        coverage_milestones_fired: [],
        updated_at: '2026-04-20T10:05:00.000Z',
      };
    }

    it('does NOT render the ride-along block when no SessionStateProvider wraps the page', () => {
      mockSessionState = null;
      const { container } = render(<ContactForm />);
      expect(container.querySelector('[data-testid="ride-along-summary"]')).not.toBeInTheDocument();
      expect(container.querySelector('input[name="session_state"]')).not.toBeInTheDocument();
    });

    it('renders the ride-along block and includes the hidden session_state field on submit when marketing is granted', async () => {
      mockSessionState = stateFixture('granted');
      const user = userEvent.setup();
      const { container } = render(<ContactForm />);
      // Checkbox present and checked (marketing granted → default checked).
      const cb = screen.getByRole('checkbox', {
        name: /share my session state/i,
      }) as HTMLInputElement;
      expect(cb.checked).toBe(true);
      // Hidden field serialized and visible in the DOM at submit time.
      const hidden = container.querySelector<HTMLInputElement>('input[name="session_state"]');
      expect(hidden).not.toBeNull();
      // Post-UAT F8: ride-along denominator derives from
      // RENDERABLE_EVENT_NAMES.length (20 post-F2), not the fixture's
      // `total` array. `event_types_triggered` stays 3 because all 3
      // fixture-fired events (page_view / scroll_depth / click_cta) are
      // in the renderable subset.
      const parsed = JSON.parse(hidden!.value);
      expect(parsed).toMatchObject({
        session_id: 'sid-contact-test',
        event_types_triggered: 3,
        pages_visited: 5,
        consent: { analytics: 'granted', marketing: 'granted', preferences: 'granted' },
      });
      expect(parsed.event_types_total).toBe(RENDERABLE_EVENT_NAMES.length);
      // Fill and submit, form still navigates to /thanks (transport is a
      // pre-existing Phase 10 stub); the hidden field would ride along with
      // the form body if/when a real submit endpoint is wired up. Anchor
      // the label regex so "Share my session state with this message"
      // (ride-along checkbox label) doesn't collide with the textarea's
      // "Message" label.
      await fillAndSend(user);
      expect(JSON.parse(String(sentBody().session_state))).toMatchObject({
        session_id: 'sid-contact-test',
      });
      expect(mockTrackFormSubmit).toHaveBeenCalledWith('contact', true);
      expect(mockPush).toHaveBeenCalledWith('/contact/thanks');
    });

    it('renders the ride-along block with the checkbox unchecked when marketing is denied', () => {
      mockSessionState = stateFixture('denied');
      const { container } = render(<ContactForm />);
      const cb = screen.getByRole('checkbox', {
        name: /share my session state/i,
      }) as HTMLInputElement;
      expect(cb.checked).toBe(false);
      // Honest-override copy visible.
      expect(screen.getByText(/denied marketing consent/i)).toBeInTheDocument();
      // No hidden field → no silent transmission.
      expect(container.querySelector('input[name="session_state"]')).toBeNull();
    });
  });
});
