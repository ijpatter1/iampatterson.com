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
  if (events.length === 0) return null;

  const latestEvent = events[0];
  const consent = latestEvent.consent;
  const consentEntries = Object.entries(consent) as [keyof ConsentState, string][];

  const activeRoutes = latestEvent.routing.filter((r) => r.status === 'sent');
  const suppressedRoutes = latestEvent.routing.filter((r) => r.status === 'blocked_consent');

  return (
    <div className="px-4 py-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
        Consent State
      </h3>

      <div className="mt-3 space-y-2">
        {consentEntries.map(([signal, value]) => (
          <div
            key={signal}
            data-consent-row
            className={`rounded-lg border px-3 py-2 ${
              value === 'granted'
                ? 'border-green-200 bg-green-50'
                : 'border-neutral-200 bg-neutral-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-medium text-neutral-700">{signal}</span>
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  value === 'granted'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-neutral-200 text-neutral-500'
                }`}
              >
                {value}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-neutral-500">{CONSENT_DESCRIPTIONS[signal]}</p>
          </div>
        ))}
      </div>

      {/* Active destinations */}
      {activeRoutes.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-green-600">
            Active Destinations
          </h4>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {activeRoutes.map((route, i) => (
              <span
                key={`active-${i}`}
                className="inline-flex items-center rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700"
              >
                {destinationLabel(route.destination)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Suppressed destinations */}
      {suppressedRoutes.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-600">
            Suppressed Destinations
          </h4>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {suppressedRoutes.map((route, i) => (
              <span
                key={`suppressed-${i}`}
                className="inline-flex items-center rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700"
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
