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
  // Pin a known session ID so the footnote ID is deterministic.
  document.cookie = '_iap_sid=fixed-session-abc123def; path=/';
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

  it('caps the footnote feed to exactly 4 visible rows when the buffer overflows', () => {
    mockLiveEvents = Array.from({ length: 12 }, (_, i) =>
      makeEvent(`e${i}`, `evt_${i}`, '2026-04-20T10:00:00.000Z'),
    );
    render(<PipelineEditorial />);
    const items = screen.getByTestId('pipeline-log-feed').querySelectorAll('li');
    expect(items).toHaveLength(4);
  });

  it('shows the NEWEST live events in the visible window when the buffer overflows', () => {
    // useLiveEvents returns events newest-first. With >4 live events, the
    // visible window must track the most recent activity (not the oldest
    // four still in the buffer). We send 12 distinct events and assert
    // that at least the absolute-newest one (e0 — useLiveEvents emits
    // newest-first) is present in the rendered feed; an older one (e10)
    // should NOT be visible.
    mockLiveEvents = Array.from({ length: 12 }, (_, i) =>
      makeEvent(`evt-${i}`, `evt_${i}`, `2026-04-20T10:00:0${i}.000Z`),
    );
    render(<PipelineEditorial />);
    const feed = screen.getByTestId('pipeline-log-feed');
    expect(feed.textContent).toContain('evt_0');
    expect(feed.textContent).not.toContain('evt_11');
  });

  it('renders distinct timestamps per live event (no render-tick lockstep)', () => {
    // Two events 5 seconds apart in source data MUST render with different
    // timestamps. The pre-fix implementation stamped Date.now() on every
    // row at render time, so all live rows shared a single value.
    const t0 = '2026-04-20T10:00:00.000Z';
    const t5 = '2026-04-20T10:00:05.000Z';
    mockLiveEvents = [makeEvent('e1', 'page_view', t0), makeEvent('e2', 'scroll_depth', t5)];
    render(<PipelineEditorial />);
    const feed = screen.getByTestId('pipeline-log-feed');
    const items = Array.from(feed.querySelectorAll('li'));
    const tsCells = items.map((li) => li.querySelector('.t')?.textContent ?? '');
    // Two visible live rows (after seeds slide out) — their timestamps
    // must not all be the same value. Use Set size as the witness.
    const liveTsCells = tsCells.slice(-2);
    expect(new Set(liveTsCells).size).toBe(2);
  });

  it('renders the real session ID (last 6 chars) in the footnote header', () => {
    render(<PipelineEditorial />);
    const idEl = screen.getByTestId('pipeline-footnote-session');
    // Cookie is fixed-session-abc123def → last 6 chars = '123def'
    expect(idEl.textContent).toBe('ses_123def');
  });

  it('renders stage.detail copy on each stage', () => {
    render(<PipelineEditorial />);
    // stage.detail strings from PIPELINE_STAGES — must reach the DOM.
    PIPELINE_STAGES.forEach((s) => {
      expect(screen.getByText(s.detail)).toBeInTheDocument();
    });
  });

  it('renders inter-stage ↓ arrows between every pair of consecutive stages (4 total)', () => {
    const { container } = render(<PipelineEditorial />);
    const arrows = container.querySelectorAll('.pv-edit__arrow');
    expect(arrows).toHaveLength(PIPELINE_STAGES.length - 1);
    arrows.forEach((a) => {
      expect(a.textContent).toBe('↓');
      expect(a.getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('marks numeral spans as aria-hidden so screen readers do not double-count', () => {
    const { container } = render(<PipelineEditorial />);
    const numerals = container.querySelectorAll('.pv-edit__num');
    expect(numerals.length).toBe(PIPELINE_STAGES.length);
    numerals.forEach((n) => {
      expect(n.getAttribute('aria-hidden')).toBe('true');
    });
  });
});
