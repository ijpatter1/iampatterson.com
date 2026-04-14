'use client';

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { leadGenDashboardData } from '@/lib/demo/dashboard-data';
import { KpiGrid } from '@/components/demo/dashboard/kpi-card';
import { ChartCard } from '@/components/demo/dashboard/chart-card';
import { FunnelChart } from '@/components/demo/dashboard/funnel-chart';
import type { LeadQualityBreakdown } from '@/lib/demo/dashboard-types';

const formatCurrency = (v: number) => `$${v.toLocaleString()}`;
type TooltipValue = number | string | ReadonlyArray<number | string> | undefined;

export function LeadGenDashboard() {
  const data = leadGenDashboardData;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">
          Tuna Brand Partnerships | Analytics Dashboard
        </h2>
        <p className="text-sm text-neutral-500">
          Lead generation metrics from BigQuery mart tables via Dataform
        </p>
      </div>

      <KpiGrid metrics={data.kpis} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Lead Volume Trend" description="Monthly lead submissions over 18 months">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.leadVolumeTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: TooltipValue) => [String(v ?? ''), 'Leads']}
                  labelFormatter={(l) => `Month: ${l}`}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#171717"
                  fill="#171717"
                  fillOpacity={0.08}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Lead Funnel" description="Visitor to qualified lead conversion">
          <FunnelChart steps={data.funnel} />
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Cost per Lead by Channel"
          description="Spend efficiency by acquisition source"
        >
          <CostPerLeadTable data={data.costPerLeadByChannel} />
        </ChartCard>

        <ChartCard title="Lead Quality Distribution" description="Qualified leads by tier">
          <QualityDistribution data={data.qualityDistribution} />
        </ChartCard>
      </div>

      <ChartCard title="Qualified Lead Trend" description="Monthly qualified lead volume">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.conversionTimeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: TooltipValue) => [String(v ?? ''), 'Qualified Leads']}
                labelFormatter={(l) => `Month: ${l}`}
              />
              <Bar dataKey="value" fill="#171717" fillOpacity={0.8} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}

function CostPerLeadTable({
  data,
}: {
  data: { channel: string; costPerLead: number; leads: number; spend: number }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className="pb-2 text-left text-xs font-medium text-neutral-500">Channel</th>
            <th className="pb-2 text-right text-xs font-medium text-neutral-500">Leads</th>
            <th className="pb-2 text-right text-xs font-medium text-neutral-500">Spend</th>
            <th className="pb-2 text-right text-xs font-medium text-neutral-500">CPL</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.channel} className="border-b border-neutral-100">
              <td className="py-2 text-neutral-700">{row.channel}</td>
              <td className="py-2 text-right text-neutral-700">{row.leads}</td>
              <td className="py-2 text-right text-neutral-700">
                {row.spend > 0 ? formatCurrency(row.spend) : '—'}
              </td>
              <td className="py-2 text-right font-medium text-neutral-900">
                {row.costPerLead > 0 ? formatCurrency(row.costPerLead) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QualityDistribution({ data }: { data: LeadQualityBreakdown[] }) {
  return (
    <div className="space-y-3">
      {data.map((tier) => (
        <div key={tier.tier}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-neutral-700">{tier.tier}</span>
            <span className="font-medium text-neutral-900">
              {tier.count}
              <span className="ml-1 text-xs text-neutral-500">({tier.percentage.toFixed(1)}%)</span>
            </span>
          </div>
          <div className="h-4 w-full rounded bg-neutral-100">
            <div className="h-4 rounded bg-neutral-800" style={{ width: `${tier.percentage}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
