/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import type { PipelineEvent } from '@/lib/events/pipeline-schema';

const sourceCalls: unknown[] = [];
const fakeEvent = { pipeline_id: 'pipe-1', event_name: 'page_view' } as unknown as PipelineEvent;

jest.mock('@/hooks/useAnalyticsConsent', () => ({
  useAnalyticsConsent: () => 'denied',
}));

jest.mock('@/hooks/useEventStream', () => ({
  useEventStream: (options: unknown) => {
    sourceCalls.push(options);
    return { status: 'connected', events: [], error: null, clearEvents: jest.fn() };
  },
}));

jest.mock('@/hooks/useDataLayerEvents', () => ({
  useDataLayerEvents: () => ({ events: [fakeEvent], clearEvents: jest.fn() }),
}));

import { LiveEventsProvider } from '@/components/live-events-provider';
import { useLiveEvents } from '@/hooks/useLiveEvents';

function Reader({ name }: { name: string }) {
  const { events, source } = useLiveEvents();
  return (
    <span data-testid={name}>
      {source}:{events.length}
    </span>
  );
}

beforeEach(() => {
  sourceCalls.length = 0;
});

// The stream service keeps one connection per session and ends the previous
// one when another arrives. So however many components show live events, the
// page must open the stream once.
describe('LiveEventsProvider', () => {
  it('opens the stream once for any number of readers', () => {
    render(
      <LiveEventsProvider>
        <Reader name="overlay" />
        <Reader name="strip" />
        <Reader name="panel" />
      </LiveEventsProvider>,
    );
    expect(sourceCalls).toHaveLength(1);
  });

  it('gives every reader the same events from the same source', () => {
    render(
      <LiveEventsProvider>
        <Reader name="a" />
        <Reader name="b" />
      </LiveEventsProvider>,
    );
    expect(screen.getByTestId('a')).toHaveTextContent('dataLayer:1');
    expect(screen.getByTestId('b')).toHaveTextContent('dataLayer:1');
  });

  // Missing the provider must not look like "no events yet".
  it('fails loudly when a reader is used outside the provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Reader name="orphan" />)).toThrow(/LiveEventsProvider/);
    spy.mockRestore();
  });
});
