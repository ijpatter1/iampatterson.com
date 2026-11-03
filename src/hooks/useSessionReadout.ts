'use client';

import { useSessionState } from '@/components/session-state-provider';
import { useAnalyticsConsent } from '@/hooks/useAnalyticsConsent';
import { useGlobalPrivacyControl } from '@/hooks/useGlobalPrivacyControl';
import { useLiveEvents } from '@/hooks/useLiveEvents';
import { useSessionId } from '@/hooks/useSessionId';

type Reading = 'granted' | 'denied' | 'pending';

export interface SessionReadout {
  /** Last six characters of the session ID, or a placeholder before one exists. */
  shortId: string;
  consent: { analytics: Reading; ad: Reading };
  eventCount: number;
}

/**
 * The session facts the chrome and the homepage both display: the ID suffix,
 * the consent pair and the event count. One hook, so the LiveStrip and the
 * proof panel cannot disagree about the same visitor.
 *
 * The ID and the count prefer the persisted session state, which survives a
 * refresh, and fall back to the live buffer during the brief window before it
 * loads. Consent is read from the persisted session only.
 *
 * Consent reads `pending` until the visitor has answered the banner. The
 * stored snapshot is built from booleans, so an unanswered banner and a
 * decline both read `denied` there; telling a first-time visitor they declined
 * before they chose would be wrong. The exception is advertising consent for
 * a browser sending Global Privacy Control: it is denied by default and the
 * site never grants it for that browser, so it reads `denied` from the start.
 */
export function useSessionReadout(): SessionReadout {
  const sessionId = useSessionId();
  const sessionState = useSessionState();
  const { events } = useLiveEvents();
  const hasChosen = useAnalyticsConsent() !== undefined;
  const gpcEnabled = useGlobalPrivacyControl();

  const effectiveSid = sessionState?.session_id || sessionId;
  const shortId = effectiveSid ? effectiveSid.slice(-6) : '······';

  const eventCount = sessionState
    ? Object.values(sessionState.events_fired).reduce((total, n) => total + (n ?? 0), 0)
    : events.length;

  let consent: SessionReadout['consent'] = { analytics: 'pending', ad: 'pending' };
  if (hasChosen && sessionState) {
    consent = {
      analytics: sessionState.consent_snapshot.analytics,
      ad: sessionState.consent_snapshot.marketing,
    };
  }
  if (gpcEnabled && consent.ad === 'pending') {
    consent = { ...consent, ad: 'denied' };
  }

  return { shortId, consent, eventCount };
}
