'use client';

import { useEffect, useSyncExternalStore } from 'react';

import {
  getSessionId,
  notifySessionCookieChange,
  readSessionCookie,
  subscribeSessionCookie,
} from '@/lib/events/session';

/**
 * Hydration-safe session ID observer via `useSyncExternalStore`.
 *
 * `getSnapshot` is a **pure read** (`readSessionCookie`) — contrast
 * the lib-level `getSessionId` which writes `document.cookie` on every
 * call (mints UUID on miss, refreshes max-age on hit). React may call
 * getSnapshot multiple times per render in concurrent mode; a writing
 * snapshot would thrash the cookie on each consistency check, so this
 * hook routes the write through a single on-mount `useEffect` instead.
 *
 * Subscription contract (owned by `src/lib/events/session.ts`): every
 * writer of the session cookie (`setSessionCookie` → called by
 * `getSessionId` on mint or refresh) calls `notifySessionCookieChange`,
 * which re-triggers `getSnapshot` on every mounted consumer. So a mint
 * from SessionStateProvider's hydration effect (or any other caller)
 * propagates into every live-strip / session-pulse / pipeline-editorial
 * that reads via this hook without needing a component-level re-render
 * trigger.
 *
 * Mount protocol:
 *   - SSR snapshot: `''` (matches the initial client render for stable
 *     hydration).
 *   - First post-hydration render: reads cookie via `readSessionCookie`.
 *     Returns the cookie value if set, or `''` if not yet minted.
 *   - Mount effect: if the cookie is still `''`, call `getSessionId`
 *     (mints + implicitly notifies via setSessionCookie). Listeners
 *     across all `useSessionId` consumers re-run getSnapshot and pick
 *     up the freshly-minted value.
 *
 * Phase 10a D3 canonical replacement for the
 * `useState('') + useEffect(() => setSessionId(getSessionId()), [])`
 * idiom. Pair with `readSessionCookie`-based passive reads
 * (see `useSessionContext`) when the observer must NOT mint.
 */

function getSnapshot(): string {
  return readSessionCookie() ?? '';
}

function getServerSnapshot(): string {
  return '';
}

export function useSessionId(): string {
  const id = useSyncExternalStore(subscribeSessionCookie, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (id) return;
    // Mint exactly once when this hook instance observes a missing
    // cookie on mount. getSessionId handles the missing-cookie UUID
    // generation; setSessionCookie fires notifySessionCookieChange so
    // every subscriber gets the new value on the same render tick.
    getSessionId();
  }, [id]);

  return id;
}

// Re-export the notify for tests + any future rotation writer that
// wants to bypass the setSessionCookie path.
export { notifySessionCookieChange };
