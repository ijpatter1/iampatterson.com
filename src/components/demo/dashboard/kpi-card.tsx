'use client';

import type { KpiMetric } from '@/lib/demo/dashboard-types';

interface KpiCardProps {
  metric: KpiMetric;
}

export function KpiCard({ metric }: KpiCardProps) {
  const isPositive = metric.change > 0;
  const isNegative = metric.change < 0;
  // For churn, negative change is good
  const isChurnMetric = metric.label.toLowerCase().includes('churn');
  const showGreen = isChurnMetric ? isNegative : isPositive;
  const showRed = isChurnMetric ? isPositive : isNegative;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-sm text-neutral-500">{metric.label}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-900">{metric.value}</p>
      <p
        className={`mt-1 text-sm font-medium ${
          showGreen ? 'text-emerald-600' : showRed ? 'text-red-600' : 'text-neutral-500'
        }`}
      >
        {isPositive ? '+' : ''}
        {metric.change}% vs prior period
      </p>
    </div>
  );
}

interface KpiGridProps {
  metrics: KpiMetric[];
}

export function KpiGrid({ metrics }: KpiGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {metrics.map((metric) => (
        <KpiCard key={metric.label} metric={metric} />
      ))}
    </div>
  );
}
