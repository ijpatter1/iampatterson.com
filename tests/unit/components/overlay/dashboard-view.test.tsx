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
  it('renders the BI-layer kicker and editorial headline', () => {
    render(<DashboardView />);
    expect(screen.getByText(/BI layer · Metabase on BigQuery marts/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(
      /mart tables.*already modeled/i,
    );
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

  it('links to the live Metabase instance', () => {
    render(<DashboardView />);
    const liveLink = screen.getByRole('link', { name: /open →/i });
    expect(liveLink).toHaveAttribute('href', 'https://bi.iampatterson.com/');
    expect(liveLink).toHaveAttribute('target', '_blank');
  });

  it('mentions BigQuery marts and Dataform in the Metabase panel', () => {
    render(<DashboardView />);
    expect(screen.getAllByText(/BigQuery/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Dataform/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/iampatterson_marts/)).toBeInTheDocument();
  });

  it('highlights the current demo dashboard when on a demo route', () => {
    render(<DashboardView />);
    const ecomLink = screen.getByText('E-Commerce Dashboard').closest('a');
    // Active row uses the accent-current border in the underside token set
    expect(ecomLink?.className).toContain('border-accent-current');
  });
});
