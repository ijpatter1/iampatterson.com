import { render, screen } from '@testing-library/react';

import { Footer } from '@/components/footer';

describe('Footer', () => {
  it('renders the company location', () => {
    render(<Footer />);
    expect(screen.getByText(/atlanta, ga/i)).toBeInTheDocument();
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

  it('renders the flip-the-card reference', () => {
    render(<Footer />);
    expect(screen.getByText(/flip the card to see how/i)).toBeInTheDocument();
  });
});
