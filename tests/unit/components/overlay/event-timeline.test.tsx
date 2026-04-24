/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EventTimeline } from '@/components/overlay/event-timeline';
import type { PipelineEvent } from '@/lib/events/pipeline-schema';
import { createPipelineEvent } from '@/lib/events/pipeline-schema';

function makeEvent(overrides: Partial<PipelineEvent> = {}): PipelineEvent {
  return createPipelineEvent({
    session_id: 'test-session',
    event_name: 'page_view',
    timestamp: '2026-03-27T10:00:00Z',
    page_path: '/services',
    page_title: 'Services',
    page_location: 'https://iampatterson.com/services',
    parameters: {},
    consent: {
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      functionality_storage: 'granted',
    },
    routing: [
      { destination: 'ga4', status: 'sent', timestamp: '2026-03-27T10:00:01Z' },
      { destination: 'bigquery', status: 'sent', timestamp: '2026-03-27T10:00:01Z' },
    ],
    ...overrides,
  });
}

describe('EventTimeline', () => {
  it('renders an empty state when no events', () => {
    render(<EventTimeline events={[]} />);
    expect(screen.getByText(/waiting for events/i)).toBeInTheDocument();
  });

  it('renders event names', () => {
    const events = [makeEvent({ event_name: 'page_view' }), makeEvent({ event_name: 'click_cta' })];
    render(<EventTimeline events={events} />);
    expect(screen.getByText('page_view')).toBeInTheDocument();
    expect(screen.getByText('click_cta')).toBeInTheDocument();
  });

  it('renders events in the order provided (most recent first)', () => {
    const events = [
      makeEvent({ event_name: 'click_cta', timestamp: '2026-03-27T10:01:00Z' }),
      makeEvent({ event_name: 'page_view', timestamp: '2026-03-27T10:00:00Z' }),
    ];
    render(<EventTimeline events={events} />);
    const items = screen.getAllByRole('button');
    expect(within(items[0]).getByText('click_cta')).toBeInTheDocument();
    expect(within(items[1]).getByText('page_view')).toBeInTheDocument();
  });

  it('shows routing destination labels for each event', () => {
    const events = [
      makeEvent({
        routing: [
          { destination: 'ga4', status: 'sent', timestamp: '2026-03-27T10:00:01Z' },
          { destination: 'bigquery', status: 'sent', timestamp: '2026-03-27T10:00:01Z' },
          {
            destination: 'meta_capi',
            status: 'blocked_consent',
            timestamp: '2026-03-27T10:00:01Z',
          },
        ],
      }),
    ];
    render(<EventTimeline events={events} />);
    expect(screen.getByText('GA4')).toBeInTheDocument();
    expect(screen.getByText('BigQuery')).toBeInTheDocument();
    expect(screen.getByText('Meta')).toBeInTheDocument();
  });

  it('visually distinguishes blocked destinations', () => {
    const events = [
      makeEvent({
        routing: [
          { destination: 'ga4', status: 'sent', timestamp: '2026-03-27T10:00:01Z' },
          {
            destination: 'meta_capi',
            status: 'blocked_consent',
            timestamp: '2026-03-27T10:00:01Z',
          },
        ],
      }),
    ];
    render(<EventTimeline events={events} />);
    const metaBadge = screen.getByText('Meta');
    expect(metaBadge.className).toContain('line-through');
  });

  it('shows page path for each event', () => {
    const events = [makeEvent({ page_path: '/about' })];
    render(<EventTimeline events={events} />);
    expect(screen.getByText('/about')).toBeInTheDocument();
  });

  it('calls onSelectEvent when an event is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    const event = makeEvent({ event_name: 'scroll_depth' });
    render(<EventTimeline events={[event]} onSelectEvent={onSelect} />);
    await user.click(screen.getByText('scroll_depth'));
    expect(onSelect).toHaveBeenCalledWith(event);
  });

  it('highlights the selected event', () => {
    const events = [
      makeEvent({ pipeline_id: 'ev-1', event_name: 'page_view' }),
      makeEvent({ pipeline_id: 'ev-2', event_name: 'click_cta' }),
    ];
    render(<EventTimeline events={events} selectedEventId="ev-1" />);
    const items = screen.getAllByRole('button');
    expect(items[0].className).toContain('ring');
  });

  // ---------------------------------------------------------------------------
  // Phase 10b D6 — Overlay rendering performance
  // ---------------------------------------------------------------------------

  describe('D6 — 100-event session render', () => {
    it('renders 100 events cleanly without console errors and produces 100 list items', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const events = Array.from({ length: 100 }, (_, i) =>
          makeEvent({
            pipeline_id: `ev-${i}`,
            event_name: i % 2 === 0 ? 'page_view' : 'click_cta',
            timestamp: `2026-03-27T10:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}Z`,
            page_path: `/route/${i}`,
          }),
        );
        const t0 = performance.now();
        render(<EventTimeline events={events} />);
        const renderMs = performance.now() - t0;

        // Sanity: all 100 rows present
        const items = screen.getAllByRole('button');
        expect(items).toHaveLength(100);

        // No console noise (bad keys, missing accessibility props, etc.)
        expect(consoleErrorSpy).not.toHaveBeenCalled();

        // Generous ceiling — jest in jsdom with a warm cache runs
        // EventTimeline with 100 rows in ~20-60ms on typical dev hardware;
        // the 500ms threshold catches catastrophic regressions (e.g.
        // accidentally quadratic rendering) without flaking on CI
        // variance. Tightening this further is a hazard: jsdom + CI
        // shared-runner timing noise can easily push a clean render
        // into the hundreds.
        expect(renderMs).toBeLessThan(500);
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('prepending a single new event does not remount existing rows (DOM-node reuse via keys)', () => {
      // Key-based reconciliation fingerprint: when a new event arrives
      // over SSE, the existing 100 rows should keep their DOM identity
      // so scroll position + focus + any row-level CSS transitions
      // aren't disrupted. Guards against someone accidentally changing
      // the key from pipeline_id to a rendering-order index, which
      // would remount every row on prepend.
      const initial = Array.from({ length: 100 }, (_, i) =>
        makeEvent({
          pipeline_id: `ev-${i}`,
          event_name: 'page_view',
          page_path: `/r${i}`,
        }),
      );
      const { rerender } = render(<EventTimeline events={initial} />);
      const initialLast = screen.getAllByRole('button').slice(-1)[0];

      const prepended = [
        makeEvent({ pipeline_id: 'ev-NEW', event_name: 'click_cta', page_path: '/new' }),
        ...initial,
      ];
      rerender(<EventTimeline events={prepended} />);

      const afterItems = screen.getAllByRole('button');
      expect(afterItems).toHaveLength(101);
      // Same DOM element reference → React kept the row across renders
      expect(afterItems[afterItems.length - 1]).toBe(initialLast);
    });
  });
});
