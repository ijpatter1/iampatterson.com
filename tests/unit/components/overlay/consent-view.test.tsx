/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { ConsentView } from '@/components/overlay/consent-view';
import type { PipelineEvent } from '@/lib/events/pipeline-schema';
import { createPipelineEvent } from '@/lib/events/pipeline-schema';

function makeEvent(overrides: Partial<PipelineEvent> = {}): PipelineEvent {
  return createPipelineEvent({
    session_id: 'test-session',
    event_name: 'page_view',
    timestamp: '2026-03-27T10:00:00Z',
    page_path: '/',
    page_title: 'Home',
    page_location: 'https://iampatterson.com/',
    parameters: {},
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
      { destination: 'google_ads', status: 'blocked_consent', timestamp: '2026-03-27T10:00:01Z' },
    ],
    ...overrides,
  });
}

describe('ConsentView', () => {
  it('renders an empty-state placeholder when no events have landed yet', () => {
    render(<ConsentView events={[]} />);
    // Editorial empty state: kicker + headline + prompt
    expect(screen.getByText(/consent enforcement — live/i)).toBeInTheDocument();
    expect(screen.getByText(/What happens when you/i)).toBeInTheDocument();
  });

  it('shows consent state from the most recent event', () => {
    render(<ConsentView events={[makeEvent()]} />);
    expect(screen.getByText('analytics_storage')).toBeInTheDocument();
    expect(screen.getByText('ad_storage')).toBeInTheDocument();
  });

  it('shows granted signals with granted styling', () => {
    render(<ConsentView events={[makeEvent()]} />);
    const analyticsRow = screen.getByText('analytics_storage').closest('[data-consent-row]');
    expect(analyticsRow).toBeInTheDocument();
    expect(analyticsRow!.textContent).toContain('granted');
  });

  it('shows denied signals with denied styling', () => {
    render(<ConsentView events={[makeEvent()]} />);
    const adRow = screen.getByText('ad_storage').closest('[data-consent-row]');
    expect(adRow).toBeInTheDocument();
    expect(adRow!.textContent).toContain('denied');
  });

  it('shows active destinations (not blocked by consent)', () => {
    render(<ConsentView events={[makeEvent()]} />);
    expect(screen.getByText(/active destinations/i)).toBeInTheDocument();
    expect(screen.getByText('GA4', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('BigQuery', { exact: false })).toBeInTheDocument();
  });

  it('shows suppressed destinations (blocked by consent)', () => {
    render(<ConsentView events={[makeEvent()]} />);
    expect(screen.getByText(/suppressed destinations/i)).toBeInTheDocument();
    expect(screen.getByText('Meta', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Google Ads', { exact: false })).toBeInTheDocument();
  });

  it('updates when events change (uses latest consent state)', () => {
    const denied = makeEvent({
      consent: {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        functionality_storage: 'denied',
      },
      routing: [
        { destination: 'ga4', status: 'blocked_consent', timestamp: '2026-03-27T10:00:01Z' },
      ],
    });
    const { rerender } = render(<ConsentView events={[makeEvent()]} />);
    rerender(<ConsentView events={[denied]} />);
    const analyticsRow = screen.getByText('analytics_storage').closest('[data-consent-row]');
    expect(analyticsRow!.textContent).toContain('denied');
  });
});
