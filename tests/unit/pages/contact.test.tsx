import { render, screen } from '@testing-library/react';

import ContactPage from '@/app/contact/page';

describe('ContactPage', () => {
  it('renders the page heading', () => {
    render(<ContactPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /let's talk about your measurement stack/i,
    );
  });

  it('renders the introductory copy', () => {
    render(<ContactPage />);
    expect(screen.getByText(/e-commerce brands, saas companies/i)).toBeInTheDocument();
  });

  it('renders the email address', () => {
    render(<ContactPage />);
    const emailLink = screen.getByRole('link', { name: /ian@iampatterson\.com/i });
    expect(emailLink).toHaveAttribute('href', 'mailto:ian@iampatterson.com');
  });

  it('renders the response expectation', () => {
    render(<ContactPage />);
    expect(screen.getByText(/respond within 24 hours/i)).toBeInTheDocument();
  });

  it('renders a contact form with name, email, and message fields', () => {
    render(<ContactPage />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
  });

  it('renders a submit button', () => {
    render(<ContactPage />);
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });
});
