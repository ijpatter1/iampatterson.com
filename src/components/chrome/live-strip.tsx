'use client';

import { useSessionState } from '@/components/session-state-provider';
import { useDataLayerEvents } from '@/hooks/useDataLayerEvents';
import { useSessionId } from '@/hooks/useSessionId';
import type { SessionState } from '@/lib/session-state/types';

function consentLabel(
  sessionState: SessionState | null,
  liveEvents: ReturnType<typeof useDataLayerEvents>['events'],
): string {
  // Prefer the persisted SessionState consent_snapshot so the indicator
  // survives a page refresh (user-reported regression: live dataLayer
  // is empty post-reload, so reading `events[0].consent` would always
  // return 'pending' after a refresh even when the visitor's session
  // has real consent state). Falls back to the live data-layer buffer
  // during the brief pre-hydration window.
  if (sessionState) {
    const analytics = sessionState.consent_snapshot.analytics;
    const ad = sessionState.consent_snapshot.marketing;
    return `analytics:${analytics} ad:${ad}`;
  }
  if (liveEvents.length === 0) return 'analytics:pending ad:pending';
  const latest = liveEvents[0];
  const analytics = latest.consent.analytics_storage === 'granted' ? 'granted' : 'denied';
  const ad = latest.consent.ad_storage === 'granted' ? 'granted' : 'denied';
  return `analytics:${analytics} ad:${ad}`;
}

/**
 * Horizontal ticker strip mounted below the site header. Surfaces the stack
 * the visitor is flowing through right now, session ID, pipeline path,
 * consent state, BI layer, attribution approach. Loops via CSS keyframe.
 */
export function LiveStrip() {
  const sessionId = useSessionId();
  const { events } = useDataLayerEvents();
  const sessionState = useSessionState();

  // Match SessionPulse's 6-char suffix so the two components show the same
  // session identity. Prefer the persisted blob's session_id so it stays
  // consistent with the Overview tab + ride-along payload across refresh.
  const persistedSid = sessionState?.session_id ?? '';
  const effectiveSid = persistedSid || sessionId;
  const shortId = effectiveSid ? effectiveSid.slice(-6) : '······';

  const items = [
    { label: 'SESSION', value: shortId },
    { label: 'STACK', value: 'GTM → sGTM → BigQuery' },
    { label: 'CONSENT', value: consentLabel(sessionState, events) },
    { label: 'PIPELINE', value: 'live' },
    { label: 'DASHBOARDS', value: 'Metabase' },
    { label: 'ATTRIB', value: 'last-click · Shapley planned' },
  ];

  // Duplicate items so the translate loop wraps seamlessly at 50%.
  const track = [...items, ...items];

  return (
    <div
      data-testid="live-strip"
      className="overflow-hidden border-y border-rule-soft bg-paper text-ink-3"
    >
      <div className="flex w-max animate-live-strip gap-8 whitespace-nowrap px-6 py-2 font-mono text-[10px] tracking-wide">
        {track.map((it, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="inline-block h-1 w-1 rounded-full bg-accent-current" />
            <span className="font-medium text-accent-current">{it.label}</span>
            <span>{it.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
