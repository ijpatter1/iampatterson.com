'use client';

import { useEffect } from 'react';

import { initConsentState, trackConsentUpdate } from '@/lib/events/track';

interface CookiebotGlobal {
  consent: {
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

export function CookiebotConsentListener() {
  useEffect(() => {
    // Initialize consent state from Cookiebot if already loaded (returning visitor)
    const cb = (window as unknown as { Cookiebot?: CookiebotGlobal }).Cookiebot;
    if (cb?.consent) {
      initConsentState(cb.consent.statistics, cb.consent.marketing, cb.consent.preferences);
    }

    // For a stored choice Cookiebot resolves after this mount, its loader
    // fires CookiebotOnAccept or CookiebotOnDecline on page load as well, so
    // these two listeners are also the returning visitor's path. That matters
    // because the bridge in track.ts is the only writer of Consent Mode.
    window.addEventListener('CookiebotOnAccept', handleConsentChange);
    window.addEventListener('CookiebotOnDecline', handleConsentChange);
    return () => {
      window.removeEventListener('CookiebotOnAccept', handleConsentChange);
      window.removeEventListener('CookiebotOnDecline', handleConsentChange);
    };
  }, []);

  return null;
}
