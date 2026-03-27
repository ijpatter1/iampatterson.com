/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DesktopOverlay } from '@/components/overlay/desktop-overlay';
import { OverlayProvider, useOverlay } from '@/components/overlay/overlay-context';
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
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      functionality_storage: 'granted',
    },
    routing: [
      { destination: 'ga4', status: 'sent', timestamp: '2026-03-27T10:00:01Z' },
      { destination: 'bigquery', status: 'sent', timestamp: '2026-03-27T10:00:01Z' },
    ],
    ...overrides,
  });
}

// Helper to open the overlay before testing DesktopOverlay
function OpenThenRender({ events }: { events: PipelineEvent[] }) {
  const { open } = useOverlay();
  return (
    <>
      <button onClick={open}>OpenOverlay</button>
      <DesktopOverlay events={events} />
    </>
  );
}

function renderWithOverlay(events: PipelineEvent[] = []) {
  return render(
    <OverlayProvider>
      <OpenThenRender events={events} />
    </OverlayProvider>,
  );
}

describe('DesktopOverlay', () => {
  it('is not visible when overlay is closed', () => {
    render(
      <OverlayProvider>
        <DesktopOverlay events={[]} />
      </OverlayProvider>,
    );
    expect(screen.queryByTestId('desktop-overlay')).not.toBeInTheDocument();
  });

  it('is visible when overlay is open', async () => {
    const user = userEvent.setup();
    renderWithOverlay();
    await user.click(screen.getByText('OpenOverlay'));
    expect(screen.getByTestId('desktop-overlay')).toBeInTheDocument();
  });

  it('shows the event timeline when open', async () => {
    const user = userEvent.setup();
    const events = [makeEvent({ event_name: 'page_view' })];
    renderWithOverlay(events);
    await user.click(screen.getByText('OpenOverlay'));
    expect(screen.getByText('page_view')).toBeInTheDocument();
  });

  it('shows event detail when an event is clicked', async () => {
    const user = userEvent.setup();
    const events = [makeEvent({ event_name: 'click_cta', parameters: { cta_text: 'Learn More' } })];
    renderWithOverlay(events);
    await user.click(screen.getByText('OpenOverlay'));
    await user.click(screen.getByText('click_cta'));
    expect(screen.getByText(/data layer/i)).toBeInTheDocument();
    expect(screen.getByText('cta_text')).toBeInTheDocument();
  });

  it('shows empty state when open with no events', async () => {
    const user = userEvent.setup();
    renderWithOverlay([]);
    await user.click(screen.getByText('OpenOverlay'));
    expect(screen.getByText(/no events/i)).toBeInTheDocument();
  });

  it('has a title', async () => {
    const user = userEvent.setup();
    renderWithOverlay();
    await user.click(screen.getByText('OpenOverlay'));
    expect(screen.getByText(/event stream/i)).toBeInTheDocument();
  });
});
