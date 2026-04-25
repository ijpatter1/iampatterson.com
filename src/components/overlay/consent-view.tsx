'use client';

import { destinationLabel } from '@/lib/events/destination-labels';
import type { PipelineEvent, ConsentState } from '@/lib/events/pipeline-schema';

const CONSENT_DESCRIPTIONS: Record<keyof ConsentState, string> = {
  analytics_storage: 'Analytics cookies and data collection',
  ad_storage: 'Advertising cookies for ad targeting',
  ad_user_data: 'User data sent to advertising platforms',
  ad_personalization: 'Personalized advertising',
  functionality_storage: 'Preference and functionality cookies',
};

interface ConsentViewProps {
  events: PipelineEvent[];
}

export function ConsentView({ events }: ConsentViewProps) {
  if (events.length === 0) {
    return (
      <div className="space-y-4">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-accent-current">
          Consent enforcement, live
        </div>
        <h3 className="font-display text-2xl font-normal leading-tight text-u-ink">
          What happens when you <em className="text-accent-current">deny</em> consent.
        </h3>
        <p className="max-w-[62ch] text-sm leading-relaxed text-u-ink-2">
          In server-side GTM, consent state determines tag firing. Interact with the page to
          populate the timeline, we&apos;ll show your live consent decisions here. To withdraw or
          change consent, use the Cookiebot dialog via the badge in the bottom-left corner of the
          page.
        </p>
      </div>
    );
  }

  const latestEvent = events[0];
  const consent = latestEvent.consent;
  const consentEntries = Object.entries(consent) as [keyof ConsentState, string][];

  const activeRoutes = latestEvent.routing.filter((r) => r.status === 'sent');
  const suppressedRoutes = latestEvent.routing.filter((r) => r.status === 'blocked_consent');

  return (
    <div>
      <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-accent-current">
        Consent enforcement, live
      </div>
      <h3 className="font-display text-2xl font-normal leading-tight text-u-ink">
        What happens when you <em className="text-accent-current">deny</em> consent.
      </h3>
      <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-u-ink-2">
        In server-side GTM, consent state determines tag firing. Here&apos;s what&apos;s firing and
        what&apos;s blocked for your session right now. To withdraw or change consent, use the
        Cookiebot dialog via the badge in the bottom-left corner of the page.
      </p>

      {/* Phase 10d D8.j: red/green accents replace the persimmon + muted
          grey binary. Granted rows pick up `u-accept` (green) on the left
          border + status tag; denied rows pick up `u-deny` (red). Each
          status tag is prefixed with a `✓`/`×` glyph so colour-blind
          readers still parse the state. */}
      <div className="mt-8 space-y-3">
        {consentEntries.map(([signal, value]) => {
          const granted = value === 'granted';
          return (
            <div
              key={signal}
              data-consent-row
              data-consent-state={granted ? 'granted' : 'denied'}
              className={`flex items-start justify-between gap-4 border-l-2 px-4 py-3 ${
                granted ? 'border-u-accept bg-u-paper-alt' : 'border-u-deny bg-u-paper-deep'
              }`}
            >
              <div className="flex-1">
                <div className="font-mono text-[11px] text-u-ink">{signal}</div>
                <p className="mt-1 text-xs text-u-ink-3">{CONSENT_DESCRIPTIONS[signal]}</p>
              </div>
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
        })}
      </div>

      {/* Active destinations — firing, green accent */}
      {activeRoutes.length > 0 && (
        <div className="mt-8">
          <h4 className="font-mono text-[10px] uppercase tracking-widest text-u-accept">
            Firing destinations
          </h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeRoutes.map((route, i) => (
              <span
                key={`active-${i}`}
                data-destination-state="firing"
                className="flex items-center gap-2 border border-u-accept/40 bg-u-paper-alt px-3 py-1.5 font-mono text-[11px] text-u-ink"
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-1.5 w-1.5 rounded-full bg-u-accept"
                />
                {destinationLabel(route.destination)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Suppressed destinations — blocked, red accent */}
      {suppressedRoutes.length > 0 && (
        <div className="mt-6">
          <h4 className="font-mono text-[10px] uppercase tracking-widest text-u-deny">
            Blocked destinations
          </h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {suppressedRoutes.map((route, i) => (
              <span
                key={`suppressed-${i}`}
                data-destination-state="blocked"
                className="flex items-center gap-2 border border-u-deny/40 bg-u-paper-deep px-3 py-1.5 font-mono text-[11px] text-u-deny line-through"
              >
                <span aria-hidden="true" className="no-underline">
                  ×
                </span>
                {destinationLabel(route.destination)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
