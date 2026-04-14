import type { PipelineEvent } from '@/lib/events/pipeline-schema';

interface Tier3UndersideProps {
  events: PipelineEvent[];
}

interface FunnelStep {
  label: string;
  value: string;
  rate: string;
}

const FUNNEL_STEPS: FunnelStep[] = [
  { label: 'Product Views', value: '12,847', rate: '100%' },
  { label: 'Add to Cart', value: '4,219', rate: '32.8%' },
  { label: 'Begin Checkout', value: '2,106', rate: '49.9%' },
  { label: 'Purchase', value: '1,758', rate: '83.4%' },
];

interface KpiCard {
  label: string;
  value: string;
  change: string;
  positive: boolean;
}

const KPIS: KpiCard[] = [
  { label: 'Conversion Rate', value: '3.2%', change: '+0.4%', positive: true },
  { label: 'Average Order Value', value: '$47.80', change: '+$3.20', positive: true },
  { label: 'Revenue (30d)', value: '$84,010', change: '+12%', positive: true },
  { label: 'Cart Abandonment', value: '50.1%', change: '-2.3%', positive: true },
];

function FunnelBar({ step, maxWidth }: { step: FunnelStep; maxWidth: number }) {
  const pct = parseFloat(step.rate);
  const width = (pct / 100) * maxWidth;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 text-right text-xs text-content-secondary">{step.label}</div>
      <div className="flex-1">
        <div className="h-6 rounded-sm bg-neutral-200" style={{ width: `${width}%` }}>
          <div className="flex h-full items-center px-2">
            <span className="text-xs font-medium text-content">{step.value}</span>
          </div>
        </div>
      </div>
      <div className="w-12 text-right font-mono text-xs text-content-muted">{step.rate}</div>
    </div>
  );
}

export function Tier3Underside({ events }: Tier3UndersideProps) {
  const purchaseEvent = events.find((e) => e.event_name === 'purchase');

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-content sm:text-2xl">
          Business Intelligence
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-content-secondary">
          {purchaseEvent
            ? "You've completed the full funnel. Here's what 18 months of this data looks like when it's properly instrumented and dashboarded."
            : "Here's what the data you're generating looks like at scale — 18 months of e-commerce activity, structured and analyzed."}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((kpi) => (
          <div key={kpi.label} className="rounded-card border border-border p-4">
            <p className="text-xs text-content-muted">{kpi.label}</p>
            <p className="mt-1 text-xl font-bold text-content">{kpi.value}</p>
            <p
              className={`mt-0.5 text-xs font-medium ${
                kpi.positive ? 'text-green-700' : 'text-red-600'
              }`}
            >
              {kpi.change} vs. prior period
            </p>
          </div>
        ))}
      </div>

      {/* Funnel */}
      <section className="rounded-card border border-border p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-content-muted">
          Conversion Funnel (30 days)
        </h3>
        <div className="space-y-2">
          {FUNNEL_STEPS.map((step) => (
            <FunnelBar key={step.label} step={step} maxWidth={100} />
          ))}
        </div>
      </section>

      {/* Actionable Insight */}
      <section className="rounded-card border-2 border-black p-6">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-content">
          Actionable Insight
        </h3>
        <p className="text-sm leading-relaxed text-content-secondary">
          Your checkout completion rate is <strong className="text-content">83.4%</strong> —
          visitors who see related products on the detail page convert at{' '}
          <strong className="text-content">2.3x</strong> the rate of those who don&apos;t. The
          cart-to-checkout drop-off is the biggest leak: reducing it by 5% would add an estimated{' '}
          <strong className="text-content">$14k in monthly revenue</strong>. The data shows Meta
          prospecting drives the highest volume but Google branded search produces the lowest CPA at
          $8.40.
        </p>
      </section>

      {/* Source */}
      <section className="rounded-card border border-border bg-surface-alt p-6">
        <h3 className="mb-2 text-sm font-semibold text-content">Where This Comes From</h3>
        <p className="text-xs leading-relaxed text-content-secondary">
          These metrics are computed from the Dataform mart tables:{' '}
          <span className="font-mono">mart_campaign_performance</span>,{' '}
          <span className="font-mono">mart_session_events</span>, and{' '}
          <span className="font-mono">mart_customer_ltv</span>. In production, dashboards in Looker
          Studio or Metabase connect directly to these tables and refresh automatically. The insight
          is generated by analyzing conversion rates segmented by user journey attributes.
        </p>
      </section>
    </div>
  );
}
