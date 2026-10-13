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

/**
 * Apply Cookiebot's current consent without a `consent_update` event. Used for
 * a returning visitor's stored choice, which is state, not a change.
 */
function applyStoredConsent() {
  const cb = (window as unknown as { Cookiebot?: CookiebotGlobal }).Cookiebot;
  if (!cb?.consent) return;
  initConsentState(cb.consent.statistics, cb.consent.marketing, cb.consent.preferences);
}

export function CookiebotConsentListener() {
  useEffect(() => {
    // Returning visitor whose stored choice Cookiebot has already read.
    applyStoredConsent();

    // The bridge in track.ts is the only writer of Consent Mode (Cookiebot's
    // own writes are off), so a stored choice Cookiebot resolves after this
    // mount has to reach it too. CookiebotOnConsentReady fires for that.
    window.addEventListener('CookiebotOnConsentReady', applyStoredConsent);
    window.addEventListener('CookiebotOnAccept', handleConsentChange);
    window.addEventListener('CookiebotOnDecline', handleConsentChange);
    return () => {
      window.removeEventListener('CookiebotOnConsentReady', applyStoredConsent);
      window.removeEventListener('CookiebotOnAccept', handleConsentChange);
      window.removeEventListener('CookiebotOnDecline', handleConsentChange);
    };
  }, []);

  return null;
}
