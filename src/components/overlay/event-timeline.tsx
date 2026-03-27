'use client';

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
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
        blocked
          ? 'bg-neutral-100 text-neutral-400 line-through'
          : errored
            ? 'bg-red-50 text-red-600'
            : 'bg-green-50 text-green-700'
      }`}
    >
      {destinationLabel(route.destination)}
    </span>
  );
}

interface EventTimelineProps {
  events: PipelineEvent[];
  onSelectEvent?: (event: PipelineEvent) => void;
  selectedEventId?: string;
}

export function EventTimeline({ events, onSelectEvent, selectedEventId }: EventTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-neutral-400">
        <p className="text-sm">No events yet</p>
        <p className="mt-1 text-xs">Interact with the page to see events appear here</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-neutral-100">
      {events.map((event) => {
        const isSelected = selectedEventId === event.pipeline_id;
        return (
          <li
            key={event.pipeline_id}
            role="button"
            tabIndex={0}
            className={`cursor-pointer px-4 py-3 transition-colors hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-neutral-400 ${
              isSelected ? 'bg-neutral-50 ring-1 ring-inset ring-neutral-300' : ''
            }`}
            onClick={() => onSelectEvent?.(event)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectEvent?.(event);
              }
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium text-neutral-900">
                    {event.event_name}
                  </span>
                  <span className="text-xs text-neutral-400">{formatTime(event.timestamp)}</span>
                </div>
                <p className="mt-0.5 text-xs text-neutral-500">{event.page_path}</p>
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {event.routing.map((route, i) => (
                <RoutingBadge key={`${route.destination}-${i}`} route={route} />
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
