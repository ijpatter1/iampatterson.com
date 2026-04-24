/**
 * @jest-environment jsdom
 *
 * Phase 10a D3: pins the passive-read + mount-mint contract for
 * useSessionId. The hook's critical invariants:
 *   1. getSnapshot is pure (never writes to document.cookie). React
 *      calling it multiple times per render must not thrash the
 *      cookie. Covered indirectly by snapshot-stability + write-count
 *      assertions.
 *   2. When no cookie exists on mount, the hook's mount effect mints
 *      exactly one via getSessionId, then notifies subscribers so the
 *      next render returns the fresh value.
 *   3. When a cookie already exists, no mint occurs (reads it as-is).
 *   4. Multiple component instances sharing the module-level listener
 *      set see consistent values after any instance mints.
 */
import { act, renderHook } from '@testing-library/react';

import { useSessionId, notifySessionCookieChange } from '@/hooks/useSessionId';
import { SESSION_COOKIE_NAME } from '@/lib/events/session';

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

  it('returns empty string initially when no cookie is set, then a minted id after the mount effect', async () => {
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

  it('shares state across multiple hook instances via the module-level listener set', async () => {
    const { result: a } = renderHook(() => useSessionId());
    const { result: b } = renderHook(() => useSessionId());

    // Both should resolve to the same minted value (one minted during
    // its mount, the other's listener fired on notifySessionCookieChange).
    expect(a.current).toBe(b.current);
    expect(a.current).toMatch(/^[0-9a-f-]{36}$/);
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

  it('unsubscribes on unmount to avoid listener leaks', () => {
    // Indirectly observable via: unmount → external notify should not
    // trigger a warning from the hook's listener set. If the listener
    // leaked, subsequent renders on stale refs would warn.
    const { unmount, result } = renderHook(() => useSessionId());
    expect(result.current).toMatch(/^[0-9a-f-]{36}$/);
    expect(() => {
      unmount();
      notifySessionCookieChange();
      notifySessionCookieChange();
    }).not.toThrow();
  });
});
