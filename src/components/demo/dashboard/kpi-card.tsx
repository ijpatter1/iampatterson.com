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
    <div className="rounded-lg border border-rule-soft bg-paper-alt p-4">
      <p className="text-sm text-ink-3">{metric.label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{metric.value}</p>
      <p
        className={`mt-1 text-sm font-medium ${
          showGreen ? 'text-emerald-600' : showRed ? 'text-red-600' : 'text-ink-3'
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
