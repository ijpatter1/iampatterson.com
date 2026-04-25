/**
 * @jest-environment jsdom
 */
import { render, act } from '@testing-library/react';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/'),
}));

jest.mock('@/lib/events/track', () => ({
  trackPageEngagement: jest.fn(),
}));

import { trackPageEngagement } from '@/lib/events/track';
import { PageEngagementTracker } from '@/components/page-engagement-tracker';
import { usePathname } from 'next/navigation';

const mockTrackEngagement = trackPageEngagement as jest.Mock;
const mockUsePathname = usePathname as jest.Mock;

function setHidden(value: boolean) {
  Object.defineProperty(document, 'hidden', { value, configurable: true });
}

function fireVisibility() {
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  setHidden(false);
  mockUsePathname.mockReturnValue('/');
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    value: 2000,
    configurable: true,
  });
  Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('PageEngagementTracker', () => {
  it('fires the 15s threshold after 15s of engaged time with current max scroll', () => {
    render(<PageEngagementTracker />);
    act(() => {
      jest.advanceTimersByTime(15_000);
    });
    expect(mockTrackEngagement).toHaveBeenCalledWith({
      engagement_seconds: 15,
      max_scroll_pct: 0,
    });
    expect(mockTrackEngagement).toHaveBeenCalledTimes(1);
  });

  it('fires 15s, 60s, 180s thresholds in order — each at most once', () => {
    render(<PageEngagementTracker />);
    act(() => {
      jest.advanceTimersByTime(15_000);
    });
    expect(mockTrackEngagement).toHaveBeenLastCalledWith({
      engagement_seconds: 15,
      max_scroll_pct: 0,
    });
    act(() => {
      jest.advanceTimersByTime(45_000);
    });
    expect(mockTrackEngagement).toHaveBeenLastCalledWith({
      engagement_seconds: 60,
      max_scroll_pct: 0,
    });
    act(() => {
      jest.advanceTimersByTime(120_000);
    });
    expect(mockTrackEngagement).toHaveBeenLastCalledWith({
      engagement_seconds: 180,
      max_scroll_pct: 0,
    });
    expect(mockTrackEngagement).toHaveBeenCalledTimes(3);
  });

  it('captures the high-water-mark scroll percentage at firing (unbucketed)', () => {
    render(<PageEngagementTracker />);
    // Scroll to 37% of the page (370 / (2000-1000) = 37%) before the 15s tick.
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 370, configurable: true });
      window.dispatchEvent(new Event('scroll'));
      jest.advanceTimersByTime(15_000);
    });
    expect(mockTrackEngagement).toHaveBeenCalledWith({
      engagement_seconds: 15,
      max_scroll_pct: 37,
    });
  });

  it('preserves max_scroll_pct as a high-water-mark across scroll-back-up', () => {
    render(<PageEngagementTracker />);
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 700, configurable: true });
      window.dispatchEvent(new Event('scroll'));
      // Scroll back up; the high-water-mark must NOT regress.
      Object.defineProperty(window, 'scrollY', { value: 100, configurable: true });
      window.dispatchEvent(new Event('scroll'));
      jest.advanceTimersByTime(15_000);
    });
    expect(mockTrackEngagement).toHaveBeenCalledWith({
      engagement_seconds: 15,
      max_scroll_pct: 70,
    });
  });

  it('pauses the engagement counter when the tab becomes hidden', () => {
    render(<PageEngagementTracker />);
    // 10s engaged.
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(mockTrackEngagement).not.toHaveBeenCalled();
    // Tab hides; counter should pause.
    act(() => {
      setHidden(true);
      fireVisibility();
      jest.advanceTimersByTime(60_000);
    });
    // Even though wall-clock advanced, no threshold should have fired
    // because engagement counter was paused while hidden.
    expect(mockTrackEngagement).not.toHaveBeenCalled();
    // Tab returns visible; counter resumes from 10s.
    act(() => {
      setHidden(false);
      fireVisibility();
      jest.advanceTimersByTime(5_000);
    });
    // 10s + 5s = 15s engaged → 15s threshold fires.
    expect(mockTrackEngagement).toHaveBeenCalledWith({
      engagement_seconds: 15,
      max_scroll_pct: 0,
    });
  });

  it('does not fire any threshold while tab is hidden from the start', () => {
    setHidden(true);
    render(<PageEngagementTracker />);
    act(() => {
      jest.advanceTimersByTime(180_000);
    });
    expect(mockTrackEngagement).not.toHaveBeenCalled();
  });

  it('resets the fired-thresholds set on pathname change (SPA navigation)', () => {
    const { rerender } = render(<PageEngagementTracker />);
    act(() => {
      jest.advanceTimersByTime(15_000);
    });
    expect(mockTrackEngagement).toHaveBeenCalledTimes(1);
    expect(mockTrackEngagement).toHaveBeenLastCalledWith({
      engagement_seconds: 15,
      max_scroll_pct: 0,
    });

    // Simulate route change — usePathname returns a new value.
    mockUsePathname.mockReturnValue('/about');
    rerender(<PageEngagementTracker />);

    // 15s on the new route should fire the 15s threshold again.
    act(() => {
      jest.advanceTimersByTime(15_000);
    });
    expect(mockTrackEngagement).toHaveBeenCalledTimes(2);
  });

  it('cleans up the interval and event listeners on unmount', () => {
    const { unmount } = render(<PageEngagementTracker />);
    unmount();
    // Advancing time past all thresholds should fire nothing because
    // the interval was cleared on unmount.
    act(() => {
      jest.advanceTimersByTime(200_000);
    });
    expect(mockTrackEngagement).not.toHaveBeenCalled();
  });

  it('renders nothing', () => {
    const { container } = render(<PageEngagementTracker />);
    expect(container.innerHTML).toBe('');
  });
});
