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
    delete (window as Record<string, unknown>).dataLayer;
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

  it('hydrates from sessionStorage when prior state exists', () => {
    const prior = {
      session_id: 'prior',
      started_at: '2026-04-19T17:00:00.000Z',
      updated_at: '2026-04-19T17:05:00.000Z',
      page_count: 2,
      visited_paths: ['/', '/services'],
      events_fired: { page_view: 2, click_cta: 1 },
      event_type_coverage: {
        fired: ['page_view', 'click_cta'],
        total: ['page_view', 'click_cta'],
      },
      demo_progress: { ecommerce: { stages_reached: [], percentage: 0 } },
      consent_snapshot: { analytics: 'granted', marketing: 'denied', preferences: 'granted' },
    };
    window.sessionStorage.setItem(SESSION_STATE_STORAGE_KEY, JSON.stringify(prior));

    const { result } = renderHook(() => useSessionState(), { wrapper: Wrapper });
    expect(result.current!.session_id).toBe('prior');
    expect(result.current!.events_fired.click_cta).toBe(1);
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
