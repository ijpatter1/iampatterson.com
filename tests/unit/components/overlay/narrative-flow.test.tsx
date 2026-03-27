/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { NarrativeFlow } from '@/components/overlay/narrative-flow';
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

describe('NarrativeFlow', () => {
  it('renders null when no event is provided', () => {
    const { container } = render(<NarrativeFlow event={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows a user action description for page_view', () => {
    render(
      <NarrativeFlow event={makeEvent({ event_name: 'page_view', page_path: '/services' })} />,
    );
    expect(screen.getByText(/viewed/i)).toBeInTheDocument();
    expect(screen.getByText(/\/services/)).toBeInTheDocument();
  });

  it('shows a user action description for click_cta', () => {
    render(
      <NarrativeFlow
        event={makeEvent({
          event_name: 'click_cta',
          parameters: { cta_text: 'Get Started' },
        })}
      />,
    );
    expect(screen.getByText(/clicked/i)).toBeInTheDocument();
    expect(screen.getByText(/Get Started/)).toBeInTheDocument();
  });

  it('shows a user action description for form_submit', () => {
    render(
      <NarrativeFlow
        event={makeEvent({
          event_name: 'form_submit',
          parameters: { form_name: 'contact' },
        })}
      />,
    );
    expect(screen.getByText(/submitted/i)).toBeInTheDocument();
  });

  it('shows the pipeline stages (data layer → sGTM → destinations)', () => {
    render(<NarrativeFlow event={makeEvent()} />);
    expect(screen.getByText(/data layer/i)).toBeInTheDocument();
    expect(screen.getByText(/sGTM/i)).toBeInTheDocument();
  });

  it('shows destination names from routing', () => {
    render(
      <NarrativeFlow
        event={makeEvent({
          routing: [
            { destination: 'ga4', status: 'sent', timestamp: '2026-03-27T10:00:01Z' },
            { destination: 'bigquery', status: 'sent', timestamp: '2026-03-27T10:00:01Z' },
            {
              destination: 'meta_capi',
              status: 'blocked_consent',
              timestamp: '2026-03-27T10:00:01Z',
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/GA4/)).toBeInTheDocument();
    expect(screen.getByText(/BigQuery/)).toBeInTheDocument();
    expect(screen.getByText(/Meta/)).toBeInTheDocument();
  });

  it('indicates when a destination is blocked by consent', () => {
    render(
      <NarrativeFlow
        event={makeEvent({
          routing: [
            {
              destination: 'meta_capi',
              status: 'blocked_consent',
              timestamp: '2026-03-27T10:00:01Z',
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/blocked/i)).toBeInTheDocument();
  });

  it('shows arrow connectors between stages', () => {
    render(<NarrativeFlow event={makeEvent()} />);
    const arrows = screen.getAllByTestId('flow-arrow');
    expect(arrows.length).toBeGreaterThanOrEqual(2);
  });
});
