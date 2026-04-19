/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

let mockPathname = '/demo/ecommerce';
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => mockPathname,
}));

beforeEach(() => {
  mockPathname = '/demo/ecommerce';
});

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

  // ---------------------------------------------------------------------
  // Phase 9B deliverable 6b — confirmation route fallback for the three
  // non-embeddable questions (ROAS, Revenue share, LTV)
  // ---------------------------------------------------------------------
  describe('on /demo/ecommerce/confirmation', () => {
    beforeEach(() => {
      mockPathname = '/demo/ecommerce/confirmation';
    });

    it('renders a section for the three non-embeddable questions behind IAP', () => {
      render(<DashboardView />);
      expect(screen.getByText(/three more reports behind iap/i)).toBeInTheDocument();
    });

    it('lists ROAS, Revenue share, and Customer LTV as the three extras', () => {
      render(<DashboardView />);
      expect(screen.getByText(/ROAS by campaign/i)).toBeInTheDocument();
      expect(screen.getByText(/Revenue share by channel/i)).toBeInTheDocument();
      expect(screen.getByText(/Customer LTV distribution/i)).toBeInTheDocument();
    });

    it('each extras card deep-links to the matching Metabase question URL', () => {
      render(<DashboardView />);
      const roas = screen.getByText(/ROAS by campaign/i).closest('a');
      const share = screen.getByText(/Revenue share by channel/i).closest('a');
      const ltv = screen.getByText(/Customer LTV distribution/i).closest('a');
      expect(roas).toHaveAttribute('href', 'https://bi.iampatterson.com/question/42');
      expect(share).toHaveAttribute('href', 'https://bi.iampatterson.com/question/43');
      expect(ltv).toHaveAttribute('href', 'https://bi.iampatterson.com/question/44');
      // All three open in a new tab — Metabase is on a different origin
      [roas, share, ltv].forEach((a) => {
        expect(a).toHaveAttribute('target', '_blank');
        expect(a).toHaveAttribute('rel', expect.stringContaining('noopener'));
      });
    });

    it('links to the full dashboard at /dashboard/2', () => {
      render(<DashboardView />);
      const fullDash = screen.getByRole('link', { name: /see the full dashboard/i });
      expect(fullDash).toHaveAttribute('href', 'https://bi.iampatterson.com/dashboard/2');
    });

    it('warns the visitor about the IAP gate before they click through', () => {
      render(<DashboardView />);
      // Anonymous visitors hitting /question/N get the Google SSO wall. The
      // section copy should set that expectation before the click.
      expect(screen.getByText(/Google SSO wall/i)).toBeInTheDocument();
      expect(screen.getByText(/reach out for a walkthrough/i)).toBeInTheDocument();
      // Per-card affordance labels the gate (was a bare ↗ before)
      expect(screen.getAllByText(/^IAP ↗$/).length).toBe(3);
    });
  });

  describe('not on /demo/ecommerce/confirmation', () => {
    it('does not render the three-more-reports section on /demo/ecommerce', () => {
      mockPathname = '/demo/ecommerce';
      render(<DashboardView />);
      expect(screen.queryByText(/three more reports behind iap/i)).toBeNull();
    });

    it('does not render it on /demo/subscription either', () => {
      mockPathname = '/demo/subscription';
      render(<DashboardView />);
      expect(screen.queryByText(/three more reports behind iap/i)).toBeNull();
    });
  });
});
