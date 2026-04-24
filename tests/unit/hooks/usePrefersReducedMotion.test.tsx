/**
 * @jest-environment jsdom
 *
 * Phase 10a D3: pins the matchMedia subscription contract for
 * usePrefersReducedMotion. Covers the three code paths:
 *   1. matchMedia unavailable (SSR-like / old browsers) → returns false
 *   2. matchMedia present + reduced-motion preferred → returns true
 *   3. matchMedia present + change event fires → re-renders with new value
 */
import { act, renderHook } from '@testing-library/react';

import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

type Listener = (e: { matches: boolean }) => void;

interface MockMediaQueryList {
  matches: boolean;
  addEventListener: jest.Mock<void, [string, Listener]>;
  removeEventListener: jest.Mock<void, [string, Listener]>;
  __fire: (matches: boolean) => void;
}

function installMatchMedia(initial: boolean): MockMediaQueryList {
  let listener: Listener | null = null;
  const mql: MockMediaQueryList = {
    matches: initial,
    addEventListener: jest.fn((_event, cb) => {
      listener = cb;
    }),
    removeEventListener: jest.fn(() => {
      listener = null;
    }),
    __fire: (matches: boolean) => {
      mql.matches = matches;
      if (listener) listener({ matches });
    },
  };
  (window as unknown as { matchMedia: (q: string) => MockMediaQueryList }).matchMedia = () => mql;
  return mql;
}

function uninstallMatchMedia(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).matchMedia;
}

describe('usePrefersReducedMotion', () => {
  afterEach(() => {
    uninstallMatchMedia();
  });

  it('returns false when matchMedia is unavailable (graceful degrade)', () => {
    uninstallMatchMedia();
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns the current matchMedia state on first render', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  it('re-renders with the new value when the media query fires a change event', () => {
    const mql = installMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      mql.__fire(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      mql.__fire(false);
    });
    expect(result.current).toBe(false);
  });

  it('unsubscribes on unmount to avoid listener leaks', () => {
    const mql = installMatchMedia(false);
    const { unmount } = renderHook(() => usePrefersReducedMotion());
    expect(mql.addEventListener).toHaveBeenCalledTimes(1);
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledTimes(1);
  });
});
