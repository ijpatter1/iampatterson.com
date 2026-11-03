'use client';

import { useId } from 'react';

import { useAnalyticsConsent } from '@/hooks/useAnalyticsConsent';
import { useLiveEvents } from '@/hooks/useLiveEvents';
import { useSessionReadout } from '@/hooks/useSessionReadout';
import { PROOF } from '@/lib/content/proof';
import { destinationLabel } from '@/lib/events/destination-labels';
import type { PipelineEvent } from '@/lib/events/pipeline-schema';

const MAX_ROWS = 4;

/**
 * The destinations this site really sends to. Event routing also names two
 * advertising destinations that exist here only as simulated tags; listing
 * them on the homepage, sent or blocked, would read as live integrations.
 */
const REAL_DESTINATIONS: ReadonlySet<string> = new Set(['ga4', 'bigquery', 'pubsub']);

function clockTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--:--';
  return date.toLocaleTimeString('en-GB', { hour12: false });
}

function labels(event: PipelineEvent, status: 'sent' | 'blocked_consent'): string {
  return event.routing
    .filter((r) => r.status === status && REAL_DESTINATIONS.has(r.destination))
    .map((r) => destinationLabel(r.destination))
    .join(', ');
}

/**
 * One event, saying only what is known about it.
 *
 * A stream row came back from the server, so it was forwarded: it shows where
 * the server reported sending it, and its pipeline ID. It never shows a
 * blocked line. The server derives that status from the consent flags, and an
 * event that reached the stream was not blocked.
 *
 * A data-layer row never reached the server. The browser knows for certain
 * what consent blocked, so it shows that, with the reason. It shows no
 * pipeline ID and no "sent", with one exception: the consent update, which is
 * exempt from the gate so that the choice itself is recorded.
 */
function ProofRow({ event, fromStream }: { event: PipelineEvent; fromStream: boolean }) {
  const showSent = fromStream || event.event_name === 'consent_update';
  const sent = showSent ? labels(event, 'sent') : '';
  const blocked = fromStream ? '' : labels(event, 'blocked_consent');

  return (
    <li data-testid="proof-row" className="whitespace-nowrap py-2">
      <div>
        <span data-testid="proof-row-time" className="text-u-ink-3">
          {clockTime(event.timestamp)}
        </span>{' '}
        <span data-testid="proof-row-name" className="text-phosphor">
          {event.event_name}
        </span>
        {fromStream && (
          <>
            {' '}
            <span data-testid="proof-row-id" className="text-u-ink-3">
              {event.pipeline_id.slice(-6)}
            </span>
          </>
        )}
      </div>
      {sent && (
        <div data-testid="proof-row-sent" className="pl-4 text-u-ink-2">
          <span className="text-u-accept">{PROOF.panel.sent}</span> {sent}
        </div>
      )}
      {blocked && (
        <div data-testid="proof-row-blocked" className="pl-4 text-u-ink-2">
          <span className="text-u-deny">{PROOF.panel.blocked}</span> {blocked} ·{' '}
          {PROOF.panel.blockedReason}
        </div>
      )}
    </li>
  );
}

interface ProofPanelProps {
  /** Opens the overlay. The section's button is the keyboard and screen-reader control. */
  onOpen: () => void;
}

/**
 * The homepage's evidence for "this site runs the stack it describes": a
 * preview of the visitor's own events. It shows only what the browser has
 * observed for this visitor. It is a preview, not a second overlay: no tabs,
 * no filters.
 *
 * The panel is a readable region, not a button, so its contents reach
 * assistive technology. A click anywhere on it opens the overlay as a pointer
 * convenience; the "Open the overlay" button beside it is the same action for
 * keyboard and screen-reader users.
 */
export function ProofPanel({ onOpen }: ProofPanelProps) {
  const { events, source, stream } = useLiveEvents();
  const analyticsConsent = useAnalyticsConsent();
  const { shortId, consent, eventCount } = useSessionReadout();

  const fromStream = source === 'sse';
  const hasChosen = analyticsConsent !== undefined;
  // Newest first from the hook; the panel reads oldest at the top.
  const visible = events.slice(0, MAX_ROWS).reverse();

  // A visitor who declined is shown data-layer events by design, so only a
  // visitor who allowed analytics gets a note about the stream. The stream
  // counts as down only when it is off or has given up retrying: a first
  // connection under way, or a routine reconnect (Cloud Run ends each stream
  // after an hour), is not a failure worth announcing. Stream rows stay on
  // screen after the stream gives up, so the note then says they are no
  // longer live.
  const streamDown = stream === 'off' || stream === 'disconnected';
  const streamNote =
    analyticsConsent === 'granted' && visible.length > 0 && streamDown
      ? fromStream
        ? PROOF.panel.streamDropped
        : PROOF.panel.notConnected
      : null;
  const hasRows = hasChosen && visible.length > 0;
  const headerId = useId();

  let body;
  if (!hasChosen) {
    // Wins even though the data layer already holds a page_view: beside
    // "No tag fires until you choose", the gate is the point.
    body = <p className="py-2 text-u-ink-2">{PROOF.panel.notChosen}</p>;
  } else if (visible.length === 0) {
    body = <p className="py-2 text-u-ink-2">{PROOF.panel.waiting}</p>;
  } else {
    body = (
      <ul>
        {visible.map((event) => (
          <ProofRow key={event.pipeline_id} event={event} fromStream={fromStream} />
        ))}
      </ul>
    );
  }

  return (
    <div
      role="group"
      aria-label={PROOF.panel.regionLabel}
      data-testid="proof-panel"
      onClick={onOpen}
      className="cursor-pointer rounded-sm bg-u-paper p-5 font-mono text-xs leading-relaxed text-u-ink"
    >
      <div
        id={headerId}
        data-testid="proof-header"
        className="flex flex-wrap gap-x-4 gap-y-1 border-b border-u-rule pb-3 text-[10px] uppercase tracking-[0.14em] text-u-ink-3"
      >
        <span>
          {PROOF.panel.sessionLabel} {shortId}
        </span>
        <span>
          {PROOF.panel.consentLabel} analytics:{consent.analytics} · ad:{consent.ad}
        </span>
        <span>
          {eventCount} {eventCount === 1 ? PROOF.panel.eventSingular : PROOF.panel.eventPlural}
        </span>
      </div>
      {streamNote && <p className="border-b border-u-rule-soft py-2 text-u-ink-3">{streamNote}</p>}
      <div
        data-testid="proof-rows"
        role="region"
        tabIndex={hasRows ? 0 : undefined}
        aria-labelledby={headerId}
        className="overflow-x-auto pt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-current"
      >
        {body}
      </div>
    </div>
  );
}
