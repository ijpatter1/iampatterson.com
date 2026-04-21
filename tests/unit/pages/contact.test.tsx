/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ContactPage from '@/app/contact/page';
import { RENDERABLE_EVENT_NAMES } from '@/lib/events/schema';

// Mock the track module
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
  },
  useReducedMotion: () => false,
}));

jest.mock('@/lib/events/track', () => ({
  trackFormStart: jest.fn(),
  trackFormFieldFocus: jest.fn(),
  trackFormSubmit: jest.fn(),
}));

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
});

describe('ContactPage', () => {
  it('renders the page heading', () => {
    render(<ContactPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /let's talk about your measurement stack/i,
    );
  });

  it('renders the introductory copy', () => {
    render(<ContactPage />);
    expect(screen.getByText(/e-commerce brands, saas companies/i)).toBeInTheDocument();
  });

  it('renders the email address', () => {
    render(<ContactPage />);
    const emailLink = screen.getByRole('link', { name: /ian@iampatterson\.com/i });
    expect(emailLink).toHaveAttribute('href', 'mailto:ian@iampatterson.com');
  });

  it('renders the response expectation', () => {
    render(<ContactPage />);
    expect(screen.getByText(/respond within 24 hours/i)).toBeInTheDocument();
  });

  it('renders a contact form with name, email, and message fields', () => {
    render(<ContactPage />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
  });

  it('renders a submit button', () => {
    render(<ContactPage />);
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('fires form_start on first field focus', async () => {
    const user = userEvent.setup();
    render(<ContactPage />);
    await user.click(screen.getByLabelText(/name/i));
    expect(mockTrackFormStart).toHaveBeenCalledWith('contact');
    expect(mockTrackFormStart).toHaveBeenCalledTimes(1);
  });

  it('fires form_field_focus on each field focus', async () => {
    const user = userEvent.setup();
    render(<ContactPage />);
    await user.click(screen.getByLabelText(/name/i));
    await user.click(screen.getByLabelText(/email/i));
    expect(mockTrackFormFieldFocus).toHaveBeenCalledWith('contact', 'name');
    expect(mockTrackFormFieldFocus).toHaveBeenCalledWith('contact', 'email');
    expect(mockTrackFormFieldFocus).toHaveBeenCalledTimes(2);
  });

  it('fires form_start only once across multiple field focuses', async () => {
    const user = userEvent.setup();
    render(<ContactPage />);
    await user.click(screen.getByLabelText(/name/i));
    await user.click(screen.getByLabelText(/email/i));
    await user.click(screen.getByLabelText(/message/i));
    expect(mockTrackFormStart).toHaveBeenCalledTimes(1);
  });

  it('fires form_submit and redirects to /contact/thanks on submission', async () => {
    const user = userEvent.setup();
    render(<ContactPage />);
    await user.type(screen.getByLabelText(/name/i), 'Test User');
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/message/i), 'Hello');
    await user.click(screen.getByRole('button', { name: /send/i }));
    expect(mockTrackFormSubmit).toHaveBeenCalledWith('contact', true);
    expect(mockPush).toHaveBeenCalledWith('/contact/thanks');
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
      const { container } = render(<ContactPage />);
      expect(container.querySelector('[data-testid="ride-along-summary"]')).not.toBeInTheDocument();
      expect(container.querySelector('input[name="session_state"]')).not.toBeInTheDocument();
    });

    it('renders the ride-along block and includes the hidden session_state field on submit when marketing is granted', async () => {
      mockSessionState = stateFixture('granted');
      const user = userEvent.setup();
      const { container } = render(<ContactPage />);
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
      await user.type(screen.getByLabelText(/^name$/i), 'Test User');
      await user.type(screen.getByLabelText(/^email$/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^message$/i), 'Hello');
      await user.click(screen.getByRole('button', { name: /send/i }));
      expect(mockTrackFormSubmit).toHaveBeenCalledWith('contact', true);
      expect(mockPush).toHaveBeenCalledWith('/contact/thanks');
    });

    it('renders the ride-along block with the checkbox unchecked when marketing is denied', () => {
      mockSessionState = stateFixture('denied');
      const { container } = render(<ContactPage />);
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
