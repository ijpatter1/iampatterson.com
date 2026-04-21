'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { ecommerceDashboardData } from '@/lib/demo/dashboard-data';
import { KpiGrid } from '@/components/demo/dashboard/kpi-card';
import { ChartCard } from '@/components/demo/dashboard/chart-card';
import { FunnelChart } from '@/components/demo/dashboard/funnel-chart';
import { DataTable } from '@/components/demo/dashboard/data-table';
import type {
  ChannelBreakdown,
  ProductPerformance,
  CampaignPerformanceRow,
} from '@/lib/demo/dashboard-types';

const formatCurrency = (v: number) => `$${v.toLocaleString()}`;
const formatPct = (v: number) => `${v.toFixed(1)}%`;
const tooltipFmt =
  (label: string) => (v: number | string | ReadonlyArray<number | string> | undefined) =>
    [typeof v === 'number' ? formatCurrency(v) : String(v ?? ''), label] as [string, string];

const channelColumns = [
  { key: 'channel', label: 'Channel' },
  {
    key: 'sessions',
    label: 'Sessions',
    align: 'right' as const,
    render: (r: ChannelBreakdown) => r.sessions.toLocaleString(),
  },
  {
    key: 'conversions',
    label: 'Conversions',
    align: 'right' as const,
    render: (r: ChannelBreakdown) => r.conversions.toLocaleString(),
  },
  {
    key: 'revenue',
    label: 'Revenue',
    align: 'right' as const,
    render: (r: ChannelBreakdown) => formatCurrency(r.revenue),
  },
  {
    key: 'conversionRate',
    label: 'Conv. Rate',
    align: 'right' as const,
    render: (r: ChannelBreakdown) => formatPct(r.conversionRate),
  },
  {
    key: 'roas',
    label: 'ROAS',
    align: 'right' as const,
    render: (r: ChannelBreakdown) => (r.roas > 0 ? `${r.roas.toFixed(2)}x` : ', '),
  },
];

const productColumns = [
  { key: 'productName', label: 'Product' },
  {
    key: 'views',
    label: 'Views',
    align: 'right' as const,
    render: (r: ProductPerformance) => r.views.toLocaleString(),
  },
  {
    key: 'addToCarts',
    label: 'Add to Cart',
    align: 'right' as const,
    render: (r: ProductPerformance) => r.addToCarts.toLocaleString(),
  },
  {
    key: 'purchases',
    label: 'Purchases',
    align: 'right' as const,
    render: (r: ProductPerformance) => r.purchases.toLocaleString(),
  },
  {
    key: 'revenue',
    label: 'Revenue',
    align: 'right' as const,
    render: (r: ProductPerformance) => formatCurrency(r.revenue),
  },
  {
    key: 'conversionRate',
    label: 'View → Purchase',
    align: 'right' as const,
    render: (r: ProductPerformance) => formatPct(r.conversionRate),
  },
];

const campaignColumns = [
  { key: 'campaign_name', label: 'Campaign' },
  { key: 'platform', label: 'Platform' },
  {
    key: 'spend_usd',
    label: 'Spend',
    align: 'right' as const,
    render: (r: CampaignPerformanceRow) => formatCurrency(r.spend_usd),
  },
  {
    key: 'purchase_revenue',
    label: 'Revenue',
    align: 'right' as const,
    render: (r: CampaignPerformanceRow) => formatCurrency(r.purchase_revenue),
  },
  {
    key: 'purchases',
    label: 'Purchases',
    align: 'right' as const,
    render: (r: CampaignPerformanceRow) => r.purchases.toLocaleString(),
  },
  {
    key: 'roas',
    label: 'ROAS',
    align: 'right' as const,
    render: (r: CampaignPerformanceRow) => `${r.roas.toFixed(2)}x`,
  },
];

export function EcommerceDashboard() {
  const data = ecommerceDashboardData;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">The Tuna Shop | Analytics Dashboard</h2>
        <p className="text-sm text-ink-3">
          E-commerce performance from BigQuery mart tables via Dataform
        </p>
      </div>

      <KpiGrid metrics={data.kpis} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Revenue Trend" description="Monthly revenue over 18 months">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenueTrend}>
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
                <Tooltip formatter={tooltipFmt('Revenue')} labelFormatter={(l) => `Month: ${l}`} />
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

        <ChartCard title="Acquisition Funnel" description="Session to purchase conversion">
          <FunnelChart steps={data.acquisitionFunnel} />
        </ChartCard>
      </div>

      <ChartCard title="Channel Performance" description="Attribution by traffic source">
        <DataTable<ChannelBreakdown>
          columns={channelColumns}
          rows={data.channelBreakdown}
          keyField="channel"
        />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Product Performance" description="Revenue and conversion by product">
          <DataTable<ProductPerformance>
            columns={productColumns}
            rows={data.productPerformance}
            keyField="productName"
          />
        </ChartCard>

        <ChartCard
          title="Campaign Performance"
          description="AI-classified campaign taxonomy with spend and ROAS"
        >
          <DataTable<CampaignPerformanceRow>
            columns={campaignColumns}
            rows={data.campaignPerformance}
            keyField="campaign_name"
          />
        </ChartCard>
      </div>
    </div>
  );
}
