/**
 * @jest-environment jsdom
 */
import { render, screen, act } from '@testing-library/react';

import { AmbientBubbles } from '@/components/ambient-bubbles';

// Mock pushEvent to capture the dataLayer listener
jest.mock('@/lib/events/push', () => ({
  pushEvent: jest.fn(),
}));

beforeEach(() => {
  window.dataLayer = [];
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

function simulateDataLayerPush(event: Record<string, unknown>) {
  window.dataLayer.push(event);
  // AmbientBubbles polls dataLayer, so trigger the interval
}

describe('AmbientBubbles', () => {
  it('renders without crashing when no events', () => {
    render(<AmbientBubbles />);
    // Should not render any bubbles
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a bubble when a data layer event fires', () => {
    render(<AmbientBubbles />);
    act(() => {
      simulateDataLayerPush({ event: 'page_view', page_path: '/' });
      jest.advanceTimersByTime(500);
    });
    const bubbles = screen.getAllByRole('status');
    expect(bubbles.length).toBeGreaterThanOrEqual(1);
  });

  it('displays the event name in the bubble', () => {
    render(<AmbientBubbles />);
    act(() => {
      simulateDataLayerPush({ event: 'click_cta', cta_text: 'Learn more' });
      jest.advanceTimersByTime(500);
    });
    expect(screen.getByText(/click_cta/)).toBeInTheDocument();
  });

  it('auto-removes bubbles after the fade duration', () => {
    render(<AmbientBubbles />);
    act(() => {
      simulateDataLayerPush({ event: 'scroll_depth', depth_percentage: 25 });
      jest.advanceTimersByTime(500);
    });
    expect(screen.getAllByRole('status').length).toBeGreaterThanOrEqual(1);
    // Bubbles should disappear after ~3 seconds
    act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('respects maxBubbles prop to cap visible bubbles', () => {
    render(<AmbientBubbles maxBubbles={2} />);
    act(() => {
      simulateDataLayerPush({ event: 'page_view', page_path: '/' });
      jest.advanceTimersByTime(100);
      simulateDataLayerPush({ event: 'click_nav', link_text: 'Services' });
      jest.advanceTimersByTime(100);
      simulateDataLayerPush({ event: 'scroll_depth', depth_percentage: 25 });
      jest.advanceTimersByTime(500);
    });
    const bubbles = screen.getAllByRole('status');
    expect(bubbles.length).toBeLessThanOrEqual(2);
  });
});
