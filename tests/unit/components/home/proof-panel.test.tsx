/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { PipelineEvent, RoutingResult } from '@/lib/events/pipeline-schema';

jest.mock('@/lib/events/session', () => ({
  getSessionId: () => 'aaaaaaaa-12345678',
  readSessionCookie: () => 'aaaaaaaa-12345678',
  subscribeSessionCookie: () => () => {},
  notifySessionCookieChange: () => {},
}));

let mockEvents: PipelineEvent[] = [];
let mockSource: 'sse' | 'dataLayer' = 'sse';
let mockStream: 'off' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' = 'connected';
jest.mock('@/hooks/useLiveEvents', () => ({
  useLiveEvents: () => ({ events: mockEvents, source: mockSource, stream: mockStream }),
}));

let mockConsent: 'granted' | 'denied' | undefined = 'granted';
jest.mock('@/hooks/useAnalyticsConsent', () => ({
  useAnalyticsConsent: () => mockConsent,
}));

jest.mock('@/lib/events/track', () => ({
  trackClickCta: jest.fn(),
}));

import { ProofPanel } from '@/components/home/proof-panel';
import { ProofSection } from '@/components/home/proof-section';
import { OverlayProvider, useOverlay } from '@/components/overlay/overlay-context';
import { PROOF } from '@/lib/content/proof';
import { trackClickCta } from '@/lib/events/track';

const SENT = (destination: string): RoutingResult => ({
  destination,
  status: 'sent',
  timestamp: '2026-10-12T10:00:01Z',
});
const BLOCKED = (destination: string): RoutingResult => ({
  destination,
  status: 'blocked_consent',
  timestamp: '2026-10-12T10:00:01Z',
});

/** Routing as `useDataLayerEvents` builds it for a browser-only event. */
function dataLayerRouting(analytics: boolean, marketing: boolean): RoutingResult[] {
  const a = analytics ? SENT : BLOCKED;
  const m = analytics && marketing ? SENT : BLOCKED;
  return [a('ga4'), a('bigquery'), a('pubsub'), m('meta_capi'), m('google_ads')];
}

/** Routing as the server container's Pub/Sub tag builds it for a stream event. */
function streamRouting(analytics: boolean): RoutingResult[] {
  const a = analytics ? SENT : BLOCKED;
  return [a('ga4'), a('bigquery'), SENT('pubsub')];
}

let n = 0;
function makeEvent(name: string, routing: RoutingResult[], id?: string): PipelineEvent {
  n += 1;
  return {
    pipeline_id: id ?? `pipe-17600000000${String(n).padStart(2, '0')}-${100000 + n}`,
    received_at: '2026-10-12T10:00:01Z',
    session_id: 'aaaaaaaa-12345678',
    event_name: name,
    timestamp: `2026-10-12T10:00:${String(n).padStart(2, '0')}Z`,
    page_path: '/',
    page_title: '',
    page_location: '',
    parameters: {},
    consent: {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functionality_storage: 'granted',
    },
    routing,
  };
}

function Probe() {
  const { isOpen, pendingTab } = useOverlay();
  return <span data-testid="overlay-status">{isOpen ? `open:${pendingTab}` : 'closed'}</span>;
}

const onOpen = jest.fn();

function renderPanel() {
  return render(<ProofPanel onOpen={onOpen} />);
}

const rows = () => screen.queryAllByTestId('proof-row');

beforeEach(() => {
  jest.clearAllMocks();
  onOpen.mockClear();
  n = 0;
  mockEvents = [];
  mockSource = 'sse';
  mockStream = 'connected';
  mockConsent = 'granted';
});

// The panel is the page's evidence for its own claim: "this site runs the
// stack it describes". So everything on it has to be something the browser
// actually observed for this visitor. Nothing illustrative, nothing inferred.
describe('ProofPanel', () => {
  describe('what it shows when there is nothing to list', () => {
    // An undecided visitor already has a page_view in the data layer. Listing
    // it beside "No tag fires until you choose" would muddle the one point the
    // panel makes at this moment, so the gate message wins.
    it('shows the consent-gate message for a visitor who has not chosen, even if events exist', () => {
      mockConsent = undefined;
      mockSource = 'dataLayer';
      mockEvents = [makeEvent('page_view', dataLayerRouting(false, false), 'dl-1-0')];
      renderPanel();
      expect(screen.getByText(PROOF.panel.notChosen)).toBeInTheDocument();
      expect(rows()).toHaveLength(0);
    });

    it('asks a visitor who has chosen to scroll, when no event has fired yet', () => {
      mockConsent = 'granted';
      renderPanel();
      expect(screen.getByText(PROOF.panel.waiting)).toBeInTheDocument();
      expect(screen.queryByText(PROOF.panel.notChosen)).not.toBeInTheDocument();
    });

    // A decliner's own events, marked blocked, are the stronger demonstration.
    it('shows no empty message to a visitor who declined: they get their blocked events', () => {
      mockConsent = 'denied';
      mockSource = 'dataLayer';
      mockEvents = [makeEvent('scroll_depth', dataLayerRouting(false, false), 'dl-1-9')];
      renderPanel();
      expect(screen.queryByText(PROOF.panel.notChosen)).not.toBeInTheDocument();
      expect(screen.queryByText(PROOF.panel.waiting)).not.toBeInTheDocument();
      expect(rows()).toHaveLength(1);
    });
  });

  describe('rows', () => {
    it('lists at most four events, the newest last', () => {
      // The hook returns newest first.
      mockEvents = ['e6', 'e5', 'e4', 'e3', 'e2', 'e1'].map((name) =>
        makeEvent(name, streamRouting(true)),
      );
      renderPanel();
      expect(rows().map((r) => within(r).getByTestId('proof-row-name').textContent)).toEqual([
        'e3',
        'e4',
        'e5',
        'e6',
      ]);
    });

    it('shows time, event name and the pipeline ID suffix for a stream event', () => {
      mockEvents = [makeEvent('click_cta', streamRouting(true), 'pipe-1760000000000-654321')];
      renderPanel();
      const row = rows()[0];
      expect(within(row).getByTestId('proof-row-name')).toHaveTextContent('click_cta');
      expect(within(row).getByTestId('proof-row-id')).toHaveTextContent('654321');
      expect(within(row).getByTestId('proof-row-time').textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });

    it('lists where the server sent a stream event', () => {
      mockEvents = [makeEvent('page_view', streamRouting(true))];
      renderPanel();
      expect(within(rows()[0]).getByTestId('proof-row-sent').textContent).toBe(
        'sent GA4, BigQuery, Pub/Sub',
      );
    });

    // The server stamps GA4 and BigQuery "blocked" from the consent flags, but
    // an event that came back over the stream was forwarded. Saying "blocked"
    // on it would contradict the event's own presence.
    it('never shows a blocked line on a stream row', () => {
      mockEvents = [makeEvent('consent_update', streamRouting(false))];
      renderPanel();
      const row = rows()[0];
      expect(within(row).queryByTestId('proof-row-blocked')).not.toBeInTheDocument();
      expect(within(row).getByTestId('proof-row-sent').textContent).toBe('sent Pub/Sub');
    });

    // A data-layer row never went to the server, so the browser can say for
    // certain what consent blocked, and nothing about what was delivered.
    it('shows a declined visitor\u2019s row as blocked, with the reason, no pipeline ID and no "sent"', () => {
      mockConsent = 'denied';
      mockSource = 'dataLayer';
      mockEvents = [
        makeEvent('scroll_depth', dataLayerRouting(false, false), 'dl-1760000000000-3'),
      ];
      renderPanel();
      const row = rows()[0];
      expect(within(row).getByTestId('proof-row-blocked').textContent).toBe(
        `blocked GA4, BigQuery, Pub/Sub · ${PROOF.panel.blockedReason}`,
      );
      expect(within(row).queryByTestId('proof-row-sent')).not.toBeInTheDocument();
      expect(within(row).queryByTestId('proof-row-id')).not.toBeInTheDocument();
      expect(row).not.toHaveTextContent('dl-');
    });

    // The site has no live Meta or Google Ads integration. Its event routing
    // names both because simulated tags exist; on the homepage that would read
    // as the real thing.
    it('never names an advertising destination, sent or blocked', () => {
      mockConsent = 'denied';
      mockSource = 'dataLayer';
      mockEvents = [
        makeEvent('scroll_depth', dataLayerRouting(false, false), 'dl-1-1'),
        makeEvent('consent_update', dataLayerRouting(true, true), 'dl-1-2'),
      ];
      renderPanel();
      expect(screen.getByTestId('proof-panel')).not.toHaveTextContent(/Meta|Google Ads/);
    });

    it('shows only the name for a data-layer row that nothing blocked', () => {
      mockSource = 'dataLayer';
      mockStream = 'off';
      mockEvents = [makeEvent('page_view', dataLayerRouting(true, false), 'dl-1760000000000-1')];
      renderPanel();
      const row = rows()[0];
      expect(within(row).getByTestId('proof-row-name')).toHaveTextContent('page_view');
      expect(within(row).queryByTestId('proof-row-sent')).not.toBeInTheDocument();
      expect(within(row).queryByTestId('proof-row-blocked')).not.toBeInTheDocument();
      expect(within(row).queryByTestId('proof-row-id')).not.toBeInTheDocument();
    });

    // The one exception: the consent update is exempt from the gate and is
    // sent, so that the choice itself is recorded.
    it('shows the consent update as sent for a declined visitor', () => {
      mockConsent = 'denied';
      mockSource = 'dataLayer';
      // The data layer marks an exempt event sent to the three real
      // destinations whatever the analytics choice.
      mockEvents = [makeEvent('consent_update', dataLayerRouting(true, false), 'dl-1-1')];
      renderPanel();
      const row = rows()[0];
      expect(within(row).getByTestId('proof-row-sent').textContent).toBe(
        'sent GA4, BigQuery, Pub/Sub',
      );
      expect(within(row).queryByTestId('proof-row-blocked')).not.toBeInTheDocument();
    });
  });

  describe('when the live stream is not connected', () => {
    it('says so above the browser’s own events', () => {
      mockSource = 'dataLayer';
      mockStream = 'off';
      mockEvents = [makeEvent('page_view', [], 'dl-1-1')];
      renderPanel();
      expect(screen.getByText(PROOF.panel.notConnected)).toBeInTheDocument();
      expect(rows()).toHaveLength(1);
    });

    it.each(['disconnected', 'reconnecting', 'connecting'] as const)(
      'says so while the connection is %s and the rows are the browser\u2019s own',
      (state) => {
        mockSource = 'dataLayer';
        mockStream = state;
        mockEvents = [makeEvent('page_view', [], 'dl-1-1')];
        renderPanel();
        expect(screen.getByText(PROOF.panel.notConnected)).toBeInTheDocument();
      },
    );

    it('does not say so while the stream is connected', () => {
      mockEvents = [makeEvent('page_view', streamRouting(true))];
      renderPanel();
      expect(screen.queryByText(PROOF.panel.notConnected)).not.toBeInTheDocument();
    });

    // A decliner is shown data-layer events by design. That is not a broken
    // stream and must not be described as one.
    it('does not say so to a visitor who declined', () => {
      mockConsent = 'denied';
      mockSource = 'dataLayer';
      mockStream = 'connected';
      mockEvents = [makeEvent('scroll_depth', dataLayerRouting(false, false), 'dl-1-1')];
      renderPanel();
      expect(screen.queryByText(PROOF.panel.notConnected)).not.toBeInTheDocument();
    });
  });

  describe('header', () => {
    // The stored consent is built from booleans, so "not answered" and
    // "declined" look the same there. Above "Choose in the banner", the header
    // must not say the visitor already declined.
    it('reads pending, not denied, for a visitor who has not chosen', () => {
      mockConsent = undefined;
      mockSource = 'dataLayer';
      mockEvents = [makeEvent('page_view', dataLayerRouting(false, false), 'dl-1-1')];
      renderPanel();
      expect(screen.getByTestId('proof-header')).toHaveTextContent(
        'Consent analytics:pending · ad:pending',
      );
    });

    it('shows the session suffix, the consent pair and the event count', () => {
      mockEvents = [makeEvent('page_view', streamRouting(true)), makeEvent('scroll_depth', [])];
      renderPanel();
      const header = screen.getByTestId('proof-header');
      expect(header).toHaveTextContent('Session 345678');
      expect(header).toHaveTextContent('Consent analytics:granted · ad:denied');
      expect(header).toHaveTextContent('2 events');
    });
  });

  it('opens on a click anywhere on it', async () => {
    mockEvents = [makeEvent('page_view', streamRouting(true))];
    renderPanel();
    await userEvent.click(screen.getByTestId('proof-row-name'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  // The panel is evidence, so it has to be readable: a control whose label
  // replaces its content would hide the session, the consent state and the
  // rows from a screen reader.
  it('is a readable region, not a button that hides its own content', () => {
    mockEvents = [makeEvent('page_view', streamRouting(true))];
    renderPanel();
    const panel = screen.getByRole('group', { name: PROOF.panel.regionLabel });
    expect(panel.tagName).not.toBe('BUTTON');
    expect(within(panel).getByText('page_view')).toBeInTheDocument();
  });
});

describe('ProofSection', () => {
  function renderSection() {
    return render(
      <OverlayProvider>
        <ProofSection />
        <Probe />
      </OverlayProvider>,
    );
  }

  it('is the #proof anchor, with the heading, the paragraph and the panel', () => {
    const { container } = renderSection();
    expect(container.querySelector('section#proof')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: PROOF.title })).toBeInTheDocument();
    expect(screen.getByText(PROOF.body)).toBeInTheDocument();
    expect(screen.getByTestId('proof-panel')).toBeInTheDocument();
  });

  it('opens the overlay on the timeline from "Open the overlay", and tracks it', async () => {
    renderSection();
    await userEvent.click(screen.getByRole('button', { name: /^Open the overlay →$/ }));
    expect(screen.getByTestId('overlay-status')).toHaveTextContent('open:timeline');
    expect(trackClickCta).toHaveBeenCalledWith(PROOF.cta, 'proof');
  });

  it('does the same from a click on the panel', async () => {
    renderSection();
    await userEvent.click(screen.getByTestId('proof-header'));
    expect(screen.getByTestId('overlay-status')).toHaveTextContent('open:timeline');
    expect(trackClickCta).toHaveBeenCalledWith(PROOF.cta, 'proof');
  });
});
