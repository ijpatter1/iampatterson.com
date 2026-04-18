'use client';

import { useEffect, useState } from 'react';

import { getSessionId } from '@/lib/events/session';

interface StripItem {
  label: string;
  value: string;
}

/**
 * Horizontal ticker strip mounted below the site header. Surfaces the stack
 * the visitor is flowing through right now — session ID, pipeline path,
 * consent state, BI layer, attribution approach. Loops via CSS keyframe.
 */
export function LiveStrip() {
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  const shortId = sessionId ? sessionId.slice(-8) : '········';
  const items: StripItem[] = [
    { label: 'SESSION', value: shortId },
    { label: 'STACK', value: 'GTM → sGTM → BigQuery' },
    { label: 'CONSENT', value: 'analytics:granted ad:denied' },
    { label: 'PIPELINE', value: 'live' },
    { label: 'DASHBOARDS', value: 'Metabase' },
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
