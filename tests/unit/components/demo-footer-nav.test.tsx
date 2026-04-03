/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

jest.mock('@/lib/events/track', () => ({
  trackClickNav: jest.fn(),
}));

import { DemoFooterNav } from '@/components/demo/demo-footer-nav';

describe('DemoFooterNav', () => {
  it('renders a link back to homepage demos section', () => {
    render(<DemoFooterNav currentDemo="ecommerce" />);
    expect(screen.getByRole('link', { name: /back to demos/i })).toHaveAttribute('href', '/#demos');
  });

  it('renders links to other demos but not the current one', () => {
    render(<DemoFooterNav currentDemo="ecommerce" />);
    // Should not link to the current demo
    expect(screen.queryByRole('link', { name: /the tuna shop/i })).not.toBeInTheDocument();
    // Should link to the other two
    expect(screen.getByRole('link', { name: /tuna subscription/i })).toHaveAttribute(
      'href',
      '/demo/subscription',
    );
    expect(screen.getByRole('link', { name: /tuna partnerships/i })).toHaveAttribute(
      'href',
      '/demo/leadgen',
    );
  });

  it('shows different other demos when on subscription', () => {
    render(<DemoFooterNav currentDemo="subscription" />);
    expect(screen.getByRole('link', { name: /the tuna shop/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /tuna subscription/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /tuna partnerships/i })).toBeInTheDocument();
  });
});
