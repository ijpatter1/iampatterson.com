/**
 * SessionStateProvider — bridges window.dataLayer → SessionState blob.
 *
 * Contract (Phase 9E deliverable 4):
 * - Hydrates from sessionStorage on mount, or creates initial state.
 * - Polls window.dataLayer (same cadence as useDataLayerEvents) and applies
 *   iap_source events through the pure reducer.
 * - Persists the next state to sessionStorage after every update.
 * - Consumer hook returns null outside a provider (SSR-safe).
 */
import { render, renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';

import { SessionStateProvider, useSessionState } from '@/components/session-state-provider';
import { DATA_LAYER_EVENT_NAMES } from '@/lib/events/schema';
import { SESSION_STATE_STORAGE_KEY, loadSessionState } from '@/lib/session-state/storage';

function makeDataLayerEntry(overrides: Record<string, unknown> = {}) {
  return {
    iap_source: true,
    event: 'page_view',
    timestamp: '2026-04-19T18:00:01.000Z',
    session_id: 'test-session',
    iap_session_id: 'test-session',
    page_path: '/',
    page_title: 'Home',
    consent_analytics: true,
    consent_marketing: false,
    consent_preferences: true,
    ...overrides,
  };
}

function Wrapper({ children }: { children: ReactNode }) {
  return <SessionStateProvider>{children}</SessionStateProvider>;
}

describe('SessionStateProvider', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.dataLayer = [];
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).dataLayer;
    jest.useRealTimers();
  });

  it('creates and persists initial state on mount', () => {
    const { result } = renderHook(() => useSessionState(), { wrapper: Wrapper });
    const state = result.current;
    expect(state).not.toBeNull();
    expect(state!.events_fired).toEqual({});
    // Persisted to sessionStorage under the canonical key.
    expect(loadSessionState()).not.toBeNull();
  });

  it('applies a dataLayer event to the state and persists it', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useSessionState(), { wrapper: Wrapper });

    act(() => {
      window.dataLayer.push(makeDataLayerEntry({ event: 'click_cta' }));
      jest.advanceTimersByTime(500);
    });

    expect(result.current!.events_fired.click_cta).toBe(1);
    expect(result.current!.event_type_coverage.fired).toContain('click_cta');

    const persisted = loadSessionState();
    expect(persisted?.events_fired.click_cta).toBe(1);
  });

  it('ignores non-iap_source entries', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useSessionState(), { wrapper: Wrapper });

    act(() => {
      window.dataLayer.push({ event: 'gtm.js', 'gtm.start': Date.now() });
      jest.advanceTimersByTime(500);
    });

    expect(result.current!.events_fired).toEqual({});
  });

  it('ignores iap_source entries whose event name is not in the schema', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useSessionState(), { wrapper: Wrapper });

    act(() => {
      window.dataLayer.push(makeDataLayerEntry({ event: 'not_a_real_event' }));
      jest.advanceTimersByTime(500);
    });

    expect(result.current!.events_fired).toEqual({});
  });

  it('hydrates from sessionStorage when prior state exists, preserving event counts', () => {
    const prior = {
      session_id: 'prior',
      started_at: '2026-04-19T17:00:00.000Z',
      updated_at: '2026-04-19T17:05:00.000Z',
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
    };
    window.sessionStorage.setItem(SESSION_STATE_STORAGE_KEY, JSON.stringify(prior));

    const { result } = renderHook(() => useSessionState(), { wrapper: Wrapper });
    expect(result.current!.events_fired.click_cta).toBe(1);
    expect(result.current!.page_count).toBe(2);
  });

  it('preserves the FULL SessionState blob across a reload (UAT S16.2 regression pin)', () => {
    // UAT S16.2: "TAB A: Reload — coverage, chip grid amber states, funnel
    // progress, session ID all PRESERVED. visited_paths count stable."
    // This test pins every field the UAT step names, so a future regression
    // that silently resets one subfield will fail here.
    document.cookie = '_iap_sid=abc123-def456; Path=/';
    const prior = {
      session_id: 'abc123-def456',
      started_at: '2026-04-19T17:00:00.000Z',
      updated_at: '2026-04-19T17:05:30.000Z',
      page_count: 3,
      visited_paths: ['/', '/services', '/demo/ecommerce'],
      events_fired: {
        page_view: 3,
        click_cta: 2,
        scroll_depth: 4,
        product_view: 1,
        add_to_cart: 1,
        begin_checkout: 1,
        click_nav: 2,
        form_start: 1,
      },
      event_type_coverage: {
        fired: [
          'page_view',
          'click_cta',
          'scroll_depth',
          'product_view',
          'add_to_cart',
          'begin_checkout',
          'click_nav',
          'form_start',
        ],
        total: [...DATA_LAYER_EVENT_NAMES],
      },
      demo_progress: {
        ecommerce: {
          stages_reached: ['product_view', 'add_to_cart', 'begin_checkout'],
          percentage: 75,
        },
      },
      consent_snapshot: { analytics: 'granted', marketing: 'granted', preferences: 'granted' },
      coverage_milestones_fired: [25],
    };
    window.sessionStorage.setItem(SESSION_STATE_STORAGE_KEY, JSON.stringify(prior));

    const { result } = renderHook(() => useSessionState(), { wrapper: Wrapper });
    const s = result.current!;

    expect(s.session_id).toBe('abc123-def456');
    expect(s.started_at).toBe('2026-04-19T17:00:00.000Z');
    expect(s.page_count).toBe(3);
    expect(s.visited_paths).toEqual(['/', '/services', '/demo/ecommerce']);
    expect(s.events_fired).toEqual(prior.events_fired);
    expect([...s.event_type_coverage.fired]).toEqual(prior.event_type_coverage.fired);
    expect(s.demo_progress.ecommerce.stages_reached).toEqual([
      'product_view',
      'add_to_cart',
      'begin_checkout',
    ]);
    expect(s.demo_progress.ecommerce.percentage).toBe(75);
    expect(s.consent_snapshot).toEqual(prior.consent_snapshot);
    expect(s.coverage_milestones_fired).toEqual([25]);

    document.cookie = '_iap_sid=; Path=/; Max-Age=0';
  });

  it('reconciles a rehydrated blob with a stale (pre-deploy) coverage total', () => {
    const prior = {
      session_id: 'prior',
      started_at: '2026-04-19T17:00:00.000Z',
      updated_at: '2026-04-19T17:05:00.000Z',
      page_count: 0,
      visited_paths: [],
      events_fired: {},
      // Simulate a pre-deploy persisted blob: only 3 of the 22 live event names.
      event_type_coverage: {
        fired: [],
        total: ['page_view', 'click_cta', 'removed_event_from_a_prior_deploy'],
      },
      demo_progress: { ecommerce: { stages_reached: [], percentage: 0 } },
      consent_snapshot: { analytics: 'denied', marketing: 'denied', preferences: 'denied' },
      coverage_milestones_fired: [],
    };
    window.sessionStorage.setItem(SESSION_STATE_STORAGE_KEY, JSON.stringify(prior));

    const { result } = renderHook(() => useSessionState(), { wrapper: Wrapper });
    // Reconciliation swaps in the live schema list, not the stale stored list.
    expect(result.current!.event_type_coverage.total).toEqual([...DATA_LAYER_EVENT_NAMES]);
  });

  it('rejects a structurally-partial blob and falls back to a freshly-initialised state', () => {
    // Passes shallow shape but missing nested demo_progress.ecommerce — would
    // have crashed the reducer on first event before Pass 1 evaluator I3 fix.
    const malformed = {
      session_id: 'partial',
      started_at: '2026-04-19T17:00:00.000Z',
      updated_at: '2026-04-19T17:00:00.000Z',
      page_count: 0,
      visited_paths: [],
      events_fired: {},
      event_type_coverage: { fired: [], total: [] },
      demo_progress: {},
      consent_snapshot: { analytics: 'denied', marketing: 'denied', preferences: 'denied' },
    };
    window.sessionStorage.setItem(SESSION_STATE_STORAGE_KEY, JSON.stringify(malformed));

    const { result } = renderHook(() => useSessionState(), { wrapper: Wrapper });
    expect(result.current!.session_id).not.toBe('partial');
    expect(result.current!.event_type_coverage.total).toEqual([...DATA_LAYER_EVENT_NAMES]);
  });

  it('captures dataLayer entries pushed before the provider mounts', () => {
    jest.useFakeTimers();
    window.dataLayer.push(makeDataLayerEntry({ event: 'click_cta' }));
    const { result } = renderHook(() => useSessionState(), { wrapper: Wrapper });
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(result.current!.events_fired.click_cta).toBe(1);
  });

  it('persists once per batch with the final state after multiple events in a poll tick', () => {
    jest.useFakeTimers();
    const saveSpy = jest.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useSessionState(), { wrapper: Wrapper });
    const saveCountAfterInit = saveSpy.mock.calls.filter(
      ([key]) => key === SESSION_STATE_STORAGE_KEY,
    ).length;

    act(() => {
      window.dataLayer.push(makeDataLayerEntry({ event: 'click_cta' }));
      window.dataLayer.push(makeDataLayerEntry({ event: 'add_to_cart' }));
      jest.advanceTimersByTime(500);
    });

    const saveCountAfterBatch = saveSpy.mock.calls.filter(
      ([key]) => key === SESSION_STATE_STORAGE_KEY,
    ).length;
    expect(saveCountAfterBatch - saveCountAfterInit).toBe(1);
    expect(result.current!.events_fired).toEqual({ click_cta: 1, add_to_cart: 1 });
    saveSpy.mockRestore();
  });

  it('emits a coverage_milestone data-layer event when a threshold crosses (deliverable 3)', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useSessionState(), { wrapper: Wrapper });

    // Fire 6 distinct iap_source events to cross 25% coverage (6/22 = 27.3%).
    act(() => {
      const names = [
        'page_view',
        'click_cta',
        'scroll_depth',
        'click_nav',
        'form_start',
        'form_submit',
      ];
      for (const name of names) {
        window.dataLayer.push(makeDataLayerEntry({ event: name }));
      }
      jest.advanceTimersByTime(500);
    });

    const milestoneEvents = window.dataLayer.filter(
      (e: { event?: string; threshold?: number }) => e.event === 'coverage_milestone',
    );
    expect(milestoneEvents).toHaveLength(1);
    expect(milestoneEvents[0].threshold).toBe(25);
    expect(result.current!.coverage_milestones_fired).toEqual([25]);
  });

  it('does not re-emit coverage_milestone events that were in the rehydrated blob (deliverable 3)', () => {
    jest.useFakeTimers();
    // Prior blob: visitor already crossed 25% pre-reload.
    const prior = {
      session_id: 'live-session-id',
      started_at: '2026-04-19T17:00:00.000Z',
      updated_at: '2026-04-19T17:05:00.000Z',
      page_count: 1,
      visited_paths: ['/'],
      events_fired: { page_view: 6 },
      event_type_coverage: {
        fired: ['page_view', 'click_cta', 'scroll_depth', 'click_nav', 'form_start', 'form_submit'],
        total: [...DATA_LAYER_EVENT_NAMES],
      },
      demo_progress: { ecommerce: { stages_reached: [], percentage: 0 } },
      consent_snapshot: { analytics: 'granted', marketing: 'denied', preferences: 'granted' },
      coverage_milestones_fired: [25],
    };
    window.sessionStorage.setItem(SESSION_STATE_STORAGE_KEY, JSON.stringify(prior));
    document.cookie = '_iap_sid=live-session-id; Path=/';

    const before = window.dataLayer.length;
    renderHook(() => useSessionState(), { wrapper: Wrapper });
    act(() => {
      jest.advanceTimersByTime(500);
    });

    const newlyPushed = window.dataLayer.slice(before);
    const milestoneEvents = newlyPushed.filter(
      (e: { event?: string }) => e.event === 'coverage_milestone',
    );
    expect(milestoneEvents).toHaveLength(0);

    document.cookie = '_iap_sid=; Path=/; Max-Age=0';
  });

  it('rehydrates at [25] then emits only 50 (not 25 again) when coverage crosses 50% on the first tick (Pass 1 m6)', () => {
    jest.useFakeTimers();
    const { DATA_LAYER_EVENT_NAMES } =
      jest.requireActual<typeof import('@/lib/events/schema')>('@/lib/events/schema');
    const alreadyFired = DATA_LAYER_EVENT_NAMES.slice(0, 6);
    const eventsFiredMap: Record<string, number> = {};
    for (const n of alreadyFired) eventsFiredMap[n] = 1;
    const prior = {
      session_id: 'live-session-id',
      started_at: '2026-04-19T17:00:00.000Z',
      updated_at: '2026-04-19T17:05:00.000Z',
      page_count: 1,
      visited_paths: ['/'],
      events_fired: eventsFiredMap,
      event_type_coverage: {
        fired: [...alreadyFired],
        total: [...DATA_LAYER_EVENT_NAMES],
      },
      demo_progress: { ecommerce: { stages_reached: [], percentage: 0 } },
      consent_snapshot: { analytics: 'granted', marketing: 'denied', preferences: 'granted' },
      coverage_milestones_fired: [25],
    };
    window.sessionStorage.setItem(SESSION_STATE_STORAGE_KEY, JSON.stringify(prior));
    document.cookie = '_iap_sid=live-session-id; Path=/';

    const before = window.dataLayer.length;
    renderHook(() => useSessionState(), { wrapper: Wrapper });
    // Fire enough more distinct events to cross 50% — crossing threshold
    // derives from the live DATA_LAYER_EVENT_NAMES.length (24 post-F2, was
    // 22 pre-F2). Ceil(0.51 * total) gives the first index that puts us
    // past half so the milestone event actually fires.
    const halfMark = Math.ceil(DATA_LAYER_EVENT_NAMES.length * 0.51);
    act(() => {
      for (const n of DATA_LAYER_EVENT_NAMES.slice(6, halfMark)) {
        window.dataLayer.push(makeDataLayerEntry({ event: n }));
      }
      jest.advanceTimersByTime(500);
    });

    const milestones = window.dataLayer
      .slice(before)
      .filter((e: { event?: string }) => e.event === 'coverage_milestone') as Array<{
      threshold?: number;
    }>;
    expect(milestones).toHaveLength(1);
    expect(milestones[0].threshold).toBe(50);

    document.cookie = '_iap_sid=; Path=/; Max-Age=0';
  });

  it('emits a single sessionStorage write per tick when consent reseed and events arrive together (Pass 3 M2)', () => {
    jest.useFakeTimers();
    const { initConsentState } =
      jest.requireActual<typeof import('@/lib/events/track')>('@/lib/events/track');
    const saveSpy = jest.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useSessionState(), { wrapper: Wrapper });
    const saveCountAfterInit = saveSpy.mock.calls.filter(
      ([key]) => key === SESSION_STATE_STORAGE_KEY,
    ).length;

    // Cookiebot arrives late AND an event arrives in the same tick — the tick
    // should combine the reseed + reducer into a single setState+save.
    initConsentState(true, true, false);
    act(() => {
      window.dataLayer.push(makeDataLayerEntry({ event: 'click_cta' }));
      jest.advanceTimersByTime(500);
    });

    const saveCountAfterTick = saveSpy.mock.calls.filter(
      ([key]) => key === SESSION_STATE_STORAGE_KEY,
    ).length;
    try {
      expect(saveCountAfterTick - saveCountAfterInit).toBe(1);
      expect(result.current!.events_fired.click_cta).toBe(1);
    } finally {
      initConsentState(false, false, false);
      saveSpy.mockRestore();
    }
  });

  it('tears down the poll interval on unmount', () => {
    jest.useFakeTimers();
    const clearSpy = jest.spyOn(window, 'clearInterval');
    const { unmount } = renderHook(() => useSessionState(), { wrapper: Wrapper });
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('defaults consent_snapshot to all-denied when getCurrentConsent returns all-denied', () => {
    // In jest, Cookiebot's initConsentState has not been called; the module
    // default (all false) flows through getCurrentConsent → the seed.
    const { result } = renderHook(() => useSessionState(), { wrapper: Wrapper });
    expect(result.current!.consent_snapshot).toEqual({
      analytics: 'denied',
      marketing: 'denied',
      preferences: 'denied',
    });
  });

  it('seeds consent_snapshot from getCurrentConsent when Cookiebot has already initialised (Pass 2 m6)', () => {
    // Simulate Cookiebot having granted consent synchronously before the
    // provider mounts — the seed path must pick that up, not default to denied.
    const { initConsentState } =
      jest.requireActual<typeof import('@/lib/events/track')>('@/lib/events/track');
    initConsentState(true, false, true);
    try {
      const { result } = renderHook(() => useSessionState(), { wrapper: Wrapper });
      expect(result.current!.consent_snapshot).toEqual({
        analytics: 'granted',
        marketing: 'denied',
        preferences: 'granted',
      });
    } finally {
      initConsentState(false, false, false);
    }
  });

  it('re-seeds consent_snapshot on the first poll tick if Cookiebot arrived after mount (Pass 2 m5)', () => {
    jest.useFakeTimers();
    const { initConsentState } =
      jest.requireActual<typeof import('@/lib/events/track')>('@/lib/events/track');
    const { result } = renderHook(() => useSessionState(), { wrapper: Wrapper });
    expect(result.current!.consent_snapshot.analytics).toBe('denied');

    // Cookiebot finishes loading after the mount effect; first poll tick
    // re-reads and heals the snapshot without needing an iap_source event.
    initConsentState(true, true, false);
    act(() => {
      jest.advanceTimersByTime(500);
    });

    try {
      expect(result.current!.consent_snapshot).toEqual({
        analytics: 'granted',
        marketing: 'granted',
        preferences: 'denied',
      });
    } finally {
      initConsentState(false, false, false);
    }
  });

  it('skips the sessionStorage write on init when reconciliation is a no-op (Pass 2 m4)', () => {
    // Pre-populate a valid, up-to-date blob — reconciliation returns the loaded
    // reference unchanged; the provider should not redundantly re-write it.
    const prior = {
      session_id: 'live-session-id',
      started_at: '2026-04-19T17:00:00.000Z',
      updated_at: '2026-04-19T17:00:00.000Z',
      page_count: 0,
      visited_paths: [],
      events_fired: {},
      event_type_coverage: {
        fired: [],
        total: [...DATA_LAYER_EVENT_NAMES],
      },
      demo_progress: { ecommerce: { stages_reached: [], percentage: 0 } },
      consent_snapshot: { analytics: 'denied', marketing: 'denied', preferences: 'denied' },
      coverage_milestones_fired: [],
    };
    window.sessionStorage.setItem(SESSION_STATE_STORAGE_KEY, JSON.stringify(prior));
    // Line up the _iap_sid cookie with the stored session_id so reconciliation
    // recognises the session_id as already current.
    document.cookie = '_iap_sid=live-session-id; Path=/';

    const saveSpy = jest.spyOn(Storage.prototype, 'setItem');
    renderHook(() => useSessionState(), { wrapper: Wrapper });

    const writes = saveSpy.mock.calls.filter(([key]) => key === SESSION_STATE_STORAGE_KEY);
    expect(writes).toHaveLength(0);

    saveSpy.mockRestore();
    document.cookie = '_iap_sid=; Path=/; Max-Age=0';
  });

  it('useSessionState returns null when used outside a provider (SSR-safe)', () => {
    const { result } = renderHook(() => useSessionState());
    expect(result.current).toBeNull();
  });

  it('renders children', () => {
    const { getByText } = render(
      <SessionStateProvider>
        <p>hello</p>
      </SessionStateProvider>,
    );
    expect(getByText('hello')).toBeInTheDocument();
  });
});
