'use client';

import { useEffect } from 'react';

import {
  expireAnonymousIdLeftover,
  initConsentState,
  trackConsentUpdate,
} from '@/lib/events/track';

interface CookiebotGlobal {
  /** True once Cookiebot has resolved the visitor's answer. */
  hasResponse?: boolean;
  consent?: {
    statistics: boolean;
    marketing: boolean;
    preferences: boolean;
  };
}

function handleConsentChange() {
  const cb = (window as unknown as { Cookiebot?: CookiebotGlobal }).Cookiebot;
  if (!cb?.consent) return;
  trackConsentUpdate(cb.consent.statistics, cb.consent.marketing, cb.consent.preferences);
}

/**
 * A visitor who has never chosen (`hasResponse === false`, strictly: undefined
 * means Cookiebot has not resolved yet): unless Cookiebot reports statistics
 * granted (an implied-consent region), a leftover `_iap_aid` is expired. Only
 * the cookie is touched: no consent is recorded and no gtag update is sent,
 * so this can never force a region to denied.
 *
 * Measured in production on 2026-11-14 (Chromium and WebKit): for this
 * visitor CookiebotOnLoad never fires. `hasResponse` goes from undefined to
 * false at ~170-230ms, then CookiebotOnDialogInit fires, then
 * CookiebotOnDialogDisplay (~430-700ms). So this runs on mount, in case
 * Cookiebot has already got there, and on CookiebotOnDialogInit.
 */
function expireLeftoverIfNeverChosen() {
  const cb = (window as unknown as { Cookiebot?: CookiebotGlobal }).Cookiebot;
  if (cb?.hasResponse !== false) return;
  if (cb.consent?.statistics === true) return;
  expireAnonymousIdLeftover();
}

export function CookiebotConsentListener() {
  useEffect(() => {
    // Initialize consent state from Cookiebot if already loaded (returning visitor)
    const cb = (window as unknown as { Cookiebot?: CookiebotGlobal }).Cookiebot;
    if (cb?.consent) {
      // `hasResponse` is passed through so a resolved decline can expire a
      // leftover `_iap_aid` and Cookiebot's unresolved default cannot.
      initConsentState(
        cb.consent.statistics,
        cb.consent.marketing,
        cb.consent.preferences,
        cb.hasResponse === true,
      );
    }
    expireLeftoverIfNeverChosen();

    // For a stored choice Cookiebot resolves after this mount, its loader
    // fires CookiebotOnAccept or CookiebotOnDecline on page load as well, so
    // these two listeners are also the returning visitor's path. That matters
    // because the bridge in track.ts is the only writer of Consent Mode.
    window.addEventListener('CookiebotOnAccept', handleConsentChange);
    window.addEventListener('CookiebotOnDecline', handleConsentChange);
    window.addEventListener('CookiebotOnDialogInit', expireLeftoverIfNeverChosen);
    return () => {
      window.removeEventListener('CookiebotOnAccept', handleConsentChange);
      window.removeEventListener('CookiebotOnDecline', handleConsentChange);
      window.removeEventListener('CookiebotOnDialogInit', expireLeftoverIfNeverChosen);
    };
  }, []);

  return null;
}
