/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

jest.mock('@/lib/events/track', () => ({
  trackClickNav: jest.fn(),
}));

let mockPathname = '/demo/ecommerce';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

import DemoLayout from '@/app/demo/layout';

describe('DemoLayout', () => {
  it('does not render a DemoNav bar', () => {
    render(
      <DemoLayout>
        <div>Demo content</div>
      </DemoLayout>,
    );
    // DemoNav had a "Back to site" link and inter-demo navigation
    expect(screen.queryByRole('link', { name: /back to site/i })).not.toBeInTheDocument();
  });

  it('renders children within the DemoThemeProvider', () => {
    render(
      <DemoLayout>
        <div data-testid="demo-child">Demo content</div>
      </DemoLayout>,
    );
    expect(screen.getByTestId('demo-child')).toBeInTheDocument();
  });

  it('suppresses the generic DemoFooterNav on /demo/ecommerce/* routes', () => {
    // Phase 9F Major #4: the ecommerce demo carries its own brand-voiced
    // EcomFooter; the generic DemoFooterNav is suppressed so the two
    // footers don't stack.
    mockPathname = '/demo/ecommerce';
    render(
      <DemoLayout>
        <div>Demo content</div>
      </DemoLayout>,
    );
    expect(screen.queryByRole('link', { name: /back to demos/i })).not.toBeInTheDocument();
  });

  it('renders DemoFooterNav on non-ecommerce demo routes (when future demos return)', () => {
    mockPathname = '/demo/subscription';
    render(
      <DemoLayout>
        <div>Demo content</div>
      </DemoLayout>,
    );
    expect(screen.getByRole('link', { name: /back to demos/i })).toHaveAttribute('href', '/#demos');
  });
});
