/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import DemoLandingPage from '@/app/demo/page';

jest.mock('@/lib/events/track', () => ({
  trackClickNav: jest.fn(),
  trackClickCta: jest.fn(),
}));

describe('Demo Landing Page', () => {
  it('renders the page heading', () => {
    render(<DemoLandingPage />);
    expect(
      screen.getByRole('heading', { name: /three business models.*one stack/i }),
    ).toBeInTheDocument();
  });

  it('renders cards for all three demos', () => {
    render(<DemoLandingPage />);
    expect(screen.getByText(/the tuna shop/i)).toBeInTheDocument();
    expect(screen.getByText(/tuna subscription/i)).toBeInTheDocument();
    expect(screen.getByText(/tuna partnerships/i)).toBeInTheDocument();
  });

  it('renders links to each demo', () => {
    render(<DemoLandingPage />);
    const links = screen.getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/demo/ecommerce');
    expect(hrefs).toContain('/demo/subscription');
    expect(hrefs).toContain('/demo/leadgen');
  });
});
