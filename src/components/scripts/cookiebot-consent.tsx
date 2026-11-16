'use client';

import { useEffect } from 'react';

import { applyStoredConsent, initConsentState, trackConsentUpdate } from '@/lib/events/track';

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
 * reporting a choice, which is the behavior before 15.8. A submission
 * (`changed === true`) that grants analytics also sends this page's blocked
 * page_view again (`trackConsentUpdate`'s `submitted`).
 */
function handleConsentChange() {
  const cb = (window as unknown as { Cookiebot?: CookiebotGlobal }).Cookiebot;
  if (!cb?.consent) return;
  const { statistics, marketing, preferences } = cb.consent;
  if (cb.changed === false) {
    initConsentState(statistics, marketing, preferences, cb.hasResponse === true);
    return;
  }
  trackConsentUpdate(statistics, marketing, preferences, cb.changed === true);
}

/**
 * Record what Cookiebot reports once it reports anything: `hasResponse` true
 * (its resolved answer, on a slow hydration) or false (no answer). Undefined
 * means it has not resolved yet, and is skipped: those are its defaults, not
 * the visitor's consent.
 *
 * With no answer, Cookiebot's report is authoritative over the stored cookie
 * (15.8): for a visitor who has never chosen it is a decline, which expires a
 * leftover `_iap_aid`; for a stored choice Cookiebot rejected (an invalid
 * cookie, or consent it asks to renew) it withdraws what the inline script
 * applied; in an opt-out region it is implied consent. Recorded silently, as
 * a resolved answer, and sent to Consent Mode where it differs.
 *
 * Measured in production on 2026-11-14 (Chromium and WebKit): for a visitor
 * who has never chosen, CookiebotOnLoad never fires. `hasResponse` goes from
 * undefined to false at ~170-230ms, then CookiebotOnDialogInit fires, then
 * CookiebotOnDialogDisplay (~430-700ms). So this runs on mount and on
 * CookiebotOnDialogInit.
 */
function recordCookiebotReport() {
  const cb = (window as unknown as { Cookiebot?: CookiebotGlobal }).Cookiebot;
  if (!cb?.consent || typeof cb.hasResponse !== 'boolean') return;
  initConsentState(
    cb.consent.statistics === true,
    cb.consent.marketing === true,
    cb.consent.preferences === true,
    true,
  );
}

export function CookiebotConsentListener() {
  useEffect(() => {
    // A returning visitor's stored choice, from Cookiebot's cookie (15.8). On
    // a reload Cookiebot is still unresolved here; its defaults are not the
    // visitor's choice, and recording them would send Google a denied update
    // after the stored choice the inline script sent ahead of GTM. A stored
    // decline expires a leftover `_iap_aid` here.
    applyStoredConsent();
    // Cookiebot has already reported (a slow hydration): its report wins.
    recordCookiebotReport();

    // For a stored choice Cookiebot resolves after this mount, its loader
    // fires CookiebotOnAccept or CookiebotOnDecline on page load as well, so
    // these two listeners are also the returning visitor's path (see
    // handleConsentChange).
    window.addEventListener('CookiebotOnAccept', handleConsentChange);
    window.addEventListener('CookiebotOnDecline', handleConsentChange);
    window.addEventListener('CookiebotOnDialogInit', recordCookiebotReport);
    return () => {
      window.removeEventListener('CookiebotOnAccept', handleConsentChange);
      window.removeEventListener('CookiebotOnDecline', handleConsentChange);
      window.removeEventListener('CookiebotOnDialogInit', recordCookiebotReport);
    };
  }, []);

  return null;
}
