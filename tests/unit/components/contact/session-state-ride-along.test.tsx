/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RENDERABLE_EVENT_NAMES } from '@/lib/events/schema';
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
      // All names below are real entries in DATA_LAYER_EVENT_NAMES
      // (src/lib/events/schema.ts). Test was previously fabricating
      // names (`view_section`, `session_start`, `iap_source`, `hover_word`)
      // that weren't in the union — passed jest because `.length` is
      // the only thing asserted, but flagged 8 new tsc --noEmit errors.
      fired: [
        'page_view',
        'scroll_depth',
        'click_cta',
        'click_nav',
        'consent_update',
        'form_start',
        'form_field_focus',
        'form_submit',
        'product_view',
        'add_to_cart',
        'begin_checkout',
        'purchase',
        'nav_hint_shown',
        'session_pulse_hover',
      ],
      total: [
        'page_view',
        'scroll_depth',
        'click_cta',
        'click_nav',
        'consent_update',
        'form_start',
        'form_field_focus',
        'form_submit',
        'product_view',
        'add_to_cart',
        'begin_checkout',
        'purchase',
        'nav_hint_shown',
        'session_pulse_hover',
        'plan_select',
        'trial_signup',
        'form_complete',
        'lead_qualify',
        'nav_hint_dismissed',
        'overview_tab_view',
        'portal_click',
        'coverage_milestone',
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
      // Fixture fires 14 events (all renderable) out of RENDERABLE_EVENT_NAMES
      // (20 post-UAT F2). Demo progress 75%, pages visited 9.
      const summary = screen.getByTestId('ride-along-summary');
      const denom = RENDERABLE_EVENT_NAMES.length;
      expect(summary.textContent).toMatch(new RegExp(`14 of ${denom}`));
      expect(summary.textContent).toMatch(/75%/);
      expect(summary.textContent).toMatch(/9 pages/);
      expect(summary.textContent).toMatch(/consent state and session id will ride along/i);
    });

    // Honest-override copy for marketing-denied (unchecked default) is
    // tested exhaustively by the "unchecked + denied" variant in the
    // "summary copy — four variants" block below; no need for a
    // narrower duplicate here.

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
      // Post-UAT F8: denominator comes from RENDERABLE_EVENT_NAMES.length
      // (not the fixture's `total` array length). Matches the number the
      // visitor saw on the Overview tab before submitting. Using the live
      // constant here so future renderable-set changes don't silently
      // misalign the test from the code's source of truth.
      expect(parsed).toEqual({
        session_id: 'sid-abc123def456',
        event_types_triggered: 14,
        event_types_total: RENDERABLE_EVENT_NAMES.length,
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

  describe('async-init path (Pass 1 Critical #1) — null-then-populated', () => {
    it('picks up marketing-granted default AFTER the provider init effect resolves', () => {
      // Real browser path: the provider's init runs in useEffect, so
      // useSessionState() returns null on the component's first render
      // and populated on the next. A naive useState(initialFromNullState)
      // captures false and never re-seeds — visitor sees unchecked box
      // despite granted consent. The userOverride-null-until-clicked
      // pattern derives `checked` from current consent every render and
      // only pins to user intent after they interact.
      mockState = null;
      const { rerender } = render(<SessionStateRideAlong />);
      // First render: state null → component returns null → no checkbox.
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

      // Provider resolves, state populates with marketing granted.
      mockState = makeState({
        consent_snapshot: { analytics: 'granted', marketing: 'granted', preferences: 'granted' },
      });
      rerender(<SessionStateRideAlong />);
      const cb = screen.getByRole('checkbox') as HTMLInputElement;
      expect(cb.checked).toBe(true);
    });

    it('picks up marketing-denied default AFTER the provider init effect resolves', () => {
      mockState = null;
      const { rerender } = render(<SessionStateRideAlong />);
      mockState = makeState({
        consent_snapshot: { analytics: 'granted', marketing: 'denied', preferences: 'granted' },
      });
      rerender(<SessionStateRideAlong />);
      const cb = screen.getByRole('checkbox') as HTMLInputElement;
      expect(cb.checked).toBe(false);
    });
  });

  describe('consent revocation after mount (Pass 1 Critical #2)', () => {
    it('auto-unchecks the box when marketing consent flips granted→denied and user has not interacted', () => {
      mockState = makeState({
        consent_snapshot: { analytics: 'granted', marketing: 'granted', preferences: 'granted' },
      });
      const { container, rerender } = render(<SessionStateRideAlong />);
      let cb = screen.getByRole('checkbox') as HTMLInputElement;
      expect(cb.checked).toBe(true);
      expect(container.querySelector('input[name="session_state"]')).not.toBeNull();

      // Visitor revokes marketing consent via Cookiebot mid-page.
      mockState = makeState({
        consent_snapshot: { analytics: 'granted', marketing: 'denied', preferences: 'granted' },
      });
      rerender(<SessionStateRideAlong />);
      cb = screen.getByRole('checkbox') as HTMLInputElement;
      expect(cb.checked).toBe(false);
      // Hidden field must also disappear — no silent transmission under
      // a denied consent signal the user never explicitly overrode.
      expect(container.querySelector('input[name="session_state"]')).toBeNull();
    });

    it('does NOT auto-flip the box if the user has explicitly interacted (override wins, granted→denied→granted round-trip)', async () => {
      mockState = makeState({
        consent_snapshot: { analytics: 'granted', marketing: 'granted', preferences: 'granted' },
      });
      const user = userEvent.setup();
      const { rerender } = render(<SessionStateRideAlong />);
      // User explicitly unchecks (override = false).
      await user.click(screen.getByRole('checkbox'));
      let cb = screen.getByRole('checkbox') as HTMLInputElement;
      expect(cb.checked).toBe(false);

      // Consent flips granted→denied. User already pinned their intent
      // to unchecked — no re-flip needed, stays unchecked.
      mockState = makeState({
        consent_snapshot: { analytics: 'granted', marketing: 'denied', preferences: 'granted' },
      });
      rerender(<SessionStateRideAlong />);
      cb = screen.getByRole('checkbox') as HTMLInputElement;
      expect(cb.checked).toBe(false);

      // Consent flips back denied→granted. Still no auto-flip — user
      // override governs across the session until the component unmounts.
      mockState = makeState({
        consent_snapshot: { analytics: 'granted', marketing: 'granted', preferences: 'granted' },
      });
      rerender(<SessionStateRideAlong />);
      cb = screen.getByRole('checkbox') as HTMLInputElement;
      expect(cb.checked).toBe(false);
    });

    it('user-override-wins holds in the inverse direction too (check under denied, then denied→granted→denied)', async () => {
      // Symmetric coverage: the opposite starting position from the
      // test above. Visitor loads with marketing denied (auto-unchecked),
      // explicitly overrides by checking. Their check persists regardless
      // of subsequent consent direction changes.
      mockState = makeState({
        consent_snapshot: { analytics: 'granted', marketing: 'denied', preferences: 'granted' },
      });
      const user = userEvent.setup();
      const { rerender } = render(<SessionStateRideAlong />);
      await user.click(screen.getByRole('checkbox'));
      let cb = screen.getByRole('checkbox') as HTMLInputElement;
      expect(cb.checked).toBe(true);

      // Consent flips denied→granted. Override already pinned to true.
      mockState = makeState({
        consent_snapshot: { analytics: 'granted', marketing: 'granted', preferences: 'granted' },
      });
      rerender(<SessionStateRideAlong />);
      cb = screen.getByRole('checkbox') as HTMLInputElement;
      expect(cb.checked).toBe(true);

      // Consent flips back granted→denied. Pin still holds.
      mockState = makeState({
        consent_snapshot: { analytics: 'granted', marketing: 'denied', preferences: 'granted' },
      });
      rerender(<SessionStateRideAlong />);
      cb = screen.getByRole('checkbox') as HTMLInputElement;
      expect(cb.checked).toBe(true);
    });
  });

  describe('summary copy — four variants keyed on (checked, marketing)', () => {
    it('checked + granted → "will ride along" with concrete payload', () => {
      mockState = makeState({
        consent_snapshot: { analytics: 'granted', marketing: 'granted', preferences: 'granted' },
      });
      render(<SessionStateRideAlong />);
      const summary = screen.getByTestId('ride-along-summary');
      expect(summary.textContent).toMatch(new RegExp(`14 of ${RENDERABLE_EVENT_NAMES.length} event types`));
      expect(summary.textContent).toMatch(/75%/);
      expect(summary.textContent).toMatch(/will ride along/i);
      expect(summary.textContent).not.toMatch(/will not be included/i);
      expect(summary.textContent).not.toMatch(/overriding/i);
      expect(summary.textContent).not.toMatch(/off by default/i);
    });

    it('unchecked + granted → "will not be included, check the box above"', async () => {
      mockState = makeState({
        consent_snapshot: { analytics: 'granted', marketing: 'granted', preferences: 'granted' },
      });
      const user = userEvent.setup();
      render(<SessionStateRideAlong />);
      await user.click(screen.getByRole('checkbox')); // uncheck
      const summary = screen.getByTestId('ride-along-summary');
      expect(summary.textContent).toMatch(/will not be included/i);
      expect(summary.textContent).toMatch(/check the box above/i);
      // Full cross-variant contamination check — each positive must be
      // unique to this variant.
      expect(summary.textContent).not.toMatch(/will ride along/i);
      expect(summary.textContent).not.toMatch(/overriding/i);
      expect(summary.textContent).not.toMatch(/off by default/i);
      expect(summary.textContent).not.toMatch(/denied marketing consent/i);
    });

    it('checked + denied → "overriding" + concrete payload (transparency at the override moment)', async () => {
      mockState = makeState({
        consent_snapshot: { analytics: 'granted', marketing: 'denied', preferences: 'granted' },
      });
      const user = userEvent.setup();
      render(<SessionStateRideAlong />);
      // Default: unchecked. User overrides by clicking.
      await user.click(screen.getByRole('checkbox'));
      const summary = screen.getByTestId('ride-along-summary');
      expect(summary.textContent).toMatch(/overriding.*denied marketing consent/i);
      expect(summary.textContent).toMatch(new RegExp(`14 of ${RENDERABLE_EVENT_NAMES.length} event types`));
      expect(summary.textContent).toMatch(/75%/);
      expect(summary.textContent).toMatch(/will ride along/i);
      // Critically: visitor must see the payload they're opting into,
      // not just the override-invitation copy they saw pre-click.
      // Full cross-variant contamination check.
      expect(summary.textContent).not.toMatch(/off by default/i);
      expect(summary.textContent).not.toMatch(/will not be included/i);
    });

    it('unchecked + denied → honest-override invitation copy', () => {
      mockState = makeState({
        consent_snapshot: { analytics: 'granted', marketing: 'denied', preferences: 'granted' },
      });
      render(<SessionStateRideAlong />);
      const summary = screen.getByTestId('ride-along-summary');
      expect(summary.textContent).toMatch(/denied marketing consent/i);
      expect(summary.textContent).toMatch(/off by default/i);
      expect(summary.textContent).toMatch(/check the box above/i);
      expect(summary.textContent).not.toMatch(/will ride along/i);
      expect(summary.textContent).not.toMatch(/overriding/i);
    });
  });

  describe('a11y — aria-describedby', () => {
    it('links the checkbox to the summary paragraph so screen readers hear the payload on focus', () => {
      mockState = makeState();
      render(<SessionStateRideAlong />);
      const cb = screen.getByRole('checkbox');
      const describedBy = cb.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      const summary = screen.getByTestId('ride-along-summary');
      expect(summary.id).toBe(describedBy);
    });
  });
});
