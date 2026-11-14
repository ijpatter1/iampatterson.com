/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import ContactThanksPage, { metadata } from '@/app/contact/thanks/page';
import { CONTACT_COPY, THANKS_METADATA } from '@/lib/content/contact';

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
    // The search snippet and share card carry the same promise: the
    // response's first sentence. A change to the promise fails here until
    // the description follows it.
    const promise = CONTACT_COPY.response.match(/^[^.]+\./)![0];
    expect(promise).toMatch(/reply/i);
    expect(metadata.description).toContain(promise);
  });

  // The page sits inside /contact's layout. Without its own metadata, a shared
  // link to it would carry /contact's card and canonical.
  it("carries its own share card and canonical, not /contact's, and stays out of search", () => {
    const url = 'https://iampatterson.com/contact/thanks';
    expect(metadata.openGraph).toMatchObject({
      title: THANKS_METADATA.title,
      description: THANKS_METADATA.description,
      url,
    });
    expect(metadata.twitter).toMatchObject({
      title: THANKS_METADATA.title,
      description: THANKS_METADATA.description,
    });
    expect(metadata.alternates?.canonical).toBe(url);
    expect(metadata.robots).toMatchObject({ index: false });
  });

  it('links back to the homepage', () => {
    render(<ContactThanksPage />);
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/');
  });
});
