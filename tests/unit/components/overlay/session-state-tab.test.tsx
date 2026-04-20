/**
 * SessionStateTab — Phase 9E deliverable 3.
 *
 * Renders the Session State blob produced by deliverable 4 as the overlay's
 * primary surface: session header, coverage bar + chip grid, ecommerce funnel,
 * consent summary, portal links, and the threshold-gated contact CTA.
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { ReactNode } from 'react';

import { OverlayProvider } from '@/components/overlay/overlay-context';
import { SessionStateTab } from '@/components/overlay/session-state-tab';
import { DATA_LAYER_EVENT_NAMES } from '@/lib/events/schema';
import type { EcommerceStage, SessionState } from '@/lib/session-state/types';

// Mock useSessionState to feed controlled SessionState into the renderer.
jest.mock('@/components/session-state-provider', () => ({
  useSessionState: jest.fn(),
}));

// Mock usePathname — jsdom has no App Router context.
jest.mock('next/navigation', () => ({
  usePathname: () => '/services',
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useSessionState } = require('@/components/session-state-provider') as {
  useSessionState: jest.Mock;
};

function makeState(over: Partial<SessionState> = {}): SessionState {
  return {
    session_id: 'abc123-def456',
    started_at: '2026-04-20T12:00:00.000Z',
    updated_at: '2026-04-20T12:00:05.000Z',
    page_count: 2,
    visited_paths: ['/', '/services'],
    events_fired: { page_view: 2, click_cta: 1 },
    event_type_coverage: {
      fired: ['page_view', 'click_cta'],
      total: [...DATA_LAYER_EVENT_NAMES],
    },
    demo_progress: { ecommerce: { stages_reached: [], percentage: 0 } },
    consent_snapshot: { analytics: 'granted', marketing: 'denied', preferences: 'granted' },
    coverage_milestones_fired: [],
    ...over,
  };
}

function Wrapper({ children }: { children: ReactNode }) {
  return <OverlayProvider>{children}</OverlayProvider>;
}

describe('SessionStateTab', () => {
  beforeEach(() => {
    useSessionState.mockReset();
    window.dataLayer = [];
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).dataLayer;
  });

  it('renders the empty-state when SessionState is not yet available', () => {
    useSessionState.mockReturnValue(null);
    render(
      <Wrapper>
        <SessionStateTab />
      </Wrapper>,
    );
    expect(screen.getByText(/warming up/i)).toBeInTheDocument();
  });

  it('renders the session header block with ID / started / page', () => {
    useSessionState.mockReturnValue(makeState());
    render(
      <Wrapper>
        <SessionStateTab />
      </Wrapper>,
    );
    // Short-form session ID (last 6 chars of the UUID) — matches SessionPulse + LiveStrip.
    expect(screen.getByText('def456')).toBeInTheDocument();
    expect(screen.getByText('/services')).toBeInTheDocument();
  });

  it('renders a 16-cell ASCII coverage bar regardless of denominator', () => {
    useSessionState.mockReturnValue(makeState());
    render(
      <Wrapper>
        <SessionStateTab />
      </Wrapper>,
    );
    const bar = screen.getByTestId('coverage-bar');
    // Count █ and ░ characters; expect exactly 16 cells total.
    const cells = (bar.textContent ?? '').match(/[█░]/g) ?? [];
    expect(cells).toHaveLength(16);
  });

  it('fills the coverage bar proportionally to fired/total', () => {
    // 11 of 22 fired = 50% → 8 of 16 cells.
    const fired = DATA_LAYER_EVENT_NAMES.slice(0, 11);
    useSessionState.mockReturnValue(
      makeState({
        event_type_coverage: { fired: [...fired], total: [...DATA_LAYER_EVENT_NAMES] },
      }),
    );
    render(
      <Wrapper>
        <SessionStateTab />
      </Wrapper>,
    );
    const bar = screen.getByTestId('coverage-bar').textContent ?? '';
    const filled = (bar.match(/█/g) ?? []).length;
    expect(filled).toBe(8);
  });

  it('shows the X/Y readout derived from state (no hardcoded 22)', () => {
    jest.useFakeTimers();
    useSessionState.mockReturnValue(makeState());
    render(
      <Wrapper>
        <SessionStateTab />
      </Wrapper>,
    );
    // Advance past the typewriter (one char per ~24ms, up to ~25 chars → ~600ms).
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    const readout = screen.getByTestId('coverage-readout');
    expect(readout.textContent).toMatch(/> 2\/22 event types/i);
    jest.useRealTimers();
  });

  it('renders the coverage readout behind a one-shot typewriter (empty → full)', () => {
    jest.useFakeTimers();
    useSessionState.mockReturnValue(makeState());
    render(
      <Wrapper>
        <SessionStateTab />
      </Wrapper>,
    );
    const readout = screen.getByTestId('coverage-readout');
    expect(readout.textContent).toBe('');
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(readout.textContent).toBe('> 2/22 event types');
    jest.useRealTimers();
  });

  it('renders one chip per event name in the schema (derive-from-schema)', () => {
    useSessionState.mockReturnValue(makeState());
    const { container } = render(
      <Wrapper>
        <SessionStateTab />
      </Wrapper>,
    );
    const chips = container.querySelectorAll('[data-chip="event-chip"]');
    expect(chips).toHaveLength(DATA_LAYER_EVENT_NAMES.length);
  });

  it('marks chips as fired / unfired based on coverage.fired', () => {
    useSessionState.mockReturnValue(makeState());
    render(
      <Wrapper>
        <SessionStateTab />
      </Wrapper>,
    );
    const fired = screen.getByTestId('chip-page_view');
    const unfired = screen.getByTestId('chip-plan_select');
    expect(fired).toHaveAttribute('data-fired', 'true');
    expect(unfired).toHaveAttribute('data-fired', 'false');
  });

  it('renders [SKIPPED] for unreached stages when a later stage has been reached (Pass 1 P2)', () => {
    // Deep-linked visitor who fires purchase without first firing product_view /
    // add_to_cart / begin_checkout — the middle stages are bypassed, not pending.
    useSessionState.mockReturnValue(
      makeState({
        demo_progress: {
          ecommerce: {
            stages_reached: ['purchase'] as EcommerceStage[],
            percentage: 25,
          },
        },
      }),
    );
    render(
      <Wrapper>
        <SessionStateTab />
      </Wrapper>,
    );
    const rows = screen.getAllByTestId('funnel-row');
    const statuses = rows.map((r) => r.getAttribute('data-status'));
    expect(statuses).toEqual(['skipped', 'skipped', 'skipped', 'reached']);
    expect(screen.getAllByText('[SKIPPED]')).toHaveLength(3);
    expect(screen.getByText('[OK]')).toBeInTheDocument();
    expect(screen.queryByText('[  ]')).toBeNull();
  });

  it('renders [  ] (pending) for unreached stages when no later stage has been reached', () => {
    useSessionState.mockReturnValue(
      makeState({
        demo_progress: {
          ecommerce: {
            stages_reached: ['product_view'] as EcommerceStage[],
            percentage: 25,
          },
        },
      }),
    );
    render(
      <Wrapper>
        <SessionStateTab />
      </Wrapper>,
    );
    const rows = screen.getAllByTestId('funnel-row');
    expect(rows.map((r) => r.getAttribute('data-status'))).toEqual([
      'reached',
      'pending',
      'pending',
      'pending',
    ]);
  });

  it('renders portal descriptors alongside each portal label (Pass 1 P4)', () => {
    useSessionState.mockReturnValue(makeState());
    render(
      <Wrapper>
        <SessionStateTab />
      </Wrapper>,
    );
    expect(screen.getByText(/Four tiers of measurement infrastructure/i)).toBeInTheDocument();
    expect(screen.getByText(/Ian, Tuna, and the backstory/i)).toBeInTheDocument();
    expect(screen.getByText(/Start a conversation/i)).toBeInTheDocument();
  });

  it('renders the ecommerce funnel in canonical order via ECOMMERCE_FUNNEL_SEQUENCE', () => {
    useSessionState.mockReturnValue(
      makeState({
        demo_progress: {
          ecommerce: {
            // Out-of-canonical order; rendering must still be canonical.
            stages_reached: ['purchase', 'product_view'] as EcommerceStage[],
            percentage: 50,
          },
        },
      }),
    );
    render(
      <Wrapper>
        <SessionStateTab />
      </Wrapper>,
    );
    const rows = screen.getAllByTestId('funnel-row');
    expect(rows.map((r) => r.getAttribute('data-stage'))).toEqual([
      'product_view',
      'add_to_cart',
      'begin_checkout',
      'purchase',
    ]);
    // product_view reached, add_to_cart + begin_checkout skipped (purchase is later), purchase reached.
    expect(rows[0]).toHaveAttribute('data-status', 'reached');
    expect(rows[1]).toHaveAttribute('data-status', 'skipped');
    expect(rows[2]).toHaveAttribute('data-status', 'skipped');
    expect(rows[3]).toHaveAttribute('data-status', 'reached');
    expect(screen.getByText(/50% complete/i)).toBeInTheDocument();
  });

  it('renders the consent summary from consent_snapshot', () => {
    useSessionState.mockReturnValue(makeState());
    render(
      <Wrapper>
        <SessionStateTab />
      </Wrapper>,
    );
    expect(screen.getByTestId('consent-row-analytics')).toHaveTextContent(/granted/i);
    expect(screen.getByTestId('consent-row-marketing')).toHaveTextContent(/denied/i);
    expect(screen.getByTestId('consent-row-preferences')).toHaveTextContent(/granted/i);
  });

  it('renders the three portal links', () => {
    useSessionState.mockReturnValue(makeState());
    render(
      <Wrapper>
        <SessionStateTab />
      </Wrapper>,
    );
    expect(screen.getByRole('link', { name: /services/i })).toHaveAttribute('href', '/services');
    expect(screen.getByRole('link', { name: /about/i })).toHaveAttribute('href', '/about');
    expect(screen.getByRole('link', { name: /contact/i })).toHaveAttribute('href', '/contact');
  });

  it('emits portal_click when a portal link is clicked', () => {
    useSessionState.mockReturnValue(makeState());
    render(
      <Wrapper>
        <SessionStateTab />
      </Wrapper>,
    );
    fireEvent.click(screen.getByRole('link', { name: /services/i }));
    const portal = window.dataLayer.find((e: { event?: string }) => e.event === 'portal_click') as
      | { event: string; destination: string }
      | undefined;
    expect(portal).toBeDefined();
    expect(portal!.destination).toBe('services');
  });

  it('hides the contextual contact CTA below the threshold (<=10 event types, no checkout)', () => {
    useSessionState.mockReturnValue(
      makeState({
        event_type_coverage: {
          fired: DATA_LAYER_EVENT_NAMES.slice(0, 5),
          total: [...DATA_LAYER_EVENT_NAMES],
        },
      }),
    );
    render(
      <Wrapper>
        <SessionStateTab />
      </Wrapper>,
    );
    expect(screen.queryByTestId('contextual-contact-cta')).toBeNull();
  });

  it('surfaces the contextual contact CTA when coverage.fired.length > 10', () => {
    useSessionState.mockReturnValue(
      makeState({
        event_type_coverage: {
          fired: DATA_LAYER_EVENT_NAMES.slice(0, 11),
          total: [...DATA_LAYER_EVENT_NAMES],
        },
      }),
    );
    render(
      <Wrapper>
        <SessionStateTab />
      </Wrapper>,
    );
    expect(screen.getByTestId('contextual-contact-cta')).toBeInTheDocument();
  });

  it('surfaces the contextual contact CTA when begin_checkout has been reached', () => {
    useSessionState.mockReturnValue(
      makeState({
        demo_progress: {
          ecommerce: {
            stages_reached: ['product_view', 'add_to_cart', 'begin_checkout'] as EcommerceStage[],
            percentage: 75,
          },
        },
      }),
    );
    render(
      <Wrapper>
        <SessionStateTab />
      </Wrapper>,
    );
    expect(screen.getByTestId('contextual-contact-cta')).toBeInTheDocument();
  });

  it('emits click_cta with cta_location=contact_cta_threshold on contextual CTA click', () => {
    useSessionState.mockReturnValue(
      makeState({
        event_type_coverage: {
          fired: DATA_LAYER_EVENT_NAMES.slice(0, 11),
          total: [...DATA_LAYER_EVENT_NAMES],
        },
      }),
    );
    render(
      <Wrapper>
        <SessionStateTab />
      </Wrapper>,
    );
    fireEvent.click(screen.getByTestId('contextual-contact-cta'));
    const cta = window.dataLayer.find((e: { event?: string }) => e.event === 'click_cta') as
      | { event: string; cta_location: string }
      | undefined;
    expect(cta).toBeDefined();
    expect(cta!.cta_location).toBe('contact_cta_threshold');
  });
});
