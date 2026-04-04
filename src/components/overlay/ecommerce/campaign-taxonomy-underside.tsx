import {
  classifyCampaign,
  extractUtmParams,
  type ClassifiedCampaign,
  type UtmParams,
} from '@/lib/demo/campaign-taxonomy';
import type { PipelineEvent } from '@/lib/events/pipeline-schema';

interface CampaignTaxonomyUndersideProps {
  events: PipelineEvent[];
}

function getSessionUtms(events: PipelineEvent[]): UtmParams {
  for (const event of events) {
    if (event.page_location) {
      const utms = extractUtmParams(event.page_location);
      if (utms.utm_source || utms.utm_campaign) return utms;
    }
  }
  return extractUtmParams(typeof window !== 'undefined' ? window.location.href : '');
}

function UtmRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between border-b border-border-subtle py-2 last:border-0">
      <span className="font-mono text-xs text-content-muted">{label}</span>
      <span className="font-mono text-xs text-content">{value ?? '(not set)'}</span>
    </div>
  );
}

function ClassifiedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border-subtle py-2 last:border-0">
      <span className="text-xs font-medium text-content-muted">{label}</span>
      <span className="text-xs font-semibold text-content">{value}</span>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  return (
    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
      {pct}% confidence
    </span>
  );
}

export function CampaignTaxonomyUnderside({ events }: CampaignTaxonomyUndersideProps) {
  const utms = getSessionUtms(events);
  const classified: ClassifiedCampaign = classifyCampaign(utms);
  const isDirect = classified.platform === 'Direct';

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-content sm:text-2xl">
          Campaign Taxonomy
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-content-secondary">
          {isDirect
            ? 'You arrived via direct traffic — no UTM parameters detected. In production, the taxonomy layer classifies every campaign string that enters the system.'
            : 'The AI-powered taxonomy layer classified the UTM parameters that brought you here into a standardized campaign structure.'}
        </p>
      </div>

      {/* Raw UTM Parameters */}
      <section className="rounded-card border border-border p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-content-muted">
          Raw UTM Parameters
        </h3>
        <div>
          <UtmRow label="utm_source" value={utms.utm_source} />
          <UtmRow label="utm_medium" value={utms.utm_medium} />
          <UtmRow label="utm_campaign" value={utms.utm_campaign} />
          <UtmRow label="utm_term" value={utms.utm_term} />
          <UtmRow label="utm_content" value={utms.utm_content} />
        </div>
      </section>

      {/* Arrow */}
      <div className="flex justify-center">
        <div className="flex flex-col items-center gap-1 text-content-muted">
          <span className="text-xs font-medium">AI.CLASSIFY</span>
          <svg
            width="20"
            height="24"
            viewBox="0 0 20 24"
            fill="none"
            className="text-content-muted"
          >
            <path d="M10 0v20M4 16l6 6 6-6" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
      </div>

      {/* Classified Output */}
      <section className="rounded-card border border-border p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-content-muted">
            Classified Taxonomy
          </h3>
          <ConfidenceBadge confidence={classified.confidence} />
        </div>
        <div>
          <ClassifiedRow label="Platform" value={classified.platform} />
          <ClassifiedRow label="Campaign Type" value={classified.campaignType} />
          <ClassifiedRow label="Audience" value={classified.audience} />
        </div>
      </section>

      {/* Explanation */}
      <section className="rounded-card border border-border bg-surface-alt p-6">
        <h3 className="mb-2 text-sm font-semibold text-content">How It Works</h3>
        <p className="text-xs leading-relaxed text-content-secondary">
          In production, BigQuery&apos;s <strong>AI.CLASSIFY</strong> model processes every incoming
          campaign string. It standardizes inconsistent naming (e.g.,{' '}
          <span className="font-mono">meta_prospecting_lal_q1</span>,{' '}
          <span className="font-mono">FB-Prospect-LAL-Q1</span>,{' '}
          <span className="font-mono">facebook_prosp_lookalike</span>) into a clean taxonomy. A
          rule-based regex fallback handles obvious patterns first, with AI classification catching
          the edge cases. The Dataform model achieves 100% classification across 33+ campaign
          variants in the demo dataset.
        </p>
      </section>
    </div>
  );
}
