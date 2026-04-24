/**
 * Phase 10a D3: pins the hydration-gate contract for useClientMount.
 *
 * The hook uses `useSyncExternalStore(subscribeNever, () => true, () => false)`.
 * That means:
 *   - On the server: React invokes `getServerSnapshot` → `false`.
 *   - On the client first render (during hydration): React must also
 *     use the server snapshot (`false`) so text content matches SSR.
 *   - On subsequent renders: React calls `getSnapshot` → `true`.
 *
 * The SSR-path assertion below uses `react-dom/server`'s `renderToString`
 * to exercise the server-snapshot branch that jsdom's `renderHook` skips.
 * Without it, a regression to `() => true` on both branches would pass
 * the jsdom test while breaking hydration in production.
 */
import { renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';

import { useClientMount } from '@/hooks/useClientMount';

function Probe() {
  const mounted = useClientMount();
  return mounted ? 'client' : 'server';
}

describe('useClientMount', () => {
  it('returns false on the server render (hydration-safe SSR snapshot)', () => {
    const html = renderToString(<Probe />);
    expect(html).toBe('server');
  });

  it('returns true after render in the jsdom (client) environment', () => {
    const { result } = renderHook(() => useClientMount());
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
