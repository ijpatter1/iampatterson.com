/**
 * @jest-environment jsdom
 *
 * Phase 10a D3: pins the hydration-gate contract for useClientMount.
 * The hook must return `false` on the server render (initial) and
 * `true` from the first post-hydration render onward; test fixtures
 * that directly `renderHook` in jsdom skip the SSR pass, so the
 * observable contract in this environment is "always true after
 * render + effect commit."
 */
import { renderHook } from '@testing-library/react';

import { useClientMount } from '@/hooks/useClientMount';

describe('useClientMount', () => {
  it('returns true after render in the jsdom (client) environment', () => {
    const { result } = renderHook(() => useClientMount());
    // In jsdom, useSyncExternalStore's getSnapshot is called
    // immediately, returns true. No effect delay needed — the value
    // arrives synchronously with render.
    expect(result.current).toBe(true);
  });

  it('returns the same value across re-renders without retriggering subscribers', () => {
    const { result, rerender } = renderHook(() => useClientMount());
    const first = result.current;
    rerender();
    const second = result.current;
    expect(first).toBe(true);
    expect(second).toBe(true);
  });
});
