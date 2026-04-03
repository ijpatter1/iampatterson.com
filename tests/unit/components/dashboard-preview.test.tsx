/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { DashboardPreview } from '@/components/demo/dashboard/dashboard-preview';

import type { KpiMetric } from '@/lib/demo/dashboard-types';

const mockKpis: KpiMetric[] = [
  { label: 'Revenue', value: '$284K', change: 12.4 },
  { label: 'Orders', value: '8,247', change: 8.1 },
  { label: 'AOV', value: '$34.46', change: 3.9 },
];

describe('DashboardPreview', () => {
  it('renders narrative heading', () => {
    render(
      <DashboardPreview
        kpis={mockKpis}
        narrative="Revenue is trending up."
        analyticsHref="/demo/ecommerce/analytics"
      />,
    );
    expect(screen.getByText(/what this data shows at scale/i)).toBeInTheDocument();
  });

  it('renders KPI values', () => {
    render(
      <DashboardPreview
        kpis={mockKpis}
        narrative="Revenue is trending up."
        analyticsHref="/demo/ecommerce/analytics"
      />,
    );
    expect(screen.getByText('$284K')).toBeInTheDocument();
    expect(screen.getByText('8,247')).toBeInTheDocument();
  });

  it('renders the narrative text', () => {
    render(
      <DashboardPreview
        kpis={mockKpis}
        narrative="Revenue is trending up."
        analyticsHref="/demo/ecommerce/analytics"
      />,
    );
    expect(screen.getByText('Revenue is trending up.')).toBeInTheDocument();
  });

  it('renders a link to the full dashboard', () => {
    render(
      <DashboardPreview
        kpis={mockKpis}
        narrative="Revenue is trending up."
        analyticsHref="/demo/ecommerce/analytics"
      />,
    );
    const link = screen.getByRole('link', { name: /full dashboard/i });
    expect(link).toHaveAttribute('href', '/demo/ecommerce/analytics');
  });
});
