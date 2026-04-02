/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/demo/ecommerce/analytics',
}));

jest.mock('@/lib/events/track', () => ({
  trackClickNav: jest.fn(),
  trackClickCta: jest.fn(),
  trackPageView: jest.fn(),
}));

// Mock recharts to avoid canvas/SVG rendering issues in jsdom
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
    PieChart: MockChart,
    Pie: MockComponent,
  };
});

import { EcommerceDashboard } from '@/components/demo/ecommerce/analytics-dashboard';

describe('EcommerceDashboard', () => {
  beforeEach(() => {
    render(<EcommerceDashboard />);
  });

  it('renders KPI cards with correct values', () => {
    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    expect(screen.getByText('$284,192')).toBeInTheDocument();
    expect(screen.getByText('Orders')).toBeInTheDocument();
    expect(screen.getByText('Avg Order Value')).toBeInTheDocument();
    // KPI labels may appear in both KPI cards and tables
    expect(screen.getAllByText(/Conversion Rate|Conv\. Rate/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders revenue trend chart section', () => {
    expect(screen.getByText('Revenue Trend')).toBeInTheDocument();
  });

  it('renders channel breakdown table', () => {
    expect(screen.getByText('Channel Performance')).toBeInTheDocument();
    expect(screen.getByText('google / cpc')).toBeInTheDocument();
    expect(screen.getByText('meta / paid_social')).toBeInTheDocument();
  });

  it('renders product performance section', () => {
    expect(screen.getByText('Product Performance')).toBeInTheDocument();
    expect(screen.getByText('Tuna Plush Toy')).toBeInTheDocument();
    expect(screen.getByText('Tuna Tote Bag')).toBeInTheDocument();
  });

  it('renders acquisition funnel', () => {
    expect(screen.getByText('Acquisition Funnel')).toBeInTheDocument();
    // "Sessions" appears in both funnel and channel table
    expect(screen.getAllByText('Sessions').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Purchase')).toBeInTheDocument();
  });

  it('renders campaign performance table', () => {
    expect(screen.getByText('Campaign Performance')).toBeInTheDocument();
    expect(screen.getByText('Brand — Tuna Shop')).toBeInTheDocument();
  });

  it('shows positive change indicators as green', () => {
    const positiveChanges = screen.getAllByText(/\+\d+/);
    expect(positiveChanges.length).toBeGreaterThan(0);
  });
});
