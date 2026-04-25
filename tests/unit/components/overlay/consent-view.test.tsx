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
    expect(screen.getByText(/consent enforcement, live/i)).toBeInTheDocument();
    expect(screen.getByText(/What happens when you/i)).toBeInTheDocument();
  });

  // Phase 10d D8.i: directive now points visitors at the bottom-left
  // Cookiebot widget for consent withdrawal / change. Pin on both the
  // empty-state and the populated-state directives so a regression
  // dropping the pointer fails.
  it('directs visitors to the bottom-left Cookiebot widget (empty state)', () => {
    render(<ConsentView events={[]} />);
    const body = screen.getByText(/click the Cookiebot badge/i);
    expect(body.textContent).toMatch(/bottom-left/i);
    expect(body.textContent).toMatch(/cookiebot/i);
  });

  it('directs visitors to the bottom-left Cookiebot widget (populated state)', () => {
    render(<ConsentView events={[makeEvent()]} />);
    const body = screen.getByText(/click the Cookiebot badge/i);
    expect(body.textContent).toMatch(/bottom-left/i);
    expect(body.textContent).toMatch(/cookiebot/i);
  });

  // Phase 10d D8.j: semantic red/green accents on the consent rows +
  // destination chips. Class presence is the load-bearing regression guard
  // since jsdom doesn't render Tailwind colours.
  it('applies `u-accept` green to granted rows and `u-deny` red to denied rows', () => {
    const { container } = render(<ConsentView events={[makeEvent()]} />);
    const granted = container.querySelector(
      '[data-consent-row][data-consent-state="granted"]',
    ) as HTMLElement;
    const denied = container.querySelector(
      '[data-consent-row][data-consent-state="denied"]',
    ) as HTMLElement;
    expect(granted).not.toBeNull();
    expect(denied).not.toBeNull();
    expect(granted.className).toContain('border-u-accept');
    expect(denied.className).toContain('border-u-deny');
  });

  it('labels destination lists with sent/blocked green/red headers', () => {
    render(<ConsentView events={[makeEvent()]} />);
    const sentHeader = screen.getByText(/sent destinations/i);
    const blockedHeader = screen.getByText(/blocked destinations/i);
    expect(sentHeader.className).toContain('text-u-accept');
    expect(blockedHeader.className).toContain('text-u-deny');
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

  it('shows sent destinations (not blocked by consent)', () => {
    render(<ConsentView events={[makeEvent()]} />);
    // Phase 10d D8.j Pass-1 fix: renamed "Firing destinations" →
    // "Sent destinations" for verb-tense symmetry with "Blocked"
    // destinations (both past-tense state verbs, both matching the
    // routing schema's `sent` / `blocked_consent` terms). Earlier
    // "Firing" was present-participle against "Blocked"'s past-
    // participle, a readability snag the Pass-1 product reviewer flagged.
    expect(screen.getByText(/sent destinations/i)).toBeInTheDocument();
    expect(screen.getByText('GA4', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('BigQuery', { exact: false })).toBeInTheDocument();
  });

  it('shows blocked destinations (blocked by consent)', () => {
    render(<ConsentView events={[makeEvent()]} />);
    // Phase 10d D8.j renamed "Suppressed destinations" → "Blocked
    // destinations" (keeps the semantic pairing with the `blocked_consent`
    // routing status in the schema).
    expect(screen.getByText(/blocked destinations/i)).toBeInTheDocument();
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
