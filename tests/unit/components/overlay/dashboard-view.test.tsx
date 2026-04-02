/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/demo/ecommerce',
}));

jest.mock('@/lib/events/track', () => ({
  trackClickNav: jest.fn(),
  trackClickCta: jest.fn(),
}));

import { DashboardView } from '@/components/overlay/dashboard-view';

describe('DashboardView', () => {
  it('renders dashboard navigation header', () => {
    render(<DashboardView />);
    expect(screen.getByText('Dashboards')).toBeInTheDocument();
  });

  it('renders links for all three demo dashboards', () => {
    render(<DashboardView />);
    expect(screen.getByText('E-Commerce Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Subscription Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Lead Gen Dashboard')).toBeInTheDocument();
  });

  it('renders dashboard descriptions', () => {
    render(<DashboardView />);
    expect(screen.getByText(/Revenue, AOV, channel attribution/)).toBeInTheDocument();
    expect(screen.getByText(/MRR, cohort retention, churn/)).toBeInTheDocument();
    expect(screen.getByText(/Lead funnel, cost per lead/)).toBeInTheDocument();
  });

  it('renders data source info', () => {
    render(<DashboardView />);
    expect(screen.getAllByText(/BigQuery/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Dataform/).length).toBeGreaterThanOrEqual(1);
  });

  it('highlights the current demo dashboard when on a demo route', () => {
    render(<DashboardView />);
    // On /demo/ecommerce, e-commerce dashboard should be highlighted
    const ecomLink = screen.getByText('E-Commerce Dashboard').closest('a');
    expect(ecomLink).toHaveClass('border-neutral-900');
  });
});
