'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const demoDashboards = [
  {
    n: '01',
    label: 'E-Commerce Dashboard',
    href: '/demo/ecommerce/analytics',
    description: 'Revenue, AOV, channel attribution, product performance, campaign ROAS.',
    matchPrefix: '/demo/ecommerce',
  },
  {
    n: '02',
    label: 'Subscription Dashboard',
    href: '/demo/subscription/analytics',
    description: 'MRR, cohort retention, churn analysis, trial-to-paid conversion, LTV.',
    matchPrefix: '/demo/subscription',
  },
  {
    n: '03',
    label: 'Lead Gen Dashboard',
    href: '/demo/leadgen/analytics',
    description: 'Lead funnel, cost per lead, quality distribution, conversion trends.',
    matchPrefix: '/demo/leadgen',
  },
];

const METABASE_URL = 'https://bi.iampatterson.com/';

// Phase 9B deliverable 6b — the three embeddable cards (funnel, AOV,
// daily revenue) render inline on the confirmation page. The three
// non-embeddable cards live here behind IAP, reachable from the overlay
// Dashboards tab only when the visitor is on the confirmation route.
const CONFIRMATION_EXTRAS = [
  {
    id: 42,
    label: 'ROAS by campaign',
    description: 'Grouped spend vs. revenue bars per campaign with AI-classified taxonomy labels.',
  },
  {
    id: 43,
    label: 'Revenue share by channel',
    description: 'Donut of attributed revenue by channel for the most recent month.',
  },
  {
    id: 44,
    label: 'Customer LTV distribution',
    description: 'Histogram of per-customer total revenue with channel overlay.',
  },
];
const CONFIRMATION_ROUTE = '/demo/ecommerce/confirmation';

export function DashboardView() {
  const pathname = usePathname() ?? '/';

  return (
    <div>
      <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-accent-current">
        BI layer · Metabase on BigQuery marts
      </div>
      <h3 className="font-display text-2xl font-normal leading-tight text-u-ink">
        The mart tables are already modeled.
        <br />
        The <em className="text-accent-current">dashboards</em> are already live.
      </h3>
      <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-u-ink-2">
        Tier 3 turns raw events into answers. Every query you&apos;d ask of your marketing data is
        already modeled in Dataform, indexed, and queryable from the same BigQuery warehouse that
        powers the demo dashboards below.
      </p>

      <div className="mt-8">
        <h4 className="font-mono text-[10px] uppercase tracking-widest text-u-ink-3">
          Demo dashboards · live on mart tables
        </h4>
        <div className="mt-3 space-y-2">
          {demoDashboards.map((d) => {
            const isActive = pathname.startsWith(d.matchPrefix);
            return (
              <Link
                key={d.href}
                href={d.href}
                className={`flex items-baseline gap-4 border-l-2 px-4 py-3 transition-colors hover:border-accent-current hover:bg-u-paper-alt ${
                  isActive
                    ? 'border-accent-current bg-u-paper-alt'
                    : 'border-u-rule-soft bg-u-paper-alt/60'
                }`}
              >
                <span className="font-mono text-[10px] tracking-widest text-u-ink-3">
                  DASHBOARD · {d.n}
                </span>
                <span className="flex-1">
                  <span className="block font-display text-base text-u-ink">{d.label}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-u-ink-2">
                    {d.description}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="font-mono text-[10px] uppercase tracking-widest text-u-ink-4"
                >
                  →
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-8 border border-u-rule-soft bg-u-paper-alt p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h4 className="font-mono text-[10px] uppercase tracking-widest text-accent-current">
            Live Metabase · bi.iampatterson.com
          </h4>
          <a
            href={METABASE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] uppercase tracking-widest text-u-ink-3 transition-colors hover:text-accent-current"
          >
            Open →
          </a>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-u-ink-2">
          The production BI layer runs on self-hosted Metabase on Cloud Run, gated by Google IAP,
          connected to the <span className="font-mono text-u-ink">iampatterson_marts</span> dataset
          — dashboards as code via YAML specs + idempotent apply. Accessing it requires an IAP
          allowlist; reach out if you want a guided walkthrough.
        </p>
      </div>

      {pathname === CONFIRMATION_ROUTE && (
        <div className="mt-8 border-t border-u-rule-soft pt-8">
          <h4 className="font-mono text-[10px] uppercase tracking-widest text-accent-current">
            Three more reports behind IAP
          </h4>
          <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-u-ink-2">
            The three inline embeds on the page above are the anonymous-visitor view. The full
            E-Commerce Executive dashboard has three additional questions that require an IAP
            allowlist.
          </p>
          <div className="mt-4 space-y-2">
            {CONFIRMATION_EXTRAS.map((q) => (
              <a
                key={q.id}
                href={`https://bi.iampatterson.com/question/${q.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-baseline gap-4 border-l-2 border-u-rule-soft bg-u-paper-alt/60 px-4 py-3 transition-colors hover:border-accent-current hover:bg-u-paper-alt"
              >
                <span className="font-mono text-[10px] tracking-widest text-u-ink-3">
                  Q · {String(q.id).padStart(2, '0')}
                </span>
                <span className="flex-1">
                  <span className="block font-display text-base text-u-ink">{q.label}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-u-ink-2">
                    {q.description}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="font-mono text-[10px] uppercase tracking-widest text-u-ink-4"
                >
                  ↗
                </span>
              </a>
            ))}
          </div>
          <a
            href="https://bi.iampatterson.com/dashboard/2"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block font-mono text-[10px] uppercase tracking-widest text-accent-current hover:underline"
          >
            See the full dashboard →
          </a>
        </div>
      )}
    </div>
  );
}
