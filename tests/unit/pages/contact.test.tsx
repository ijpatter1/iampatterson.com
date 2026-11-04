/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ContactPage from '@/app/contact/page';
import { ContactForm } from '@/components/contact/contact-form';
import { CONTACT_INTROS, PRINCIPLES } from '@/lib/content/contact';
import { DONE_WHERE } from '@/lib/content/done-where';
import { REVIEW_PRICE } from '@/lib/content/review';
import { RENDERABLE_EVENT_NAMES } from '@/lib/events/schema';

// Mock the track module
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/events/track', () => ({
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

import { trackFormStart, trackFormFieldFocus, trackFormSubmit } from '@/lib/events/track';
import type { SessionState } from '@/lib/session-state/types';

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
    const facts = screen.getByText(/About a week/);
    expect(facts).toHaveTextContent(REVIEW_PRICE);
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

  it('carries the about page: the three principles and the "Where I\'ve done it" cards', async () => {
    await renderPage();
    expect(PRINCIPLES.items).toHaveLength(3);
    for (const principle of PRINCIPLES.items) {
      expect(screen.getByRole('heading', { name: principle.title })).toBeInTheDocument();
    }
    expect(screen.getByRole('heading', { name: DONE_WHERE.eyebrow })).toBeInTheDocument();
    for (const card of DONE_WHERE.cards) {
      expect(screen.getByRole('heading', { name: card.name })).toBeInTheDocument();
    }
  });

  it('keeps the form on the page, so both intents reach the same inquiry endpoint', async () => {
    await renderPage({ intent: 'review' });
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('renders the email address and the response expectation', async () => {
    await renderPage();
    const emailLink = screen.getAllByRole('link', { name: /ian@iampatterson\.com/i })[0];
    expect(emailLink).toHaveAttribute('href', 'mailto:ian@iampatterson.com');
    expect(screen.getByText(/respond within 24 hours/i)).toBeInTheDocument();
  });

  it('drops the old offer: no measurement stack, no tiers', async () => {
    const { container } = render(await ContactPage({ searchParams: Promise.resolve({}) }));
    expect(container.textContent).not.toMatch(/measurement stack|tiers?\b|measurement infrastructure/i);
  });
});

describe('ContactForm', () => {
  it('renders a contact form with name, email, and message fields', () => {
    render(<ContactForm />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
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
        ecommerce_demo_percentage: 0,
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
