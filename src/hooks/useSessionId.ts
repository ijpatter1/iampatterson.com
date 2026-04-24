'use client';

import { useEffect, useSyncExternalStore } from 'react';

import { getSessionId, readSessionCookie } from '@/lib/events/session';

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
 * Mount protocol:
 *   - SSR snapshot: `''` (matches the initial client render for stable
 *     hydration).
 *   - First post-hydration render: reads cookie via `readSessionCookie`.
 *     Returns `''` if no cookie exists yet (the SessionStateProvider's
 *     own mount effect usually mints one slightly earlier; when this
 *     hook is used outside that provider tree, the fallback below
 *     mints on mount).
 *   - Mount effect: if the cookie is still `''`, call `getSessionId`
 *     (mints + notifies). Listeners across all `useSessionId` consumers
 *     re-run getSnapshot and pick up the freshly-minted value.
 *
 * Module-level listener set lets the mint from one component (or from
 * any caller of the exported `notifySessionCookieChange` — see
 * `setSessionCookie` in `@/lib/events/session` for future wiring)
 * propagate to every subscribed hook instance.
 *
 * Phase 10a D3 canonical replacement for the
 * `useState('') + useEffect(() => setSessionId(getSessionId()), [])`
 * idiom. Pair with `readSessionCookie`-based passive reads
 * (see `useSessionContext`) when the observer must NOT mint.
 */

const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): string {
  return readSessionCookie() ?? '';
}

function getServerSnapshot(): string {
  return '';
}

/** Notify all `useSessionId` subscribers that the cookie has changed. */
export function notifySessionCookieChange(): void {
  for (const l of listeners) l();
}

export function useSessionId(): string {
  const id = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (id) return;
    // Mint exactly once when this hook instance observes a missing
    // cookie on mount. getSessionId handles the missing-cookie UUID
    // generation and the existing-cookie max-age refresh uniformly.
    getSessionId();
    notifySessionCookieChange();
  }, [id]);

  return id;
}
