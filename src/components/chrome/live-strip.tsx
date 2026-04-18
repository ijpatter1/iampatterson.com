'use client';

import { useEffect, useState } from 'react';

import { useDataLayerEvents } from '@/hooks/useDataLayerEvents';
import { getSessionId } from '@/lib/events/session';

function consentLabel(events: ReturnType<typeof useDataLayerEvents>['events']): string {
  if (events.length === 0) return 'analytics:pending ad:pending';
  const latest = events[0];
  const analytics = latest.consent.analytics_storage === 'granted' ? 'granted' : 'denied';
  const ad = latest.consent.ad_storage === 'granted' ? 'granted' : 'denied';
  return `analytics:${analytics} ad:${ad}`;
}

/**
 * Horizontal ticker strip mounted below the site header. Surfaces the stack
 * the visitor is flowing through right now — session ID, pipeline path,
 * consent state, BI layer, attribution approach. Loops via CSS keyframe.
 */
export function LiveStrip() {
  const [sessionId, setSessionId] = useState('');
  const { events } = useDataLayerEvents();

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  // Match SessionPulse's 6-char suffix so the two components show the same
  // session identity.
  const shortId = sessionId ? sessionId.slice(-6) : '······';

  const items = [
    { label: 'SESSION', value: shortId },
    { label: 'STACK', value: 'GTM → sGTM → BigQuery' },
    { label: 'CONSENT', value: consentLabel(events) },
    { label: 'PIPELINE', value: 'live' },
    { label: 'DASHBOARDS', value: 'Metabase · Looker' },
    { label: 'ATTRIB', value: 'Shapley · last-click' },
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
