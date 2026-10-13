'use client';

import { useGlobalPrivacyControl } from '@/hooks/useGlobalPrivacyControl';
import { useLiveEvents } from '@/hooks/useLiveEvents';
import { useSessionReadout } from '@/hooks/useSessionReadout';
import { LIVE_STRIP } from '@/lib/content/proof';

/**
 * Horizontal ticker strip mounted below the site header. Surfaces the stack
 * the visitor is flowing through right now: session ID, pipeline path, consent
 * state, the newest event's pipeline ID and the warehouse table. Loops via CSS
 * keyframe.
 */
export function LiveStrip() {
  const { shortId, consent } = useSessionReadout();
  const { events, source } = useLiveEvents();
  const gpcEnabled = useGlobalPrivacyControl();

  const consentLabel = `analytics:${consent.analytics} ad:${consent.ad}`;

  // The ID the server container assigned on receipt. Shown only for an event
  // that came back over the stream: a data-layer event's local ID is not a
  // pipeline ID, and neither is a deduplication key.
  const latestStreamId = source === 'sse' && events.length > 0 ? events[0].pipeline_id : '';
  const eventId = latestStreamId ? latestStreamId.slice(-6) : LIVE_STRIP.eventIdEmpty;

  const items = [
    { label: 'SESSION', value: shortId },
    { label: 'STACK', value: LIVE_STRIP.stack },
    // A visitor who sent Global Privacy Control sees here, on every page and
    // without opening the overlay, that the site honored it. "Honored" is a
    // claim about the consent applied, so it is made only while advertising
    // consent reads denied.
    {
      label: 'CONSENT',
      value:
        gpcEnabled && consent.ad === 'denied'
          ? `${consentLabel} · ${LIVE_STRIP.gpcHonored}`
          : consentLabel,
    },
    { label: 'EVENT_ID', value: `${eventId} · ${LIVE_STRIP.eventIdLabel}` },
    { label: 'WAREHOUSE', value: LIVE_STRIP.warehouse },
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
