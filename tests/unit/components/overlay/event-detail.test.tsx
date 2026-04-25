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

  // Phase 10d D8.j Pass-1 fix: EventDetail renders inside the Timeline tab
  // when a visitor clicks any event row, so the `u-accept`/`u-deny`
  // recolour has to reach the routing badges here too. Pin on the
  // data-routing-state attribute + the class-presence on sent/blocked
  // states so a regression that flips them back to accent-current /
  // u-ink-4 fails.
  it('routing badges carry u-accept/u-deny semantic colours (D8.j)', () => {
    const { container } = render(<EventDetail event={makeEvent()} />);
    const sent = container.querySelector('[data-routing-state="sent"]') as HTMLElement;
    const blocked = container.querySelector(
      '[data-routing-state="blocked_consent"]',
    ) as HTMLElement;
    expect(sent).not.toBeNull();
    expect(blocked).not.toBeNull();
    expect(sent.className).toContain('text-u-accept');
    expect(blocked.className).toContain('text-u-deny');
  });

  it('consent rows use u-accept/u-deny + ✓/× glyph (D8.j)', () => {
    const { container } = render(<EventDetail event={makeEvent()} />);
    const granted = container.querySelector(
      '[data-consent-row][data-consent-state="granted"]',
    ) as HTMLElement;
    const denied = container.querySelector(
      '[data-consent-row][data-consent-state="denied"]',
    ) as HTMLElement;
    expect(granted).not.toBeNull();
    expect(denied).not.toBeNull();
    expect(granted.textContent).toContain('✓');
    expect(denied.textContent).toContain('×');
    expect(granted.querySelector('.text-u-accept')).not.toBeNull();
    expect(denied.querySelector('.text-u-deny')).not.toBeNull();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<EventDetail event={makeEvent()} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
