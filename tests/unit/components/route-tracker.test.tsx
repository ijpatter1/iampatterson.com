/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/'),
}));

jest.mock('@/lib/events/track', () => ({
  trackPageView: jest.fn(),
}));

import { usePathname } from 'next/navigation';
import { trackPageView } from '@/lib/events/track';
import { RouteTracker } from '@/components/route-tracker';

const mockUsePathname = usePathname as jest.Mock;
const mockTrackPageView = trackPageView as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUsePathname.mockReturnValue('/');
});

describe('RouteTracker', () => {
  it('fires trackPageView with document.referrer on initial mount', () => {
    Object.defineProperty(document, 'referrer', {
      value: 'https://google.com',
      configurable: true,
    });
    render(<RouteTracker />);
    expect(mockTrackPageView).toHaveBeenCalledWith('https://google.com');
  });

  it('fires trackPageView with previous path on route change', () => {
    const { rerender } = render(<RouteTracker />);
    mockTrackPageView.mockClear();

    mockUsePathname.mockReturnValue('/services');
    rerender(<RouteTracker />);

    expect(mockTrackPageView).toHaveBeenCalledWith('/');
  });

  it('renders nothing', () => {
    const { container } = render(<RouteTracker />);
    expect(container.innerHTML).toBe('');
  });
});
