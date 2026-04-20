/**
 * @jest-environment jsdom
 */
import { render, screen, act } from '@testing-library/react';

import type { PipelineEvent } from '@/lib/events/pipeline-schema';

let mockLiveEvents: PipelineEvent[] = [];
jest.mock('@/hooks/useLiveEvents', () => ({
  useLiveEvents: () => ({ events: mockLiveEvents, source: 'dataLayer' }),
}));

import { PipelineEditorial } from '@/components/home/pipeline-editorial';
import { PIPELINE_STAGES } from '@/lib/content/pipeline';

beforeEach(() => {
  jest.clearAllMocks();
  mockLiveEvents = [];
  // Default: motion enabled.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: jest.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  });
});

afterEach(() => {
  jest.useRealTimers();
});

function makeEvent(id: string, name: string, ts: string, payload = '/pipeline'): PipelineEvent {
  return {
    pipeline_id: id,
    received_at: ts,
    session_id: 'sid-test',
    event_name: name,
    timestamp: ts,
    page_path: payload,
    page_title: '',
    page_location: '',
    parameters: {},
    consent: {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functionality_storage: 'granted',
    },
    routing: [],
  };
}

describe('PipelineEditorial', () => {
  it('renders Fig. 01 + caption header', () => {
    render(<PipelineEditorial />);
    expect(screen.getByText(/Fig\.\s*01/i)).toBeInTheDocument();
    expect(screen.getByText(/Event flow/i)).toBeInTheDocument();
  });

  it('renders all five numbered stages with their titles', () => {
    render(<PipelineEditorial />);
    PIPELINE_STAGES.forEach((s) => {
      expect(screen.getByTestId(`pipeline-stage-${s.n}`)).toBeInTheDocument();
      expect(screen.getByText(s.title)).toBeInTheDocument();
    });
  });

  it('marks the first stage as active on first render', () => {
    render(<PipelineEditorial />);
    expect(screen.getByTestId('pipeline-stage-01').dataset.active).toBe('true');
    expect(screen.getByTestId('pipeline-stage-02').dataset.active).toBe('false');
  });

  it('rotates the active stage every 1800ms (linear, wraps)', () => {
    jest.useFakeTimers();
    render(<PipelineEditorial />);
    expect(screen.getByTestId('pipeline-stage-01').dataset.active).toBe('true');
    act(() => {
      jest.advanceTimersByTime(1800);
    });
    expect(screen.getByTestId('pipeline-stage-02').dataset.active).toBe('true');
    act(() => {
      jest.advanceTimersByTime(1800 * 4);
    });
    // After 4 more ticks (5 total advances): index = 5 % 5 = 0 → stage 01.
    expect(screen.getByTestId('pipeline-stage-01').dataset.active).toBe('true');
  });

  it('disables stage rotation under prefers-reduced-motion', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });
    jest.useFakeTimers();
    render(<PipelineEditorial />);
    expect(screen.getByTestId('pipeline-stage-01').dataset.active).toBe('true');
    act(() => {
      jest.advanceTimersByTime(1800 * 3);
    });
    // Stage 01 stays active — no interval scheduled.
    expect(screen.getByTestId('pipeline-stage-01').dataset.active).toBe('true');
    expect(screen.getByTestId('pipeline-stage-02').dataset.active).toBe('false');
  });

  it('renders the seed events in the footnote when no live events have arrived', () => {
    render(<PipelineEditorial />);
    const feed = screen.getByTestId('pipeline-log-feed');
    // Seeded session-start so the schematic is never empty on first paint.
    expect(feed.textContent).toContain('session_start');
  });

  it('renders real live events in the footnote when they arrive', () => {
    mockLiveEvents = [
      makeEvent('e1', 'page_view', '2026-04-20T10:00:00.000Z', '/'),
      makeEvent('e2', 'scroll_depth', '2026-04-20T10:00:01.000Z', '/'),
      makeEvent('e3', 'click_cta', '2026-04-20T10:00:02.000Z', '/'),
    ];
    render(<PipelineEditorial />);
    const feed = screen.getByTestId('pipeline-log-feed');
    expect(feed.textContent).toContain('page_view');
    expect(feed.textContent).toContain('scroll_depth');
    expect(feed.textContent).toContain('click_cta');
  });

  it('caps the footnote feed to 4 visible rows', () => {
    mockLiveEvents = Array.from({ length: 12 }, (_, i) =>
      makeEvent(`e${i}`, `evt_${i}`, '2026-04-20T10:00:00.000Z'),
    );
    render(<PipelineEditorial />);
    const items = screen.getByTestId('pipeline-log-feed').querySelectorAll('li');
    expect(items.length).toBeLessThanOrEqual(4);
  });
});
