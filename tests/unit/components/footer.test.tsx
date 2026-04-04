import { render, screen } from '@testing-library/react';

import { Footer } from '@/components/footer';

describe('Footer', () => {
  it('renders the company location', () => {
    render(<Footer />);
    expect(screen.getByText(/patterson consulting/i)).toBeInTheDocument();
  });

  it('renders the email link', () => {
    render(<Footer />);
    const emailLink = screen.getByRole('link', { name: /ian@iampatterson\.com/i });
    expect(emailLink).toHaveAttribute('href', 'mailto:ian@iampatterson.com');
  });

  it('renders the tagline about the stack', () => {
    render(<Footer />);
    expect(screen.getByText(/built with the same stack i sell/i)).toBeInTheDocument();
  });

  it('renders the under-the-hood reference', () => {
    render(<Footer />);
    expect(screen.getByText(/look under the hood/i)).toBeInTheDocument();
  });
});
