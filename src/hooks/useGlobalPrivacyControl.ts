'use client';

import { useSyncExternalStore } from 'react';

import { isGlobalPrivacyControlEnabled } from '@/lib/events/global-privacy-control';

// The signal is fixed for the life of the page, so there is nothing to
// subscribe to. The store exists to give the server render a stable `false`
// and let the client correct it after hydration without a mismatch.
const subscribe = () => () => {};
const getServerSnapshot = () => false;

/** Whether the visitor's browser sends Global Privacy Control. */
export function useGlobalPrivacyControl(): boolean {
  return useSyncExternalStore(subscribe, isGlobalPrivacyControlEnabled, getServerSnapshot);
}
