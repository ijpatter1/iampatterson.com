/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import type { PipelineEvent } from '@/lib/events/pipeline-schema';

jest.mock('@/lib/events/session', () => ({
  getSessionId: () => 'aaaaaaaa-12345678',
  readSessionCookie: () => 'aaaaaaaa-12345678',
  subscribeSessionCookie: () => () => {},
  notifySessionCookieChange: () => {},
}));

let mockEvents: PipelineEvent[] = [];
let mockSource: 'sse' | 'dataLayer' = 'dataLayer';
jest.mock('@/hooks/useLiveEvents', () => ({
  useLiveEvents: () => ({ events: mockEvents, source: mockSource, stream: 'connected' }),
}));

let mockConsent: 'granted' | 'denied' | undefined = 'granted';
jest.mock('@/hooks/useAnalyticsConsent', () => ({
  useAnalyticsConsent: () => mockConsent,
}));

import { LiveStrip } from '@/components/chrome/live-strip';
import { LIVE_STRIP } from '@/lib/content/proof';

function makeEvent(
  analytics: 'granted' | 'denied',
  ad: 'granted' | 'denied',
  pipelineId = 'pipe-1760000000000-123456',
): PipelineEvent {
  return {
    pipeline_id: pipelineId,
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
  mockSource = 'dataLayer';
  mockConsent = 'granted';
});

function item(label: string): string {
  const el = screen.getAllByText(label)[0];
  return el.parentElement?.textContent?.replace(label, '') ?? '';
}

describe('LiveStrip', () => {
  it('mounts with the expected data-testid', () => {
    render(<LiveStrip />);
    expect(screen.getByTestId('live-strip')).toBeInTheDocument();
  });

  it('shows the five items of the rewritten strip, each twice for the loop', () => {
    render(<LiveStrip />);
    for (const label of ['SESSION', 'STACK', 'CONSENT', 'EVENT_ID', 'WAREHOUSE']) {
      expect(screen.getAllByText(label)).toHaveLength(2);
    }
  });

  // Metabase is retired and attribution is not what the site is selling.
  it('no longer shows the pipeline, dashboards or attribution items', () => {
    render(<LiveStrip />);
    for (const gone of ['PIPELINE', 'DASHBOARDS', 'ATTRIB']) {
      expect(screen.queryByText(gone)).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/Metabase|Shapley|Looker/)).not.toBeInTheDocument();
  });

  it('shows the same six-character session suffix as the session pulse', () => {
    render(<LiveStrip />);
    expect(item('SESSION')).toBe('345678');
  });

  it('declares the pipeline path and the warehouse table', () => {
    render(<LiveStrip />);
    expect(item('STACK')).toBe(LIVE_STRIP.stack);
    expect(item('WAREHOUSE')).toBe(LIVE_STRIP.warehouse);
  });

  it('shows pending consent before any event has fired', () => {
    render(<LiveStrip />);
    expect(item('CONSENT')).toBe('analytics:pending ad:pending');
  });

  // "Not answered" and "declined" look the same in the stored booleans. A
  // first-time visitor must not be told they declined.
  it('shows pending, not denied, until the visitor has answered the banner', () => {
    mockConsent = undefined;
    mockEvents = [makeEvent('denied', 'denied')];
    render(<LiveStrip />);
    expect(item('CONSENT')).toBe('analytics:pending ad:pending');
  });

  it('shows consent from the most recent event', () => {
    mockEvents = [makeEvent('granted', 'denied')];
    render(<LiveStrip />);
    expect(item('CONSENT')).toBe('analytics:granted ad:denied');
  });

  // The ID is the one the server container assigned on receipt. It is shown
  // only for an event that actually came back over the stream; a data-layer
  // event's local ID is not a pipeline ID and must not be labelled as one.
  describe('EVENT_ID', () => {
    it('shows the newest stream event’s ID suffix, labelled a pipeline id', () => {
      mockSource = 'sse';
      mockEvents = [
        makeEvent('granted', 'denied', 'pipe-1760000000999-654321'),
        makeEvent('granted', 'denied', 'pipe-1760000000000-111111'),
      ];
      render(<LiveStrip />);
      expect(item('EVENT_ID')).toBe('654321 · pipeline id');
    });

    it('shows the placeholder before any event', () => {
      mockSource = 'sse';
      render(<LiveStrip />);
      expect(item('EVENT_ID')).toBe('······ · pipeline id');
    });

    it('shows the placeholder, not a local ID, when the events are data-layer only', () => {
      mockSource = 'dataLayer';
      mockEvents = [makeEvent('denied', 'denied', 'dl-1760000000000-7')];
      render(<LiveStrip />);
      expect(item('EVENT_ID')).toBe('······ · pipeline id');
    });

    it('never calls it a deduplication key', () => {
      mockSource = 'sse';
      mockEvents = [makeEvent('granted', 'denied')];
      render(<LiveStrip />);
      expect(screen.queryByText(/dedup/i)).not.toBeInTheDocument();
    });
  });
});

// Phase 15, deliverable 15.5. The strip is on every page, so it is where a
// visitor who sent Global Privacy Control sees, without opening anything, that
// the site honored it.
describe('LiveStrip, Global Privacy Control', () => {
  afterEach(() => {
    delete (navigator as unknown as { globalPrivacyControl?: unknown }).globalPrivacyControl;
  });

  it('says the signal is honored when the browser sends it and advertising consent is denied', () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });
    mockEvents = [makeEvent('granted', 'denied')];
    render(<LiveStrip />);
    expect(item('CONSENT')).toBe('analytics:granted ad:denied · Global Privacy Control honored');
  });

  // "Honored" is a claim about the consent actually applied. If the strip is
  // showing advertising consent as granted, it must not also say the signal
  // was honored.
  it('does not say honored beside granted advertising consent', () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });
    mockEvents = [makeEvent('granted', 'granted')];
    render(<LiveStrip />);
    expect(screen.queryByText(/honored/)).not.toBeInTheDocument();
  });

  it('does not mention the signal when the browser sends none', () => {
    mockEvents = [makeEvent('granted', 'denied')];
    render(<LiveStrip />);
    expect(screen.queryByText(/Global Privacy Control/)).not.toBeInTheDocument();
  });
});
