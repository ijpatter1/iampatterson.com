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
  it('does not fire trackPageView on initial mount (googtag handles it)', () => {
    render(<RouteTracker />);
    expect(mockTrackPageView).not.toHaveBeenCalled();
  });

  it('fires trackPageView with previous path on SPA navigation', () => {
    const { rerender } = render(<RouteTracker />);
    mockTrackPageView.mockClear();

    mockUsePathname.mockReturnValue('/services');
    rerender(<RouteTracker />);

    expect(mockTrackPageView).toHaveBeenCalledWith('/');
  });

  it('fires trackPageView on subsequent navigations', () => {
    const { rerender } = render(<RouteTracker />);

    mockUsePathname.mockReturnValue('/services');
    rerender(<RouteTracker />);
    expect(mockTrackPageView).toHaveBeenCalledTimes(1);

    mockUsePathname.mockReturnValue('/about');
    rerender(<RouteTracker />);
    expect(mockTrackPageView).toHaveBeenCalledTimes(2);
    expect(mockTrackPageView).toHaveBeenLastCalledWith('/services');
  });

  it('renders nothing', () => {
    const { container } = render(<RouteTracker />);
    expect(container.innerHTML).toBe('');
  });
});
