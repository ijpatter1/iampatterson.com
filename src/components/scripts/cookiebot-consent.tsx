'use client';

import { useEffect } from 'react';

import {
  applyStoredConsent,
  expireAnonymousIdLeftover,
  initConsentState,
  trackConsentUpdate,
} from '@/lib/events/track';

interface CookiebotGlobal {
  /** True once Cookiebot has resolved the visitor's answer. */
  hasResponse?: boolean;
  /**
   * True when the visitor has just submitted a choice in the banner, false
   * when Cookiebot is replaying a stored choice on page load.
   */
  changed?: boolean;
  consent?: {
    statistics: boolean;
    marketing: boolean;
    preferences: boolean;
  };
}

/**
 * CookiebotOnAccept and CookiebotOnDecline fire for a choice the visitor makes
 * in the banner and also, on every page load, for a stored choice Cookiebot
 * replays (after CookiebotOnLoad, ~180ms in). `Cookiebot.changed` tells them
 * apart: true for a submission, even of the same choice, and false for the
 * replay (measured on localhost, 2026-11-15). The replay is recorded silently,
 * as a resolved answer, so a reload pushes no `consent_update` the visitor
 * did not make (15.8) and a stored decline still expires a leftover
 * `_iap_aid`. A Cookiebot that does not report `changed` is treated as
 * reporting a choice, which is the behavior before 15.8.
 */
function handleConsentChange() {
  const cb = (window as unknown as { Cookiebot?: CookiebotGlobal }).Cookiebot;
  if (!cb?.consent) return;
  const { statistics, marketing, preferences } = cb.consent;
  if (cb.changed === false) {
    initConsentState(statistics, marketing, preferences, cb.hasResponse === true);
    return;
  }
  trackConsentUpdate(statistics, marketing, preferences);
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
    // A returning visitor's stored choice, from Cookiebot's cookie (15.8). On
    // a reload Cookiebot is still unresolved here; its defaults are not the
    // visitor's choice, and recording them would send Google a denied update
    // after the stored choice the inline script sent ahead of GTM. A stored
    // decline expires a leftover `_iap_aid` here.
    applyStoredConsent();
    // Cookiebot has already resolved (a slow hydration): its answer wins.
    const cb = (window as unknown as { Cookiebot?: CookiebotGlobal }).Cookiebot;
    if (cb?.consent && cb.hasResponse === true) {
      initConsentState(cb.consent.statistics, cb.consent.marketing, cb.consent.preferences, true);
    }
    expireLeftoverIfNeverChosen();

    // For a stored choice Cookiebot resolves after this mount, its loader
    // fires CookiebotOnAccept or CookiebotOnDecline on page load as well, so
    // these two listeners are also the returning visitor's path (see
    // handleConsentChange).
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
