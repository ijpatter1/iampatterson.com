/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

jest.mock('@/lib/events/track', () => ({
  trackClickNav: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/demo/ecommerce',
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

  it('renders a demo footer with cross-demo navigation', () => {
    render(
      <DemoLayout>
        <div>Demo content</div>
      </DemoLayout>,
    );
    // Demo footer should provide links back to homepage demos section and to other demos
    expect(screen.getByRole('link', { name: /back to demos/i })).toHaveAttribute('href', '/#demos');
  });
});
