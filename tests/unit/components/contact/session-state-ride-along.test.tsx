/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { SessionState } from '@/lib/session-state/types';

let mockState: SessionState | null = null;
jest.mock('@/components/session-state-provider', () => ({
  useSessionState: () => mockState,
}));

import { SessionStateRideAlong } from '@/components/contact/session-state-ride-along';

function makeState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    session_id: 'sid-abc123def456',
    started_at: '2026-04-20T10:00:00.000Z',
    page_count: 9,
    visited_paths: ['/', '/services', '/about'],
    events_fired: {},
    event_type_coverage: {
      fired: [
        'page_view',
        'scroll_depth',
        'click_cta',
        'click_nav',
        'view_section',
        'consent_update',
        'session_start',
        'iap_source',
        'hover_word',
        'product_view',
        'add_to_cart',
        'begin_checkout',
        'purchase',
        'form_start',
      ],
      total: [
        'page_view',
        'scroll_depth',
        'click_cta',
        'click_nav',
        'view_section',
        'consent_update',
        'session_start',
        'iap_source',
        'hover_word',
        'product_view',
        'add_to_cart',
        'begin_checkout',
        'purchase',
        'form_start',
        'form_field_focus',
        'form_submit',
        'plan_select',
        'trial_signup',
        'form_complete',
        'lead_qualify',
        'nav_hint_shown',
        'nav_hint_dismissed',
      ],
    },
    demo_progress: {
      ecommerce: {
        stages_reached: ['product_view', 'add_to_cart', 'begin_checkout'],
        percentage: 75,
      },
    },
    consent_snapshot: {
      analytics: 'granted',
      marketing: 'granted',
      preferences: 'granted',
    },
    coverage_milestones_fired: [25, 50],
    updated_at: '2026-04-20T10:05:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockState = null;
});

describe('SessionStateRideAlong', () => {
  describe('provider-gated rendering', () => {
    it('renders nothing when session state is null (no provider / SSR path)', () => {
      mockState = null;
      const { container } = render(<SessionStateRideAlong />);
      expect(container).toBeEmptyDOMElement();
    });

    it('renders the checkbox when session state is non-null', () => {
      mockState = makeState();
      render(<SessionStateRideAlong />);
      expect(screen.getByRole('checkbox', { name: /share my session state/i })).toBeInTheDocument();
    });
  });

  describe('default-checked gating by marketing consent', () => {
    it('is checked by default when marketing consent is granted', () => {
      mockState = makeState({
        consent_snapshot: { analytics: 'granted', marketing: 'granted', preferences: 'granted' },
      });
      render(<SessionStateRideAlong />);
      const cb = screen.getByRole('checkbox') as HTMLInputElement;
      expect(cb.checked).toBe(true);
    });

    it('is unchecked by default when marketing consent is denied', () => {
      mockState = makeState({
        consent_snapshot: { analytics: 'granted', marketing: 'denied', preferences: 'granted' },
      });
      render(<SessionStateRideAlong />);
      const cb = screen.getByRole('checkbox') as HTMLInputElement;
      expect(cb.checked).toBe(false);
    });
  });

  describe('human-readable summary', () => {
    it('reports event types triggered over total, demo percentage, and pages visited', () => {
      mockState = makeState();
      render(<SessionStateRideAlong />);
      // Fixture has 14 fired / 22 total / 75% / 9 pages.
      const summary = screen.getByTestId('ride-along-summary');
      expect(summary.textContent).toMatch(/14 of 22/);
      expect(summary.textContent).toMatch(/75%/);
      expect(summary.textContent).toMatch(/9 pages/);
      expect(summary.textContent).toMatch(/consent state and session id will ride along/i);
    });

    it('uses the honest-override copy when marketing consent is denied', () => {
      mockState = makeState({
        consent_snapshot: { analytics: 'granted', marketing: 'denied', preferences: 'granted' },
      });
      render(<SessionStateRideAlong />);
      // Spec §3.6: "You've denied marketing consent. Session state is off by
      // default — check the box above if you'd like to share it anyway."
      expect(screen.getByText(/denied marketing consent/i)).toBeInTheDocument();
      expect(screen.getByText(/off by default/i)).toBeInTheDocument();
    });

    it('uses the standard copy when marketing consent is granted', () => {
      mockState = makeState({
        consent_snapshot: { analytics: 'granted', marketing: 'granted', preferences: 'granted' },
      });
      render(<SessionStateRideAlong />);
      expect(screen.queryByText(/denied marketing consent/i)).not.toBeInTheDocument();
    });
  });

  describe('hidden session_state field — serialization contract', () => {
    it('renders the hidden input with serialized toRideAlongPayload when checked', () => {
      mockState = makeState();
      const { container } = render(<SessionStateRideAlong />);
      const hidden = container.querySelector<HTMLInputElement>('input[name="session_state"]');
      expect(hidden).not.toBeNull();
      expect(hidden!.type).toBe('hidden');
      const parsed = JSON.parse(hidden!.value);
      expect(parsed).toEqual({
        session_id: 'sid-abc123def456',
        event_types_triggered: 14,
        event_types_total: 22,
        ecommerce_demo_percentage: 75,
        pages_visited: 9,
        consent: {
          analytics: 'granted',
          marketing: 'granted',
          preferences: 'granted',
        },
      });
    });

    it('does NOT render the hidden input when unchecked (no silent transmission)', () => {
      // Marketing denied → checkbox unchecked by default.
      mockState = makeState({
        consent_snapshot: { analytics: 'granted', marketing: 'denied', preferences: 'granted' },
      });
      const { container } = render(<SessionStateRideAlong />);
      const hidden = container.querySelector<HTMLInputElement>('input[name="session_state"]');
      expect(hidden).toBeNull();
    });

    it('strips the hidden input when the user unchecks the box', async () => {
      mockState = makeState(); // marketing granted → checked by default
      const user = userEvent.setup();
      const { container } = render(<SessionStateRideAlong />);
      expect(container.querySelector('input[name="session_state"]')).not.toBeNull();
      await user.click(screen.getByRole('checkbox'));
      expect(container.querySelector('input[name="session_state"]')).toBeNull();
    });

    it('re-adds the hidden input when a user re-checks the box', async () => {
      mockState = makeState({
        consent_snapshot: { analytics: 'granted', marketing: 'denied', preferences: 'granted' },
      });
      const user = userEvent.setup();
      const { container } = render(<SessionStateRideAlong />);
      expect(container.querySelector('input[name="session_state"]')).toBeNull();
      await user.click(screen.getByRole('checkbox'));
      expect(container.querySelector('input[name="session_state"]')).not.toBeNull();
    });
  });

  describe('payload freshness — re-serializes on state change', () => {
    it('reflects an updated SessionState on the next render', () => {
      mockState = makeState();
      const { container, rerender } = render(<SessionStateRideAlong />);
      const first = JSON.parse(
        container.querySelector<HTMLInputElement>('input[name="session_state"]')!.value,
      );
      expect(first.ecommerce_demo_percentage).toBe(75);

      // Simulate a state update pushing the visitor to 100%.
      mockState = makeState({
        demo_progress: {
          ecommerce: {
            stages_reached: ['product_view', 'add_to_cart', 'begin_checkout', 'purchase'],
            percentage: 100,
          },
        },
      });
      rerender(<SessionStateRideAlong />);
      const second = JSON.parse(
        container.querySelector<HTMLInputElement>('input[name="session_state"]')!.value,
      );
      expect(second.ecommerce_demo_percentage).toBe(100);
    });
  });
});
