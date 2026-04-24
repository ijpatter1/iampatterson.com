/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import type { PipelineEvent } from '@/lib/events/pipeline-schema';

jest.mock('@/lib/events/session', () => ({
  getSessionId: () => 'aaaaaaaa-12345678',
  // Phase 10a D3: useSessionId reads via readSessionCookie and
  // subscribes via subscribeSessionCookie. Mocks must supply the
  // full API surface (passive reader + subscribe/notify channel).
  readSessionCookie: () => 'aaaaaaaa-12345678',
  subscribeSessionCookie: () => () => {},
  notifySessionCookieChange: () => {},
}));

let mockEvents: PipelineEvent[] = [];
jest.mock('@/hooks/useDataLayerEvents', () => ({
  useDataLayerEvents: () => ({ events: mockEvents }),
}));

import { LiveStrip } from '@/components/chrome/live-strip';

function makeEvent(analytics: 'granted' | 'denied', ad: 'granted' | 'denied'): PipelineEvent {
  return {
    pipeline_id: 'ev-1',
    received_at: new Date().toISOString(),
    session_id: 'test',
    event_name: 'page_view',
    timestamp: new Date().toISOString(),
    page_path: '/',
    page_title: '',
    page_location: '',
    parameters: {},
    consent: {
      analytics_storage: analytics,
      ad_storage: ad,
      ad_user_data: ad,
      ad_personalization: ad,
      functionality_storage: 'granted',
    },
    routing: [],
  };
}

beforeEach(() => {
  mockEvents = [];
});

describe('LiveStrip', () => {
  it('mounts with the expected data-testid', () => {
    render(<LiveStrip />);
    expect(screen.getByTestId('live-strip')).toBeInTheDocument();
  });

  it('renders all six ticker fields', () => {
    render(<LiveStrip />);
    expect(screen.getAllByText('SESSION').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('STACK').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('CONSENT').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('PIPELINE').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('DASHBOARDS').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('ATTRIB').length).toBeGreaterThanOrEqual(2);
  });

  it('includes the short session ID suffix in the SESSION field', () => {
    render(<LiveStrip />);
    // 6-char suffix to match SessionPulse, test mock returns 'aaaaaaaa-12345678'
    expect(screen.getAllByText(/345678/).length).toBeGreaterThan(0);
  });

  it('declares the pipeline path in the STACK field', () => {
    render(<LiveStrip />);
    expect(screen.getAllByText(/GTM → sGTM → BigQuery/).length).toBeGreaterThan(0);
  });

  it('shows pending consent state before any event has fired', () => {
    mockEvents = [];
    render(<LiveStrip />);
    expect(screen.getAllByText(/analytics:pending ad:pending/).length).toBeGreaterThan(0);
  });

  it('shows granted/denied consent state from the most recent event', () => {
    mockEvents = [makeEvent('granted', 'denied')];
    render(<LiveStrip />);
    expect(screen.getAllByText(/analytics:granted ad:denied/).length).toBeGreaterThan(0);
  });

  it('mirrors full-grant consent when both analytics and ad are granted', () => {
    mockEvents = [makeEvent('granted', 'granted')];
    render(<LiveStrip />);
    expect(screen.getAllByText(/analytics:granted ad:granted/).length).toBeGreaterThan(0);
  });

  it('declares Metabase (and not Looker) as the dashboards surface', () => {
    render(<LiveStrip />);
    // Looker was declared out of scope in REQUIREMENTS.md 9B-6a
    expect(screen.queryAllByText(/Looker/).length).toBe(0);
    expect(screen.getAllByText(/Metabase/).length).toBeGreaterThan(0);
  });

  it('frames Shapley attribution as planned, not shipped', () => {
    render(<LiveStrip />);
    // Should not claim Shapley is live; honest about the 9D roadmap
    expect(screen.getAllByText(/last-click · Shapley planned/).length).toBeGreaterThan(0);
  });
});
