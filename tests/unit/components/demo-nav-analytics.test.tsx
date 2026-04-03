/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('@/lib/events/track', () => ({
  trackClickNav: jest.fn(),
}));

import { DemoNav } from '@/components/demo/demo-nav';

describe('DemoNav analytics link', () => {
  it('shows Analytics link when on e-commerce demo', () => {
    render(<DemoNav activePath="/demo/ecommerce" />);
    const analyticsLink = screen.getByText('Analytics');
    expect(analyticsLink).toBeInTheDocument();
    expect(analyticsLink.closest('a')).toHaveAttribute('href', '/demo/ecommerce/analytics');
  });

  it('shows Analytics link when on subscription demo', () => {
    render(<DemoNav activePath="/demo/subscription" />);
    const analyticsLink = screen.getByText('Analytics');
    expect(analyticsLink.closest('a')).toHaveAttribute('href', '/demo/subscription/analytics');
  });

  it('shows Analytics link when on leadgen demo', () => {
    render(<DemoNav activePath="/demo/leadgen" />);
    const analyticsLink = screen.getByText('Analytics');
    expect(analyticsLink.closest('a')).toHaveAttribute('href', '/demo/leadgen/analytics');
  });

  it('does not show Analytics link on demo landing page', () => {
    render(<DemoNav activePath="/demo" />);
    expect(screen.queryByText('Analytics')).not.toBeInTheDocument();
  });

  it('highlights Analytics link when on analytics page', () => {
    render(<DemoNav activePath="/demo/ecommerce/analytics" />);
    const analyticsLink = screen.getByText('Analytics');
    expect(analyticsLink).toHaveClass('font-semibold');
  });
});
