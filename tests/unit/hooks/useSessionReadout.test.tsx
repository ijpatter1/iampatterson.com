/**
 * @jest-environment jsdom
 */
import { render, renderHook, screen } from '@testing-library/react';

import type { PipelineEvent } from '@/lib/events/pipeline-schema';
import type { SessionState } from '@/lib/session-state/types';

jest.mock('@/lib/events/session', () => ({
  getSessionId: () => 'cookie00-aaaaaa',
  readSessionCookie: () => 'cookie00-aaaaaa',
  subscribeSessionCookie: () => () => {},
  notifySessionCookieChange: () => {},
}));

let mockEvents: PipelineEvent[] = [];
jest.mock('@/hooks/useLiveEvents', () => ({
  useLiveEvents: () => ({ events: mockEvents, source: 'dataLayer', stream: 'off' }),
}));

let mockConsent: 'granted' | 'denied' | undefined = 'granted';
jest.mock('@/hooks/useAnalyticsConsent', () => ({
  useAnalyticsConsent: () => mockConsent,
}));

let mockSessionState: SessionState | null = null;
jest.mock('@/components/session-state-provider', () => ({
  useSessionState: () => mockSessionState,
}));

import { LiveStrip } from '@/components/chrome/live-strip';
import { ProofPanel } from '@/components/home/proof-panel';
import { useSessionReadout } from '@/hooks/useSessionReadout';

function persisted(overrides: Partial<SessionState> = {}): SessionState {
  return {
    session_id: 'persist0-zzzzzz',
    events_fired: { page_view: 3, scroll_depth: 4 },
    consent_snapshot: { analytics: 'granted', marketing: 'denied', preferences: 'granted' },
    ...overrides,
  } as unknown as SessionState;
}

function liveEvent(): PipelineEvent {
  return {
    pipeline_id: 'dl-1-1',
    event_name: 'page_view',
    timestamp: '2026-10-12T10:00:00Z',
    consent: {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functionality_storage: 'denied',
    },
    routing: [],
  } as unknown as PipelineEvent;
}

beforeEach(() => {
  mockEvents = [];
  mockConsent = 'granted';
  mockSessionState = null;
});

// What nearly every visitor gets is the persisted branch: the live buffer is
// empty after a reload, so reading it alone would reset the session's count
// and consent on every refresh.
describe('useSessionReadout', () => {
  it('reads the suffix, consent and count from the persisted session when there is one', () => {
    mockSessionState = persisted();
    mockEvents = [liveEvent()];
    const { result } = renderHook(() => useSessionReadout());
    expect(result.current).toEqual({
      shortId: 'zzzzzz',
      consent: { analytics: 'granted', ad: 'denied' },
      eventCount: 7,
    });
  });

  it('falls back to the cookie and the live buffer before the session has loaded', () => {
    mockEvents = [liveEvent(), liveEvent()];
    const { result } = renderHook(() => useSessionReadout());
    expect(result.current).toEqual({
      shortId: 'aaaaaa',
      consent: { analytics: 'denied', ad: 'denied' },
      eventCount: 2,
    });
  });

  it('reads consent as pending until the banner is answered, whatever is stored', () => {
    mockConsent = undefined;
    mockSessionState = persisted({
      consent_snapshot: { analytics: 'denied', marketing: 'denied', preferences: 'denied' },
    } as Partial<SessionState>);
    const { result } = renderHook(() => useSessionReadout());
    expect(result.current.consent).toEqual({ analytics: 'pending', ad: 'pending' });
    expect(result.current.eventCount).toBe(7);
  });

  // The strip and the panel describe the same visitor, on the same screen.
  it('gives the LiveStrip and the proof panel the same session, consent and count', () => {
    mockSessionState = persisted();
    render(
      <>
        <LiveStrip />
        <ProofPanel onOpen={() => {}} />
      </>,
    );
    const strip = screen.getByTestId('live-strip');
    const header = screen.getByTestId('proof-header');
    expect(strip).toHaveTextContent('SESSIONzzzzzz');
    expect(header).toHaveTextContent('Session zzzzzz');
    expect(strip).toHaveTextContent('analytics:granted ad:denied');
    expect(header).toHaveTextContent('analytics:granted · ad:denied');
    expect(header).toHaveTextContent('7 events');
  });
});
