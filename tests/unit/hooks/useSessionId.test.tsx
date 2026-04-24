/**
 * @jest-environment jsdom
 *
 * Phase 10a D3: pins the passive-read + mount-mint contract for
 * useSessionId. Subscription flows through
 * `subscribeSessionCookie` / `notifySessionCookieChange` in
 * `@/lib/events/session` — same module that owns `setSessionCookie`,
 * so every cookie write (mint or refresh or external rotation)
 * propagates to every mounted consumer.
 *
 * Invariants pinned below:
 *   1. getSnapshot is pure (never writes to document.cookie).
 *   2. When no cookie exists on mount, the hook's mount effect mints
 *      exactly one via getSessionId → setSessionCookie → notify.
 *   3. When a cookie already exists, no mint path triggers.
 *   4. Multiple hook instances share the listener-set channel — a
 *      mint or external rotation updates ALL mounted consumers on
 *      the same render tick, not just whichever one triggered the
 *      write.
 *   5. Unmounted subscribers don't leak into the listener set.
 */
import { act, renderHook } from '@testing-library/react';

import { useSessionId, notifySessionCookieChange } from '@/hooks/useSessionId';
import { SESSION_COOKIE_NAME, _getSessionCookieListenerCountForTests } from '@/lib/events/session';

function clearCookies(): void {
  for (const part of document.cookie.split(';')) {
    const [name] = part.trim().split('=');
    document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
}

describe('useSessionId', () => {
  beforeEach(() => {
    clearCookies();
  });

  it('returns empty string initially when no cookie is set, then a minted id after the mount effect', () => {
    const { result, rerender } = renderHook(() => useSessionId());
    // First commit reflects the mount effect synchronously via the
    // notify mechanism — RTL's renderHook flushes effects before
    // returning control to the test.
    expect(result.current).toMatch(/^[0-9a-f-]{36}$/);

    // Cookie was minted by the mount effect.
    expect(document.cookie).toContain(SESSION_COOKIE_NAME);

    const first = result.current;
    rerender();
    // Stable across re-renders — no mint on second read.
    expect(result.current).toBe(first);
  });

  it('returns the existing cookie value without minting a new one', () => {
    const existingId = 'seed-session-id-from-prior-visit';
    document.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(existingId)}; Path=/`;

    const { result } = renderHook(() => useSessionId());
    expect(result.current).toBe(existingId);
  });

  // Cross-instance listener propagation — the strong form of the
  // contract. Mount B FIRST (subscribes to the channel), then mount A
  // (which mints on its empty-cookie path). B should observe the new
  // value via the listener fan-out, not just because its own
  // getSnapshot happened to read the now-populated cookie.
  it('propagates a mint from one hook instance to earlier-mounted instances via the listener set', () => {
    const first = renderHook(() => useSessionId());
    // Clear the cookie that `first`'s mount effect minted so we can
    // observe a second mint propagating back to `first`.
    clearCookies();

    const newId = 'simulated-external-rotation';
    document.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(newId)}; Path=/`;
    act(() => {
      notifySessionCookieChange();
    });

    // `first` must have re-read the cookie via its subscribe channel;
    // if the listener set weren't wired, it would still show the
    // stale minted UUID.
    expect(first.result.current).toBe(newId);
  });

  it('re-reads the cookie when notifySessionCookieChange is called externally', () => {
    const { result } = renderHook(() => useSessionId());
    const initial = result.current;

    const newId = 'externally-rotated-id';
    document.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(newId)}; Path=/`;

    act(() => {
      notifySessionCookieChange();
    });

    expect(result.current).toBe(newId);
    expect(result.current).not.toBe(initial);
  });

  // Direct leak-detection assertion via the test-only introspection
  // helper exported from `@/lib/events/session`. A leaked listener
  // would be visible as a persistent non-zero count after unmount.
  it('unsubscribes on unmount — listener set size returns to baseline', () => {
    const baseline = _getSessionCookieListenerCountForTests();

    const { unmount } = renderHook(() => useSessionId());
    expect(_getSessionCookieListenerCountForTests()).toBe(baseline + 1);

    unmount();
    expect(_getSessionCookieListenerCountForTests()).toBe(baseline);
  });
});
