/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { DemoNav } from '@/components/demo/demo-nav';

jest.mock('@/lib/events/track', () => ({
  trackClickNav: jest.fn(),
}));

describe('DemoNav', () => {
  it('renders links to all three demos', () => {
    render(<DemoNav />);
    expect(screen.getByRole('link', { name: /tuna shop/i })).toHaveAttribute(
      'href',
      '/demo/ecommerce',
    );
    expect(screen.getByRole('link', { name: /tuna subscription/i })).toHaveAttribute(
      'href',
      '/demo/subscription',
    );
    expect(screen.getByRole('link', { name: /tuna partnerships/i })).toHaveAttribute(
      'href',
      '/demo/leadgen',
    );
  });

  it('renders a back link to the main site', () => {
    render(<DemoNav />);
    const backLink = screen.getByRole('link', { name: /back to site/i });
    expect(backLink).toHaveAttribute('href', '/');
  });

  it('highlights the active demo when activePath is provided', () => {
    render(<DemoNav activePath="/demo/ecommerce" />);
    const activeLink = screen.getByRole('link', { name: /tuna shop/i });
    expect(activeLink.className).toMatch(/font-semibold|text-neutral-900/);
  });
});
