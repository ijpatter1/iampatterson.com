/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EventDetail } from '@/components/overlay/event-detail';
import type { PipelineEvent } from '@/lib/events/pipeline-schema';
import { createPipelineEvent } from '@/lib/events/pipeline-schema';

function makeEvent(overrides: Partial<PipelineEvent> = {}): PipelineEvent {
  return createPipelineEvent({
    session_id: 'test-session',
    event_name: 'click_cta',
    timestamp: '2026-03-27T10:00:00Z',
    page_path: '/services',
    page_title: 'Services',
    page_location: 'https://iampatterson.com/services',
    parameters: { cta_text: 'Get Started', cta_location: 'hero' },
    consent: {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functionality_storage: 'granted',
    },
    routing: [
      { destination: 'ga4', status: 'sent', timestamp: '2026-03-27T10:00:01Z' },
      { destination: 'bigquery', status: 'sent', timestamp: '2026-03-27T10:00:01Z' },
      { destination: 'meta_capi', status: 'blocked_consent', timestamp: '2026-03-27T10:00:01Z' },
    ],
    ...overrides,
  });
}

describe('EventDetail', () => {
  it('renders null when no event is provided', () => {
    const { container } = render(<EventDetail event={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the event name as heading', () => {
    render(<EventDetail event={makeEvent()} />);
    expect(screen.getByText('click_cta')).toBeInTheDocument();
  });

  it('shows data layer section with event parameters', () => {
    render(<EventDetail event={makeEvent()} />);
    expect(screen.getByText(/data layer/i)).toBeInTheDocument();
    expect(screen.getByText(/cta_text/)).toBeInTheDocument();
    expect(screen.getByText(/Get Started/)).toBeInTheDocument();
  });

  it('shows page context', () => {
    render(<EventDetail event={makeEvent()} />);
    expect(screen.getByText('/services')).toBeInTheDocument();
  });

  it('shows consent state section', () => {
    render(<EventDetail event={makeEvent()} />);
    expect(screen.getByText('Consent')).toBeInTheDocument();
    expect(screen.getByText('analytics_storage')).toBeInTheDocument();
    expect(screen.getAllByText('granted').length).toBeGreaterThan(0);
  });

  it('shows routing section with all destinations and statuses', () => {
    render(<EventDetail event={makeEvent()} />);
    expect(screen.getByText(/routing/i)).toBeInTheDocument();
    expect(screen.getByText('GA4')).toBeInTheDocument();
    expect(screen.getByText('BigQuery')).toBeInTheDocument();
    expect(screen.getByText('Meta')).toBeInTheDocument();
  });

  it('marks blocked destinations distinctly', () => {
    render(<EventDetail event={makeEvent()} />);
    const metaRow = screen.getByText('Meta').closest('[data-routing-row]');
    expect(metaRow).toBeInTheDocument();
    expect(metaRow!.textContent).toContain('blocked');
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<EventDetail event={makeEvent()} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
