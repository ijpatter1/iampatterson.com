'use client';

import { useEffect, useState } from 'react';
import {
  diffSnapshot,
  readAllStorage,
  type StorageSnapshot,
} from '@/lib/identity/storage-inspector';

const EMPTY_SNAPSHOT: StorageSnapshot = { entries: [], takenAt: 0 };
const POLL_INTERVAL_MS = 1000;

function isQuiet(prev: StorageSnapshot, next: StorageSnapshot): boolean {
  const d = diffSnapshot(prev, next);
  return d.added.length === 0 && d.changed.length === 0 && d.removed.length === 0;
}

/**
 * Live read-only inspector of cookies + localStorage + sessionStorage. Polls
 * on a 1s tick **only while `enabled`** (typically wired to overlay-open),
 * plus subscribes to the native `storage` event for cross-tab writes that
 * shouldn't wait for the next tick. When `enabled` is false the snapshot is
 * empty and nothing runs — zero cost on closed-overlay sessions.
 *
 * Snapshot identity is preserved across consecutive ticks when nothing
 * changed (consumers can rely on `===` to skip rerenders).
 */
export function useStorageInspector(enabled: boolean): StorageSnapshot {
  const [snapshot, setSnapshot] = useState<StorageSnapshot>(() =>
    enabled && typeof window !== 'undefined' ? readAllStorage() : EMPTY_SNAPSHOT,
  );

  // Why the disable on the leading setSnapshot below: this effect IS the
  // subscription to an external system (cookie jar + localStorage +
  // sessionStorage). The leading call is the "initial publish" when the
  // subscription opens or closes — there's no derive-from-props alternative
  // because the snapshot is an observation of browser state with no React-
  // state representation. The tick callback uses the functional setState
  // form so it never reads stale closure state, removing the need for a
  // ref-during-render pattern.
  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- external-subscription publish (see comment above)
      setSnapshot(EMPTY_SNAPSHOT);
      return;
    }
    setSnapshot(readAllStorage());

    const tick = () => {
      const next = readAllStorage();
      setSnapshot((prev) => (isQuiet(prev, next) ? prev : next));
    };
    const interval = window.setInterval(tick, POLL_INTERVAL_MS);
    const onStorage = () => tick();
    window.addEventListener('storage', onStorage);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', onStorage);
    };
  }, [enabled]);

  return snapshot;
}
