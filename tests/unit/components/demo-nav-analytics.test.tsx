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
  it('does not show a standalone Analytics link (dashboards are inline via DashboardPreview)', () => {
    render(<DemoNav activePath="/demo/ecommerce" />);
    expect(screen.queryByText('Analytics')).not.toBeInTheDocument();
  });

  it('does not show Analytics link on demo landing page', () => {
    render(<DemoNav activePath="/demo" />);
    expect(screen.queryByText('Analytics')).not.toBeInTheDocument();
  });
});
