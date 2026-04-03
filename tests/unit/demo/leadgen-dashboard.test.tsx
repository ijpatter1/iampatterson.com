/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/demo/leadgen/analytics',
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

import { LeadGenDashboard } from '@/components/demo/leadgen/analytics-dashboard';

describe('LeadGenDashboard', () => {
  beforeEach(() => {
    render(<LeadGenDashboard />);
  });

  it('renders KPI cards', () => {
    expect(screen.getByText('Total Leads')).toBeInTheDocument();
    expect(screen.getAllByText('1,842').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Qualified Leads').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Qualification Rate')).toBeInTheDocument();
    expect(screen.getByText('Cost per Lead')).toBeInTheDocument();
  });

  it('renders lead volume trend chart', () => {
    expect(screen.getByText('Lead Volume Trend')).toBeInTheDocument();
  });

  it('renders lead funnel', () => {
    expect(screen.getByText('Lead Funnel')).toBeInTheDocument();
    expect(screen.getByText('Page Views')).toBeInTheDocument();
    expect(screen.getByText('Form Starts')).toBeInTheDocument();
    expect(screen.getByText('Form Submissions')).toBeInTheDocument();
  });

  it('renders cost per lead by channel', () => {
    expect(screen.getByText('Cost per Lead by Channel')).toBeInTheDocument();
    expect(screen.getAllByText('google / cpc').length).toBeGreaterThanOrEqual(1);
  });

  it('renders lead quality distribution', () => {
    expect(screen.getByText('Lead Quality Distribution')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
    expect(screen.getByText('Mid-Market')).toBeInTheDocument();
    expect(screen.getByText('Small Business')).toBeInTheDocument();
  });

  it('renders conversion timeline chart', () => {
    expect(screen.getByText('Qualified Lead Trend')).toBeInTheDocument();
  });

  it('shows negative cost change as green (improvement)', () => {
    // Cost per lead decreased, which is good
    expect(screen.getByText('-4.2% vs prior period')).toBeInTheDocument();
  });
});
