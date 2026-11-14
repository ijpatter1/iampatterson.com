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
 * CookiebotOnLoad without an answer (`hasResponse === false`) is a visitor who
 * has never chosen: unless Cookiebot reports statistics granted (an
 * implied-consent region), a leftover `_iap_aid` is expired. Only the cookie
 * is touched: no consent is recorded and no gtag update is sent, so this can
 * never force a region to denied. With an answer, CookiebotOnAccept or
 * CookiebotOnDecline fires alongside and handles it. Measured 2026-11-14 on a
 * reload with a stored choice: this event arrives at ~180ms, after Cookiebot
 * has resolved.
 */
function handleCookiebotLoad() {
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

    // For a stored choice Cookiebot resolves after this mount, its loader
    // fires CookiebotOnAccept or CookiebotOnDecline on page load as well, so
    // these two listeners are also the returning visitor's path. That matters
    // because the bridge in track.ts is the only writer of Consent Mode.
    window.addEventListener('CookiebotOnAccept', handleConsentChange);
    window.addEventListener('CookiebotOnDecline', handleConsentChange);
    window.addEventListener('CookiebotOnLoad', handleCookiebotLoad);
    return () => {
      window.removeEventListener('CookiebotOnAccept', handleConsentChange);
      window.removeEventListener('CookiebotOnDecline', handleConsentChange);
      window.removeEventListener('CookiebotOnLoad', handleCookiebotLoad);
    };
  }, []);

  return null;
}
