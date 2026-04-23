'use client';

import { useSyncExternalStore } from 'react';

/**
 * React 19 hydration gate: `false` during SSR and the initial client
 * render (matching the server snapshot so hydration is stable), `true`
 * starting from the first post-hydration render.
 *
 * Canonical replacement for the `const [mounted, setMounted] = useState(false);
 * useEffect(() => setMounted(true), [])` idiom — passes the
 * `react-hooks/set-state-in-effect` rule (Phase 10a D3) and is the
 * pattern the React docs recommend for "differentiate SSR from CSR
 * render output without a hydration mismatch."
 *
 * Use this to gate rendering of browser-only surfaces (portals,
 * iframes with client-only src, animations that need document).
 */
const alwaysTrue = (): true => true;
const alwaysFalse = (): false => false;
const subscribeNever = (): (() => void) => () => {};

export function useClientMount(): boolean {
  return useSyncExternalStore(subscribeNever, alwaysTrue, alwaysFalse);
}
