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
          populate the timeline, we&apos;ll show your live consent decisions here.
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
        In server-side GTM, consent state determines tag firing. Here&apos;s what&apos;s active and
        what&apos;s suppressed for your session right now.
      </p>

      <div className="mt-8 space-y-3">
        {consentEntries.map(([signal, value]) => {
          const granted = value === 'granted';
          return (
            <div
              key={signal}
              data-consent-row
              className={`flex items-start justify-between gap-4 border-l-2 px-4 py-3 ${
                granted
                  ? 'border-accent-current bg-u-paper-alt'
                  : 'border-u-rule-soft bg-u-paper-deep'
              }`}
            >
              <div className="flex-1">
                <div className="font-mono text-[11px] text-u-ink">{signal}</div>
                <p className="mt-1 text-xs text-u-ink-3">{CONSENT_DESCRIPTIONS[signal]}</p>
              </div>
              <span
                className={`font-mono text-[10px] uppercase tracking-widest ${
                  granted ? 'text-accent-current' : 'text-u-ink-4'
                }`}
              >
                {value}
              </span>
            </div>
          );
        })}
      </div>

      {/* Active destinations */}
      {activeRoutes.length > 0 && (
        <div className="mt-8">
          <h4 className="font-mono text-[10px] uppercase tracking-widest text-accent-current">
            Active destinations
          </h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeRoutes.map((route, i) => (
              <span
                key={`active-${i}`}
                className="flex items-center gap-2 border border-accent-current/40 bg-u-paper-alt px-3 py-1.5 font-mono text-[11px] text-u-ink"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-current" />
                {destinationLabel(route.destination)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Suppressed destinations */}
      {suppressedRoutes.length > 0 && (
        <div className="mt-6">
          <h4 className="font-mono text-[10px] uppercase tracking-widest text-u-ink-3">
            Suppressed destinations
          </h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {suppressedRoutes.map((route, i) => (
              <span
                key={`suppressed-${i}`}
                className="flex items-center gap-2 border border-u-rule-soft bg-u-paper-deep px-3 py-1.5 font-mono text-[11px] text-u-ink-3 line-through"
              >
                {destinationLabel(route.destination)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
