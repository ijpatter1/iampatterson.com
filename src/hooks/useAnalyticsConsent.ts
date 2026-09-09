'use client';

import { useEffect, useState } from 'react';

import { useSessionState } from '@/components/session-state-provider';
import type { ConsentValue } from '@/lib/session-state/types';

/**
 * The visitor's analytics consent, but only once they have actually chosen.
 *
 * `consent_snapshot.analytics` is derived from booleans, so an unanswered
 * banner and a decline both read as `denied`. Telling a first-time visitor they
 * declined before they chose would be its own dishonesty, so the presence of
 * Cookiebot's own `CookieConsent` cookie is what distinguishes the two.
 *
 * **Why this is a hook rather than three inline derivations.** Three call sites
 * need it — the overlay timeline, the homepage pipeline feed and the demo
 * session context — and each was previously either unaware of consent or
 * deriving it from its own local state. A review found the overlay's version
 * read the cookie through `useStorageInspector(isOpen)`, which empties its
 * snapshot when the overlay closes: consent flipped to `undefined` mid-fade,
 * the SSE pin released, and a decliner watched the Timeline badge drop from 9
 * to 1 as the panel faded out. Reading `document.cookie` directly is
 * independent of whether any panel is open, so the answer no longer depends on
 * what the visitor happens to be looking at.
 *
 * Returns `undefined` until the banner is answered — callers must treat that as
 * "not known", never as a decline.
 */
export function useAnalyticsConsent(): ConsentValue | undefined {
  const sessionState = useSessionState();
  const [hasChosen, setHasChosen] = useState(false);

  useEffect(() => {
    if (hasChosen) return; // sticky: a choice, once made, is not un-made by a re-render
    const check = () => {
      if (typeof document === 'undefined') return;
      if (document.cookie.includes('CookieConsent=')) setHasChosen(true);
    };
    check();
    // Cookiebot writes the cookie after its own script resolves, which can land
    // after first paint. Poll briefly rather than assume it is there at mount.
    const id = window.setInterval(check, 500);
    return () => window.clearInterval(id);
  }, [hasChosen]);

  if (!hasChosen || !sessionState) return undefined;
  return sessionState.consent_snapshot.analytics;
}
