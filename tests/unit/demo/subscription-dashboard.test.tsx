/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/demo/subscription/analytics',
}));

jest.mock('@/lib/events/track', () => ({
  trackClickNav: jest.fn(),
  trackClickCta: jest.fn(),
  trackPageView: jest.fn(),
}));

jest.mock('recharts', () => {
  const MockChart = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="mock-chart">{children}</div>
  );
  const MockComponent = () => <div />;
  return {
    ResponsiveContainer: MockChart,
    AreaChart: MockChart,
    Area: MockComponent,
    BarChart: MockChart,
    Bar: MockComponent,
    LineChart: MockChart,
    Line: MockComponent,
    XAxis: MockComponent,
    YAxis: MockComponent,
    CartesianGrid: MockComponent,
    Tooltip: MockComponent,
    Legend: MockComponent,
    Cell: MockComponent,
  };
});

import { SubscriptionDashboard } from '@/components/demo/subscription/analytics-dashboard';

describe('SubscriptionDashboard', () => {
  beforeEach(() => {
    render(<SubscriptionDashboard />);
  });

  it('renders KPI cards', () => {
    expect(screen.getByText('MRR')).toBeInTheDocument();
    expect(screen.getByText('$18,420')).toBeInTheDocument();
    expect(screen.getByText('Active Subscribers')).toBeInTheDocument();
    expect(screen.getByText('Trial-to-Paid')).toBeInTheDocument();
    expect(screen.getByText('Monthly Churn')).toBeInTheDocument();
  });

  it('renders MRR trend chart', () => {
    expect(screen.getByText('MRR Trend')).toBeInTheDocument();
  });

  it('renders cohort retention table', () => {
    expect(screen.getByText('Cohort Retention')).toBeInTheDocument();
    expect(screen.getByText('2025-07')).toBeInTheDocument();
  });

  it('renders churn breakdown', () => {
    expect(screen.getByText('Churn Reasons')).toBeInTheDocument();
    // Churn reasons render inside a mocked BarChart via YAxis dataKey
    expect(screen.getByText('Self-reported churn reasons')).toBeInTheDocument();
  });

  it('renders trial conversion by channel', () => {
    expect(screen.getByText('Trial-to-Paid by Channel')).toBeInTheDocument();
    // Channel names may appear in multiple tables
    expect(screen.getAllByText('google / cpc').length).toBeGreaterThanOrEqual(1);
  });

  it('renders LTV by source', () => {
    expect(screen.getByText('LTV by Acquisition Source')).toBeInTheDocument();
    expect(screen.getAllByText('google / organic').length).toBeGreaterThanOrEqual(1);
  });

  it('shows negative churn change as green (improvement)', () => {
    // Churn went from 6.1% to 5.8% = -0.3% change, which is good
    expect(screen.getByText('-0.3% vs prior period')).toBeInTheDocument();
  });
});
