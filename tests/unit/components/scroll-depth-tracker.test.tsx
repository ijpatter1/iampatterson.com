/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react';
import { act } from 'react';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/'),
}));

jest.mock('@/lib/events/track', () => ({
  trackScrollDepth: jest.fn(),
}));

import { trackScrollDepth } from '@/lib/events/track';
import { ScrollDepthTracker } from '@/components/scroll-depth-tracker';

const mockTrackScrollDepth = trackScrollDepth as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    value: 2000,
    configurable: true,
  });
  Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });
});

function simulateScroll(scrollY: number) {
  Object.defineProperty(window, 'scrollY', { value: scrollY, configurable: true });
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
}

describe('ScrollDepthTracker', () => {
  it('fires trackScrollDepth at 25% milestone', () => {
    render(<ScrollDepthTracker />);
    simulateScroll(250);
    expect(mockTrackScrollDepth).toHaveBeenCalledWith(25, 250);
  });

  it('fires trackScrollDepth at multiple milestones progressively', () => {
    render(<ScrollDepthTracker />);
    simulateScroll(500);
    expect(mockTrackScrollDepth).toHaveBeenCalledWith(25, 500);
    expect(mockTrackScrollDepth).toHaveBeenCalledWith(50, 500);
    expect(mockTrackScrollDepth).toHaveBeenCalledTimes(2);
  });

  it('does not fire the same milestone twice', () => {
    render(<ScrollDepthTracker />);
    simulateScroll(250);
    simulateScroll(300);
    expect(mockTrackScrollDepth).toHaveBeenCalledTimes(1);
  });

  it('renders nothing', () => {
    const { container } = render(<ScrollDepthTracker />);
    expect(container.innerHTML).toBe('');
  });
});
