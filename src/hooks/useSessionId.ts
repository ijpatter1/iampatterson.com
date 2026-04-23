'use client';

import { useSyncExternalStore } from 'react';

import { getSessionId } from '@/lib/events/session';

/**
 * Hydration-safe session ID read via `useSyncExternalStore`. Server
 * snapshot is `''` (matching the initial client render for hydration
 * stability); post-hydration renders read the cookie via `getSessionId`.
 *
 * `getSessionId` is idempotent once a cookie exists (subsequent calls
 * return the same id and refresh the cookie max-age as a side-effect).
 * The noop subscribe reflects that the value doesn't change during a
 * tab lifetime.
 *
 * Phase 10a D3 canonical replacement for the
 * `useState('') + useEffect(() => setSessionId(getSessionId()), [])` idiom.
 */
const subscribeNoop = () => () => {};
const getSnapshot = () => getSessionId();
const getServerSnapshot = () => '';

export function useSessionId(): string {
  return useSyncExternalStore(subscribeNoop, getSnapshot, getServerSnapshot);
}
