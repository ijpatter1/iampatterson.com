/**
 * @jest-environment jsdom
 *
 * Phase 9F D11, funnel integration test.
 *
 * Verifies that the SessionState `demo_progress.ecommerce.stages_reached`
 * + percentage invariants hold when the visitor progresses through the
 * ecommerce demo in sequence. Complements the per-page unit tests (each
 * of which verifies that its own tracker fires) by proving that the
 * reducer + SessionStateProvider integrate correctly across the full
 * sequence.
 *
 * The full browser-level reachability test (SessionPulse click → overlay
 * opens → Overview default tab) is in `tests/e2e/ecommerce-sessionpulse.spec.ts`
 * as a Playwright spec, requires a running dev server + installed
 * browsers, so it's not run as part of the Jest suite.
 */
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import { SessionStateProvider, useSessionState } from '@/components/session-state-provider';

function wrapper({ children }: { children: ReactNode }) {
  return <SessionStateProvider>{children}</SessionStateProvider>;
}

function pushEvent(eventName: string) {
  (window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer.push({
    iap_source: true,
    event: eventName,
    timestamp: new Date().toISOString(),
    session_id: 'test-session',
    iap_session_id: 'test-session',
    page_path: '/demo/ecommerce',
    page_title: 'The Tuna Shop',
    consent_analytics: true,
    consent_marketing: false,
    consent_preferences: true,
  });
  // SessionStateProvider polls the data layer every 300ms; advance past it.
  act(() => {
    jest.advanceTimersByTime(400);
  });
}

describe('Phase 9F funnel integration, SessionState.demo_progress', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.sessionStorage.clear();
    (window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer = [];
  });
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).dataLayer;
    jest.useRealTimers();
  });

  it('starts at 0% with empty stages_reached', () => {
    const { result } = renderHook(() => useSessionState(), { wrapper });
    const progress = result.current!.demo_progress.ecommerce;
    expect(progress.stages_reached).toEqual([]);
    expect(progress.percentage).toBe(0);
  });

  it('reaches 25% after product_view', () => {
    const { result } = renderHook(() => useSessionState(), { wrapper });
    pushEvent('product_view');
    const progress = result.current!.demo_progress.ecommerce;
    expect(progress.stages_reached).toEqual(['product_view']);
    expect(progress.percentage).toBe(25);
  });

  it('reaches 100% after the full funnel sequence', () => {
    const { result } = renderHook(() => useSessionState(), { wrapper });
    pushEvent('product_view');
    pushEvent('add_to_cart');
    pushEvent('begin_checkout');
    pushEvent('purchase');
    const progress = result.current!.demo_progress.ecommerce;
    expect(progress.stages_reached).toEqual([
      'product_view',
      'add_to_cart',
      'begin_checkout',
      'purchase',
    ]);
    expect(progress.percentage).toBe(100);
  });

  it('progression is monotonic, duplicate events do not re-add stages', () => {
    const { result } = renderHook(() => useSessionState(), { wrapper });
    pushEvent('product_view');
    pushEvent('product_view');
    pushEvent('product_view');
    const progress = result.current!.demo_progress.ecommerce;
    expect(progress.stages_reached).toEqual(['product_view']);
    expect(progress.percentage).toBe(25);
  });

  it('non-funnel events do not affect demo_progress', () => {
    const { result } = renderHook(() => useSessionState(), { wrapper });
    pushEvent('page_view');
    pushEvent('scroll_depth');
    pushEvent('click_nav');
    const progress = result.current!.demo_progress.ecommerce;
    expect(progress.stages_reached).toEqual([]);
    expect(progress.percentage).toBe(0);
  });

  it('persisted blob reflects funnel progression (resumes after a reload)', () => {
    const { result, unmount } = renderHook(() => useSessionState(), { wrapper });
    pushEvent('product_view');
    pushEvent('add_to_cart');
    const blob = window.sessionStorage.getItem('iampatterson.session_state');
    expect(blob).toBeTruthy();
    const parsed = JSON.parse(blob as string);
    expect(parsed.demo_progress.ecommerce.stages_reached).toEqual(['product_view', 'add_to_cart']);
    expect(parsed.demo_progress.ecommerce.percentage).toBe(50);
    // Avoid unused-var warning
    expect(result.current).not.toBeNull();
    unmount();
  });
});
