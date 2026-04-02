'use client';

import type { FunnelStep } from '@/lib/demo/dashboard-types';

interface FunnelChartProps {
  steps: FunnelStep[];
}

export function FunnelChart({ steps }: FunnelChartProps) {
  const maxValue = steps[0]?.value ?? 1;

  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const widthPct = (step.value / maxValue) * 100;
        return (
          <div key={step.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-neutral-700">{step.label}</span>
              <span className="font-medium text-neutral-900">
                {step.value.toLocaleString()}
                <span className="ml-1 text-xs text-neutral-500">
                  ({step.percentage.toFixed(1)}%)
                </span>
              </span>
            </div>
            <div className="h-6 w-full rounded bg-neutral-100">
              <div
                className="h-6 rounded bg-neutral-800 transition-all"
                style={{ width: `${widthPct}%`, opacity: 1 - i * 0.15 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
