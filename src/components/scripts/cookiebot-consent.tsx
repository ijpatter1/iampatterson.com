'use client';

import { useEffect } from 'react';

import { trackConsentUpdate } from '@/lib/events/track';

interface CookiebotGlobal {
  consent: {
    statistics: boolean;
    marketing: boolean;
    preferences: boolean;
  };
}

function handleConsentChange() {
  const cb = (window as unknown as { Cookiebot?: CookiebotGlobal }).Cookiebot;
  if (!cb) return;
  trackConsentUpdate(cb.consent.statistics, cb.consent.marketing, cb.consent.preferences);
}

export function CookiebotConsentListener() {
  useEffect(() => {
    window.addEventListener('CookiebotOnAccept', handleConsentChange);
    window.addEventListener('CookiebotOnDecline', handleConsentChange);
    return () => {
      window.removeEventListener('CookiebotOnAccept', handleConsentChange);
      window.removeEventListener('CookiebotOnDecline', handleConsentChange);
    };
  }, []);

  return null;
}
