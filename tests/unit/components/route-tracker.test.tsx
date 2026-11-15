/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react';
import { StrictMode } from 'react';

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
  // 15.8: the landing page needs its own page_view. `GA4 - Config` has
  // send_page_view off (page views come from app code), so before 15.8 a
  // visitor's first page sent none, and nothing in GA4 or BigQuery saw where
  // a visit started.
  it('fires trackPageView for the landing page, with the document referrer', () => {
    Object.defineProperty(document, 'referrer', {
      value: 'https://www.linkedin.com/',
      configurable: true,
    });
    try {
      render(<RouteTracker />);
      expect(mockTrackPageView).toHaveBeenCalledTimes(1);
      expect(mockTrackPageView).toHaveBeenCalledWith('https://www.linkedin.com/');
    } finally {
      delete (document as unknown as { referrer?: string }).referrer;
    }
  });

  it('fires the landing page_view once under Strict Mode', () => {
    render(
      <StrictMode>
        <RouteTracker />
      </StrictMode>,
    );
    expect(mockTrackPageView).toHaveBeenCalledTimes(1);
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
    mockTrackPageView.mockClear();

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
