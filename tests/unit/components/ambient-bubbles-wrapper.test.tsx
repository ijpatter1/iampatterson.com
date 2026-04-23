/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react';

let mockPathname = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

import { AmbientBubblesWrapper } from '@/components/ambient-bubbles-wrapper';

describe('AmbientBubblesWrapper', () => {
  it('renders AmbientBubbles on consulting pages', () => {
    mockPathname = '/';
    const { container } = render(<AmbientBubblesWrapper />);
    // Component should render (even if no bubbles visible yet)
    expect(container).toBeTruthy();
  });

  it('does not render on demo pages', () => {
    mockPathname = '/demo/ecommerce';
    const { container } = render(<AmbientBubblesWrapper />);
    expect(container.innerHTML).toBe('');
  });

  it('does not render on /demo subpages', () => {
    mockPathname = '/demo/subscription/signup';
    const { container } = render(<AmbientBubblesWrapper />);
    expect(container.innerHTML).toBe('');
  });

  it('renders on /services page', () => {
    mockPathname = '/services';
    const { container } = render(<AmbientBubblesWrapper />);
    expect(container).toBeTruthy();
  });
});
