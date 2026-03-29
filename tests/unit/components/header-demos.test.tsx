/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Header } from '@/components/header';

jest.mock('@/lib/events/track', () => ({
  trackClickNav: jest.fn(),
}));

describe('Header — Demos dropdown (Phase 6)', () => {
  it('renders a Demos dropdown trigger', () => {
    render(<Header />);
    expect(screen.getByText(/demos/i)).toBeInTheDocument();
  });

  it('shows demo links when Demos dropdown is opened', async () => {
    const user = userEvent.setup();
    render(<Header />);
    await user.click(screen.getByText(/demos/i));
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

  it('shows demo links in mobile menu', async () => {
    const user = userEvent.setup();
    render(<Header />);
    await user.click(screen.getByRole('button', { name: /open menu/i }));
    expect(screen.getByRole('link', { name: /tuna shop/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /tuna subscription/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /tuna partnerships/i })).toBeInTheDocument();
  });
});
