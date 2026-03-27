'use client';

import { destinationLabel } from '@/lib/events/destination-labels';
import type { PipelineEvent, RoutingResult, ConsentState } from '@/lib/events/pipeline-schema';

function StatusBadge({ status }: { status: RoutingResult['status'] }) {
  const styles = {
    sent: 'bg-green-50 text-green-700',
    blocked_consent: 'bg-amber-50 text-amber-700',
    error: 'bg-red-50 text-red-600',
  };
  const labels = {
    sent: 'sent',
    blocked_consent: 'blocked',
    error: 'error',
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-neutral-100 py-3">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        {title}
      </h4>
      {children}
    </div>
  );
}

function ConsentRow({ signal, value }: { signal: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-xs">
      <span className="font-mono text-neutral-600">{signal}</span>
      <span
        className={`font-medium ${value === 'granted' ? 'text-green-700' : 'text-neutral-400'}`}
      >
        {value}
      </span>
    </div>
  );
}

interface EventDetailProps {
  event: PipelineEvent | null;
  onClose?: () => void;
}

export function EventDetail({ event, onClose }: EventDetailProps) {
  if (!event) return null;

  const consentEntries = Object.entries(event.consent) as [keyof ConsentState, string][];

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="font-mono text-sm font-semibold text-neutral-900">{event.event_name}</h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail panel"
            className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 4l8 8M4 12l8-8" />
            </svg>
          </button>
        )}
      </div>

      <div className="px-4 text-xs text-neutral-500">
        <span>{event.page_path}</span>
        <span className="mx-1.5">·</span>
        <span>
          {new Date(event.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>
      </div>

      <div className="mt-2 px-4">
        <Section title="Data Layer">
          <div className="space-y-1">
            {Object.entries(event.parameters).map(([key, value]) => (
              <div key={key} className="flex items-start justify-between gap-2 text-xs">
                <span className="font-mono text-neutral-600">{key}</span>
                <span className="text-right font-mono text-neutral-900">{String(value)}</span>
              </div>
            ))}
            {Object.keys(event.parameters).length === 0 && (
              <p className="text-xs text-neutral-400">No additional parameters</p>
            )}
          </div>
        </Section>

        <Section title="Consent">
          {consentEntries.map(([signal, value]) => (
            <ConsentRow key={signal} signal={signal} value={value} />
          ))}
        </Section>

        <Section title="Routing">
          <div className="space-y-1.5">
            {event.routing.map((route, i) => (
              <div
                key={`${route.destination}-${i}`}
                data-routing-row
                className="flex items-center justify-between text-xs"
              >
                <span className="font-medium text-neutral-700">
                  {destinationLabel(route.destination)}
                </span>
                <StatusBadge status={route.status} />
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
