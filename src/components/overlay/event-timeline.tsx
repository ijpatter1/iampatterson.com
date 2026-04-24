'use client';

import { memo, useCallback, useEffect } from 'react';

import { destinationLabel } from '@/lib/events/destination-labels';
import type { PipelineEvent, RoutingResult } from '@/lib/events/pipeline-schema';

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

function RoutingBadge({ route }: { route: RoutingResult }) {
  const blocked = route.status === 'blocked_consent';
  const errored = route.status === 'error';
  return (
    <span
      className={`inline-flex items-center border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${
        blocked
          ? 'border-u-rule-soft bg-u-paper-deep text-u-ink-4 line-through'
          : errored
            ? 'border-accent-current/40 bg-u-paper-alt text-accent-current'
            : 'border-accent-current/40 bg-u-paper-alt text-u-ink'
      }`}
    >
      {destinationLabel(route.destination)}
    </span>
  );
}

/**
 * Phase 10b D6 — memoized row. Extracted so the 100-row buffer doesn't
 * re-execute every row's render function when a single new event is
 * prepended. React.memo's shallow-compare short-circuits when
 * `event` (ref), `isSelected`, and `onSelect` all match; `onSelect` is
 * stable via the parent's useCallback, so the typical "new SSE event
 * arrived" render cycle only re-executes the new row + the two rows
 * whose `isSelected` may have flipped (old vs new selection).
 *
 * The `__eventTimelineRowRenderCount__` global counter is the test-only
 * hook that lets D6's memo-pin test verify this claim. When a test sets
 * `globalThis.__eventTimelineRowRenderCount__ = 0` before a render, the
 * counter increments once per `EventTimelineRow` function invocation.
 * In production the global is undefined and the `typeof` check
 * short-circuits, so there's no runtime cost.
 */
declare global {
  var __eventTimelineRowRenderCount__: number | undefined;
}

const EventTimelineRow = memo(function EventTimelineRow({
  event,
  isSelected,
  onSelect,
}: {
  event: PipelineEvent;
  isSelected: boolean;
  onSelect: (event: PipelineEvent) => void;
}) {
  // Test-only render counter (see module-header comment). The useEffect
  // wrapper satisfies the react-hooks/immutability rule by running the
  // mutation as a post-commit side-effect rather than during render.
  // React.memo's short-circuit still prevents this effect from firing on
  // prop-unchanged renders (because memo prevents the component function
  // from running at all, so useEffect also doesn't schedule). Empty
  // dep intentionally omitted — we want the effect to fire on every
  // committed render of this component, not just on mount.
  useEffect(() => {
    if (typeof globalThis.__eventTimelineRowRenderCount__ === 'number') {
      globalThis.__eventTimelineRowRenderCount__++;
    }
  });
  const handleClick = useCallback(() => onSelect(event), [event, onSelect]);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(event);
      }
    },
    [event, onSelect],
  );

  return (
    <li
      role="button"
      tabIndex={0}
      className={`cursor-pointer px-4 py-3 transition-colors hover:bg-u-paper-alt focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-current ${
        isSelected ? 'bg-u-paper-alt ring-1 ring-inset ring-accent-current' : ''
      }`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-u-ink-4">
              {formatTime(event.timestamp)}
            </span>
            <span className="font-mono text-sm text-accent-current">{event.event_name}</span>
          </div>
          <p className="mt-1 font-mono text-[11px] text-u-ink-3">{event.page_path}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {event.routing.map((route, i) => (
          <RoutingBadge key={`${route.destination}-${i}`} route={route} />
        ))}
      </div>
    </li>
  );
});

interface EventTimelineProps {
  events: PipelineEvent[];
  onSelectEvent?: (event: PipelineEvent) => void;
  selectedEventId?: string;
}

export function EventTimeline({ events, onSelectEvent, selectedEventId }: EventTimelineProps) {
  // Stable handler for the memoized row. Without this, a fresh closure
  // per render would break React.memo's shallow prop-compare on
  // `onSelect`, defeating the D6 optimization. `onSelectEvent` comes
  // from the parent via props — we normalize it into a defined callable
  // and memoize against its reference.
  const handleSelect = useCallback(
    (event: PipelineEvent) => {
      onSelectEvent?.(event);
    },
    [onSelectEvent],
  );

  if (events.length === 0) {
    return (
      <div>
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-accent-current">
          Session timeline, streaming
        </div>
        <h3 className="font-display text-2xl font-normal leading-tight text-u-ink">
          Waiting for events.
        </h3>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-u-ink-2">
          Interact with the page, scroll, click, navigate, and each event will appear here with its
          routing destinations.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-accent-current">
        Session timeline · {events.length} event{events.length === 1 ? '' : 's'}
      </div>
      <h3 className="font-display text-2xl font-normal leading-tight text-u-ink">
        Every event, every destination.
      </h3>
      <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-u-ink-2">
        Most recent first. Click any row for the step-by-step journey through the pipeline.
      </p>

      <ul className="mt-6 divide-y divide-u-rule-soft border-y border-u-rule-soft">
        {events.map((event) => (
          <EventTimelineRow
            key={event.pipeline_id}
            event={event}
            isSelected={selectedEventId === event.pipeline_id}
            onSelect={handleSelect}
          />
        ))}
      </ul>
    </div>
  );
}
