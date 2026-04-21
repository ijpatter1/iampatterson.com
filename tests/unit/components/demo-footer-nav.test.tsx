/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

jest.mock('@/lib/events/track', () => ({
  trackClickNav: jest.fn(),
}));

import { DemoFooterNav } from '@/components/demo/demo-footer-nav';

describe('DemoFooterNav, post-9E simplified', () => {
  it('renders a single "Back to demos" affordance linking to homepage #demos', () => {
    // Phase 9E deliverable 7: subscription and lead gen removed from the
    // site. With only the ecommerce demo remaining, the cross-demo
    // "Also explore" section has nothing to cross-link to. The nav is
    // simplified to a single back-to-homepage affordance per
    // UX_PIVOT_SPEC §3.7.
    render(<DemoFooterNav />);
    expect(screen.getByRole('link', { name: /back to demos/i })).toHaveAttribute('href', '/#demos');
  });

  it('does not render cross-demo links to subscription or leadgen (both removed from site)', () => {
    render(<DemoFooterNav />);
    expect(screen.queryByRole('link', { name: /tuna subscription/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /tuna partnerships/i })).not.toBeInTheDocument();
  });
});
