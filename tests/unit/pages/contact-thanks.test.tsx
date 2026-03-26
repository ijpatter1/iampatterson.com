/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import ContactThanksPage from '@/app/contact/thanks/page';

describe('ContactThanksPage', () => {
  it('renders a confirmation heading', () => {
    render(<ContactThanksPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/message sent/i);
  });

  it('sets response expectation', () => {
    render(<ContactThanksPage />);
    expect(screen.getByText(/respond within 24 hours/i)).toBeInTheDocument();
  });

  it('links back to the homepage', () => {
    render(<ContactThanksPage />);
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/');
  });
});
