'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const dashboards = [
  {
    label: 'E-Commerce Dashboard',
    href: '/demo/ecommerce/analytics',
    description: 'Revenue, AOV, channel attribution, product performance, campaign ROAS',
    matchPrefix: '/demo/ecommerce',
  },
  {
    label: 'Subscription Dashboard',
    href: '/demo/subscription/analytics',
    description: 'MRR, cohort retention, churn analysis, trial-to-paid conversion, LTV',
    matchPrefix: '/demo/subscription',
  },
  {
    label: 'Lead Gen Dashboard',
    href: '/demo/leadgen/analytics',
    description: 'Lead funnel, cost per lead, quality distribution, conversion trends',
    matchPrefix: '/demo/leadgen',
  },
];

export function DashboardView() {
  const pathname = usePathname();

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-neutral-900">Dashboards</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Built on BigQuery mart tables via Dataform. Navigate from live event data to aggregated
        business metrics.
      </p>
      <div className="mt-4 space-y-3">
        {dashboards.map((d) => {
          const isActive = pathname.startsWith(d.matchPrefix);
          return (
            <Link
              key={d.href}
              href={d.href}
              className={`block rounded-lg border p-3 transition-colors hover:border-neutral-400 ${
                isActive ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 bg-neutral-50'
              }`}
            >
              <span className="text-sm font-medium text-neutral-900">{d.label}</span>
              <span className="mt-0.5 block text-xs text-neutral-500">{d.description}</span>
            </Link>
          );
        })}
      </div>
      <div className="mt-4 rounded-lg border border-neutral-100 bg-neutral-50 p-3">
        <p className="text-xs text-neutral-500">
          Data flows through the same pipeline you see in the Timeline tab — from the browser data
          layer through sGTM into BigQuery, then transformed by Dataform into the mart tables that
          power these dashboards.
        </p>
      </div>
    </div>
  );
}
