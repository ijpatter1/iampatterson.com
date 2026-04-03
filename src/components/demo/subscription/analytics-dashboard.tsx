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

import { subscriptionDashboardData } from '@/lib/demo/dashboard-data';
import { KpiGrid } from '@/components/demo/dashboard/kpi-card';
import { ChartCard } from '@/components/demo/dashboard/chart-card';
import { DataTable } from '@/components/demo/dashboard/data-table';
import type { ChannelBreakdown } from '@/lib/demo/dashboard-types';

const formatCurrency = (v: number) => `$${v.toLocaleString()}`;
const formatPct = (v: number) => `${v.toFixed(1)}%`;
const tooltipFmt =
  (label: string) => (v: number | string | ReadonlyArray<number | string> | undefined) =>
    [typeof v === 'number' ? formatCurrency(v) : String(v ?? ''), label] as [string, string];

const trialConversionColumns = [
  { key: 'channel', label: 'Channel' },
  {
    key: 'conversions',
    label: 'Paid Conversions',
    align: 'right' as const,
    render: (r: ChannelBreakdown) => r.conversions.toLocaleString(),
  },
  {
    key: 'conversionRate',
    label: 'Trial → Paid',
    align: 'right' as const,
    render: (r: ChannelBreakdown) => formatPct(r.conversionRate),
  },
  {
    key: 'revenue',
    label: 'Revenue',
    align: 'right' as const,
    render: (r: ChannelBreakdown) => formatCurrency(r.revenue),
  },
  {
    key: 'costPerAcquisition',
    label: 'CPA',
    align: 'right' as const,
    render: (r: ChannelBreakdown) =>
      r.costPerAcquisition > 0 ? formatCurrency(r.costPerAcquisition) : '—',
  },
];

export function SubscriptionDashboard() {
  const data = subscriptionDashboardData;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">
          Tuna Subscription Box — Analytics Dashboard
        </h2>
        <p className="text-sm text-neutral-500">
          Subscription metrics from BigQuery mart tables via Dataform
        </p>
      </div>

      <KpiGrid metrics={data.kpis} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="MRR Trend" description="Monthly recurring revenue over 18 months">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.mrrTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip formatter={tooltipFmt('MRR')} labelFormatter={(l) => `Month: ${l}`} />
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

        <ChartCard title="Churn Reasons" description="Self-reported churn reasons">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.churnBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="reason" tick={{ fontSize: 11 }} width={130} />
                <Tooltip
                  formatter={(v: number | string | ReadonlyArray<number | string> | undefined) =>
                    [`${v ?? 0} subscribers`, 'Count'] as [string, string]
                  }
                />
                <Bar dataKey="count" fill="#171717" fillOpacity={0.8} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Cohort Retention" description="Monthly cohort retention rates (%)">
        <CohortRetentionTable cohorts={data.cohortRetention} />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Trial-to-Paid by Channel"
          description="Conversion rates by acquisition source"
        >
          <DataTable<ChannelBreakdown>
            columns={trialConversionColumns}
            rows={data.trialConversionByChannel}
            keyField="channel"
          />
        </ChartCard>

        <ChartCard
          title="LTV by Acquisition Source"
          description="Average lifetime value by channel"
        >
          <LtvTable data={data.ltvBySource} />
        </ChartCard>
      </div>
    </div>
  );
}

// Cohort retention heatmap-style table
function CohortRetentionTable({
  cohorts,
}: {
  cohorts: { cohortMonth: string; signups: number; retentionByMonth: number[] }[];
}) {
  const maxMonths = Math.max(...cohorts.map((c) => c.retentionByMonth.length));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className="pb-2 text-left text-xs font-medium text-neutral-500">Cohort</th>
            <th className="pb-2 text-right text-xs font-medium text-neutral-500">Signups</th>
            {Array.from({ length: maxMonths }, (_, i) => (
              <th key={i} className="pb-2 text-center text-xs font-medium text-neutral-500">
                M{i}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((cohort) => (
            <tr key={cohort.cohortMonth} className="border-b border-neutral-100">
              <td className="py-1.5 text-neutral-700">{cohort.cohortMonth}</td>
              <td className="py-1.5 text-right text-neutral-700">{cohort.signups}</td>
              {Array.from({ length: maxMonths }, (_, i) => {
                const val = cohort.retentionByMonth[i];
                if (val === undefined) {
                  return (
                    <td key={i} className="py-1.5 text-center text-neutral-300">
                      —
                    </td>
                  );
                }
                const intensity = val / 100;
                return (
                  <td
                    key={i}
                    className="py-1.5 text-center text-xs font-medium"
                    style={{
                      backgroundColor: `rgba(23, 23, 23, ${intensity * 0.25})`,
                      color: intensity > 0.5 ? '#171717' : '#737373',
                    }}
                  >
                    {val}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LtvTable({ data }: { data: { source: string; avgLtv: number; customers: number }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className="pb-2 text-left text-xs font-medium text-neutral-500">Source</th>
            <th className="pb-2 text-right text-xs font-medium text-neutral-500">Avg LTV</th>
            <th className="pb-2 text-right text-xs font-medium text-neutral-500">Customers</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.source} className="border-b border-neutral-100">
              <td className="py-2 text-neutral-700">{row.source}</td>
              <td className="py-2 text-right font-medium text-neutral-900">
                ${row.avgLtv.toFixed(2)}
              </td>
              <td className="py-2 text-right text-neutral-700">{row.customers}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
