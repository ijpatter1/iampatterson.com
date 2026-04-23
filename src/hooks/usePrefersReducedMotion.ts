'use client';

import { useSyncExternalStore } from 'react';

/**
 * `prefers-reduced-motion` media-query subscription via
 * `useSyncExternalStore`. Read value at render time (no
 * setState-in-effect), subscribe to runtime changes for users who
 * toggle the OS setting while the tab is open.
 *
 * SSR default: `false` (the animated/full-motion variant is the safe
 * conservative choice for hydration — opt-in reduced-motion applies
 * on the first post-hydration render for clients that actually set
 * the preference).
 *
 * Canonical Phase 10a D3 replacement for the `useState` +
 * `useEffect` + `matchMedia` idiom across chrome, reveal, and
 * ecommerce component trees.
 */
function subscribeReducedMotion(callback: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (typeof mql.addEventListener !== 'function') return () => {};
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}
function getReducedMotionSnapshot(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function getReducedMotionServerSnapshot(): boolean {
  return false;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
}
