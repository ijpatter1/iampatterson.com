/**
 * @jest-environment jsdom
 */
import { TextDecoder, TextEncoder } from 'util';

Object.assign(global, { TextEncoder, TextDecoder });

import type { PipelineEvent } from '@/lib/events/pipeline-schema';

// The panel's first paint, with the real live-events source and stream hook:
// server rendering runs no effects, so this is the state before the stream's
// first attempt. A visitor who allowed analytics and already has data-layer
// rows must not see "Live stream not connected" flash and be announced before
// the stream has had a chance to connect.

const dataLayerEvent = {
  pipeline_id: 'dl-1-1',
  received_at: '2026-11-14T10:00:00Z',
  session_id: 'aaaaaaaa-12345678',
  event_name: 'page_view',
  timestamp: '2026-11-14T10:00:00Z',
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
  routing: [],
} as PipelineEvent;

jest.mock('@/hooks/useAnalyticsConsent', () => ({
  useAnalyticsConsent: () => 'granted',
}));

jest.mock('@/hooks/useDataLayerEvents', () => ({
  useDataLayerEvents: () => ({ events: [dataLayerEvent], clearEvents: jest.fn() }),
}));

jest.mock('@/hooks/useSessionReadout', () => ({
  useSessionReadout: () => ({
    shortId: '345678',
    consent: { analytics: 'granted', ad: 'denied' },
    eventCount: 1,
  }),
}));

import { renderToString } from 'react-dom/server';

import { ProofPanel } from '@/components/home/proof-panel';
import { LiveEventsProvider } from '@/components/live-events-provider';

const previousUrl = process.env.NEXT_PUBLIC_EVENT_STREAM_URL;

beforeAll(() => {
  process.env.NEXT_PUBLIC_EVENT_STREAM_URL = 'https://stream.example.test';
});

afterAll(() => {
  process.env.NEXT_PUBLIC_EVENT_STREAM_URL = previousUrl;
});

it('shows no stream note on the first render, with data-layer rows and analytics granted', () => {
  const container = document.createElement('div');
  container.innerHTML = renderToString(
    <LiveEventsProvider>
      <ProofPanel onOpen={() => {}} />
    </LiveEventsProvider>,
  );

  // Not vacuous: the rows the note would sit above are there.
  expect(container.querySelectorAll('[data-testid="proof-row"]')).toHaveLength(1);
  const note = container.querySelector('[data-testid="proof-stream-note"]');
  expect(note).not.toBeNull();
  expect(note?.textContent).toBe('');
});
