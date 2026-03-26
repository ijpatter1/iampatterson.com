import { render, screen } from '@testing-library/react';

import { Header } from '@/components/header';

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

  it('does not render flip-the-card toggle in Phase 1', () => {
    render(<Header />);
    expect(screen.queryByText(/flip/i)).not.toBeInTheDocument();
  });

  it('renders the site name', () => {
    render(<Header />);
    expect(screen.getByText(/patterson consulting/i)).toBeInTheDocument();
  });
});
