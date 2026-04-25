'use client';

import { destinationLabel } from '@/lib/events/destination-labels';
import type { PipelineEvent, RoutingResult, ConsentState } from '@/lib/events/pipeline-schema';

function StatusBadge({ status }: { status: RoutingResult['status'] }) {
  // Phase 10d D8.j Pass-1 fix: the routing badges inside EventDetail are the
  // Timeline-tab counterpart to the Consent tab's destination pills. Same
  // `u-accept`/`u-deny` semantics applied so clicking into an event row
  // doesn't lose the green/red accent the rest of D8.j carries. `sent`
  // picks up `u-accept`; `blocked_consent` picks up `u-deny` + strike;
  // `error` stays on persimmon (distinct failure mode).
  const tone = {
    sent: 'border-u-accept/40 text-u-accept',
    blocked_consent: 'border-u-deny/40 text-u-deny line-through',
    error: 'border-accent-current/60 text-accent-current',
  }[status];
  const labels = {
    sent: 'sent',
    blocked_consent: 'blocked',
    error: 'error',
  };
  return (
    <span
      data-routing-state={status}
      className={`inline-flex items-center border bg-u-paper-deep px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${tone}`}
    >
      {labels[status]}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-u-rule-soft py-4">
      <h4 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-accent-current">
        {title}
      </h4>
      {children}
    </div>
  );
}

function ConsentRow({ signal, value }: { signal: string; value: string }) {
  const granted = value === 'granted';
  // Phase 10d D8.j Pass-1 fix: same recolour the Overview tab and Consent
  // tab already carry. Persimmon → green for granted, muted grey → red for
  // denied, with ✓/× glyph for colour-blind redundancy.
  return (
    <div
      data-consent-row
      data-consent-state={granted ? 'granted' : 'denied'}
      className="flex items-center justify-between py-1 text-xs"
    >
      <span className="font-mono text-u-ink-2">{signal}</span>
      <span
        className={`flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest ${
          granted ? 'text-u-accept' : 'text-u-deny'
        }`}
      >
        <span aria-hidden="true">{granted ? '✓' : '×'}</span>
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
    <div className="border border-u-rule-soft bg-u-paper-alt">
      <div className="flex items-center justify-between px-5 py-4">
        <h3 className="font-mono text-sm text-accent-current">{event.event_name}</h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail panel"
            className="rounded-sm p-1 text-u-ink-3 transition-colors hover:bg-u-paper-deep hover:text-u-ink"
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

      <div className="px-5 font-mono text-[11px] text-u-ink-3">
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

      <div className="mt-3 px-5 pb-4">
        <Section title="Data Layer">
          <div className="space-y-1">
            {Object.entries(event.parameters).map(([key, value]) => (
              <div key={key} className="flex items-start justify-between gap-2 text-xs">
                <span className="font-mono text-u-ink-2">{key}</span>
                <span className="text-right font-mono text-u-ink">{String(value)}</span>
              </div>
            ))}
            {Object.keys(event.parameters).length === 0 && (
              <p className="font-mono text-[11px] text-u-ink-3">No additional parameters</p>
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
                <span className="font-mono text-u-ink-2">
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
