/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

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

  // 17.1: the layout's generic footer linked back to the homepage's Demos
  // section, which 15.4 deleted. The shop carries its own footer, and no
  // other route lives under /demo, so nothing under /demo links to it.
  it.each(['/demo/ecommerce', '/demo/ecommerce/cart', '/demo/subscription'])(
    'renders no link to the deleted Demos section on %s',
    (path) => {
      mockPathname = path;
      const { container } = render(
        <DemoLayout>
          <div>Demo content</div>
        </DemoLayout>,
      );
      expect(screen.queryByRole('link', { name: /back to demos/i })).not.toBeInTheDocument();
      expect(container.querySelector('a[href*="#demos"]')).toBeNull();
    },
  );
});
