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
    // useLiveEvents returns events newest-first in production
    // (useDataLayerEvents.ts:146 prepends; useEventStream.ts:101 prepends).
    // The fixture MUST match that contract — otherwise the test passes
    // for the wrong reason. Build the array newest-first: evt_11 (latest
    // timestamp) at index 0, evt_0 (earliest) at index 11.
    //
    // Component pipeline:
    //   slice(0, BUFFER=12) → [evt_11, evt_10, ..., evt_0] (newest first)
    //   .reverse()          → [evt_0, evt_1, ..., evt_11]   (chronological)
    //   prepend 3 seeds, take trailing 4 → [evt_8, evt_9, evt_10, evt_11]
    // So the visible window is the 4 NEWEST events, in chronological order.
    mockLiveEvents = Array.from({ length: 12 }, (_, i) => {
      // i=0 → newest (evt_11, timestamp T+11s); i=11 → oldest (evt_0, T+0s).
      const idx = 11 - i;
      const ts = `2026-04-20T10:00:${String(idx).padStart(2, '0')}.000Z`;
      return makeEvent(`evt-${idx}`, `evt_${idx}`, ts);
    });
    render(<PipelineEditorial />);
    const feed = screen.getByTestId('pipeline-log-feed');
    const eventNames = Array.from(feed.querySelectorAll('.e')).map((el) => el.textContent);
    expect(eventNames).toEqual(['evt_8', 'evt_9', 'evt_10', 'evt_11']);
    // Belt-and-braces: an older event (evt_0..evt_7) must not be visible.
    // Check the parsed eventNames array (not textContent) so `evt_1` doesn't
    // false-match against `evt_10` / `evt_11` substrings in the joined text.
    for (let i = 0; i <= 7; i++) {
      expect(eventNames).not.toContain(`evt_${i}`);
    }
  });

  it('renders distinct timestamps per live event (no render-tick lockstep)', () => {
    // Two events 5 seconds apart in source data MUST render with different
    // timestamps. The pre-fix implementation stamped Date.now() on every
    // row at render time, so all live rows shared a single value.
    //
    // CRITICAL: Both `Date.now()` (used by startedAtRef inside the
    // component) AND the fixture timestamps must be controlled. Without
    // mocking Date.now, this test is wall-clock flaky — once real time
    // passes the fixture timestamps, both deltas become negative,
    // `fmtRelTime` clamps via `Math.max(0, ...)`, and both rows render
    // as `00:00.00` → the Set collapses to size 1 → false-fail. Lock
    // Date.now to a value strictly before the earliest fixture.
    const mountTime = Date.parse('2026-04-20T09:59:00.000Z');
    const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(mountTime);
    try {
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
    } finally {
      // try/finally so a failed assertion doesn't leak the spy into the
      // next test (no project-wide restoreMocks: true in jest.config).
      dateSpy.mockRestore();
    }
  });

  it('renders the real session ID (last 6 chars) in the footnote header', () => {
    render(<PipelineEditorial />);
    const idEl = screen.getByTestId('pipeline-footnote-session');
    // Cookie is fixed-session-abc123def → last 6 chars = '123def'
    expect(idEl.textContent).toBe('ses_123def');
  });

  it('renders stage.detail copy on each stage (prose + inline code fragments)', () => {
    // F6 rewrite: detail copy can contain backtick-fenced tokens that
    // render as <code>. getByText with a string matcher won't work
    // because the text is split across elements. Search by role/heading
    // then scan the stage list item's combined textContent with the
    // backticks stripped out.
    const { container } = render(<PipelineEditorial />);
    const stageItems = Array.from(container.querySelectorAll('[data-testid^="pipeline-stage-"]'));
    expect(stageItems).toHaveLength(PIPELINE_STAGES.length);
    PIPELINE_STAGES.forEach((stage, i) => {
      const expected = stage.detail.replace(/`/g, '');
      const actual = (stageItems[i].textContent ?? '').replace(/\s+/g, ' ').trim();
      expect(actual).toContain(expected);
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
