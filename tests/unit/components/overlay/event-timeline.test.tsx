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
    expect(screen.getByText(/no events/i)).toBeInTheDocument();
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
});
