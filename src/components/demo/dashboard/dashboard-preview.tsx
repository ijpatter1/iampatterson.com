'use client';

import Link from 'next/link';

import type { KpiMetric } from '@/lib/demo/dashboard-types';

import { KpiCard } from './kpi-card';

interface DashboardPreviewProps {
  kpis: KpiMetric[];
  narrative: string;
  analyticsHref: string;
}

export function DashboardPreview({ kpis, narrative, analyticsHref }: DashboardPreviewProps) {
  return (
    <section className="mt-16 rounded-card border border-border bg-surface-alt p-8">
      <h3 className="font-display text-lg font-semibold text-content">
        What this data shows at scale
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-content-secondary">{narrative}</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {kpis.slice(0, 3).map((metric) => (
          <KpiCard key={metric.label} metric={metric} />
        ))}
      </div>

      <div className="mt-6">
        <Link
          href={analyticsHref}
          className="text-sm font-medium text-brand-500 underline underline-offset-4 transition-colors hover:text-brand-700"
        >
          View full dashboard →
        </Link>
      </div>
    </section>
  );
}
