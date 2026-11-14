/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import ContactThanksPage, { metadata } from '@/app/contact/thanks/page';
import { CONTACT_COPY } from '@/lib/content/contact';

describe('ContactThanksPage', () => {
  it('renders a confirmation heading', () => {
    render(<ContactThanksPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/message sent/i);
  });

  // The visitor read this promise on the contact page a moment ago; the
  // page after sending repeats it word for word rather than a different one.
  it("repeats the contact page's response promise", () => {
    render(<ContactThanksPage />);
    expect(screen.getByText(CONTACT_COPY.response)).toBeInTheDocument();
    expect(String(metadata.description)).toMatch(/reply within 24 hours/i);
  });

  it('links back to the homepage', () => {
    render(<ContactThanksPage />);
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/');
  });
});
