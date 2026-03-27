/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Header } from '@/components/header';

jest.mock('@/lib/events/track', () => ({
  trackClickNav: jest.fn(),
}));

import { trackClickNav } from '@/lib/events/track';

const mockTrackClickNav = trackClickNav as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Header', () => {
  it('renders navigation links for Phase 1 pages', () => {
    render(<Header />);
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /services/i })).toHaveAttribute('href', '/services');
    expect(screen.getByRole('link', { name: /about/i })).toHaveAttribute('href', '/about');
    expect(screen.getByRole('link', { name: /contact/i })).toHaveAttribute('href', '/contact');
  });

  it('does not render Demos dropdown in Phase 1', () => {
    render(<Header />);
    expect(screen.queryByText(/demos/i)).not.toBeInTheDocument();
  });

  it('does not render flip-the-card toggle in header (trigger is in layout)', () => {
    render(<Header />);
    expect(screen.queryByText(/flip/i)).not.toBeInTheDocument();
  });

  it('renders the site name', () => {
    render(<Header />);
    expect(screen.getByText(/patterson consulting/i)).toBeInTheDocument();
  });

  it('renders a mobile menu button', () => {
    render(<Header />);
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });

  it('fires trackClickNav when a nav link is clicked', async () => {
    const user = userEvent.setup();
    render(<Header />);
    await user.click(screen.getByRole('link', { name: /services/i }));
    expect(mockTrackClickNav).toHaveBeenCalledWith('Services', '/services');
  });
});
