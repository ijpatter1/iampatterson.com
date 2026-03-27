'use client';

import type { PipelineEvent, RoutingResult } from '@/lib/events/pipeline-schema';

const DESTINATION_LABELS: Record<string, string> = {
  ga4: 'GA4',
  bigquery: 'BigQuery',
  meta_capi: 'Meta',
  google_ads: 'Google Ads',
  pubsub: 'Pub/Sub',
};

function destinationLabel(dest: string): string {
  return DESTINATION_LABELS[dest] ?? dest;
}

function describeAction(event: PipelineEvent): string {
  const params = event.parameters;
  switch (event.event_name) {
    case 'page_view':
      return `You viewed ${event.page_path}`;
    case 'click_cta':
      return `You clicked "${params.cta_text ?? 'a button'}"`;
    case 'click_nav':
      return `You clicked "${params.link_text ?? 'a link'}"`;
    case 'scroll_depth':
      return `You scrolled to ${params.depth_percentage ?? '?'}%`;
    case 'form_start':
      return `You started the ${params.form_name ?? ''} form`;
    case 'form_submit':
      return `You submitted the ${params.form_name ?? ''} form`;
    case 'form_field_focus':
      return `You focused on ${params.field_name ?? 'a field'}`;
    case 'consent_update':
      return 'You updated your consent preferences';
    default:
      return `Event: ${event.event_name}`;
  }
}

function FlowArrow() {
  return (
    <div data-testid="flow-arrow" className="flex justify-center py-1">
      <svg width="16" height="20" viewBox="0 0 16 20" fill="none" className="text-neutral-300">
        <path d="M8 0v16M4 12l4 4 4-4" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

function StageCard({
  title,
  description,
  variant = 'default',
}: {
  title: string;
  description: string;
  variant?: 'default' | 'action' | 'blocked';
}) {
  const styles = {
    default: 'border-neutral-200 bg-neutral-50',
    action: 'border-blue-200 bg-blue-50',
    blocked: 'border-amber-200 bg-amber-50',
  };
  return (
    <div className={`rounded-lg border px-3 py-2 ${styles[variant]}`}>
      <p className="text-xs font-semibold text-neutral-700">{title}</p>
      <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
    </div>
  );
}

interface NarrativeFlowProps {
  event: PipelineEvent | null;
}

export function NarrativeFlow({ event }: NarrativeFlowProps) {
  if (!event) return null;

  const sentRoutes = event.routing.filter((r) => r.status === 'sent');
  const blockedRoutes = event.routing.filter((r) => r.status === 'blocked_consent');

  return (
    <div className="px-4 py-3">
      {/* Stage 1: User Action */}
      <StageCard title="You" description={describeAction(event)} variant="action" />

      <FlowArrow />

      {/* Stage 2: Data Layer */}
      <StageCard
        title="Data Layer"
        description={`${event.event_name} event pushed with ${Object.keys(event.parameters).length} parameter(s)`}
      />

      <FlowArrow />

      {/* Stage 3: sGTM */}
      <StageCard
        title="sGTM Container"
        description="Server-side Google Tag Manager processed the event and routed it"
      />

      <FlowArrow />

      {/* Stage 4: Destinations */}
      <div className="space-y-1.5">
        {sentRoutes.map((route, i) => (
          <StageCard
            key={`sent-${i}`}
            title={destinationLabel(route.destination)}
            description="Delivered"
          />
        ))}
        {blockedRoutes.map((route, i) => (
          <StageCard
            key={`blocked-${i}`}
            title={destinationLabel(route.destination)}
            description="Blocked by consent — ad tracking not permitted"
            variant="blocked"
          />
        ))}
      </div>
    </div>
  );
}
