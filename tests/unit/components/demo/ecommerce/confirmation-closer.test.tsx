/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';

import { ConfirmationCloser } from '@/components/demo/ecommerce/order-confirmation';
import { HERO } from '@/lib/content/hero';
import { REVIEW_PAGE_HREF } from '@/lib/content/review';
import { trackClickCta } from '@/lib/events/track';

jest.mock('@/lib/events/track', () => ({
  ...jest.requireActual('@/lib/events/track'),
  trackClickCta: jest.fn(),
}));

// The shop demo ends on the site's call to action. Like every other "Start
// with a review" link (header_review, hero_review), it reports its click under
// its own location, so the shop's hand-off to the review shows in the data.
describe('ConfirmationCloser call to action', () => {
  it('is the homepage call to action, pointing at the review page', () => {
    render(<ConfirmationCloser />);
    const cta = screen.getByRole('link', { name: new RegExp(HERO.primaryCta) });
    expect(cta.getAttribute('href')).toBe(REVIEW_PAGE_HREF);
  });

  it('reports its click as shop_confirmation_review', () => {
    render(<ConfirmationCloser />);
    fireEvent.click(screen.getByRole('link', { name: new RegExp(HERO.primaryCta) }));
    expect(trackClickCta).toHaveBeenCalledWith(
      expect.stringContaining(HERO.primaryCta),
      'shop_confirmation_review',
    );
  });
});
