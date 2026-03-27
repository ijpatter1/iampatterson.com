/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MobileBottomSheet } from '@/components/overlay/mobile-bottom-sheet';
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
    routing: [{ destination: 'ga4', status: 'sent', timestamp: '2026-03-27T10:00:01Z' }],
    ...overrides,
  });
}

function OpenThenRender({ events }: { events: PipelineEvent[] }) {
  const { open } = useOverlay();
  return (
    <>
      <button onClick={open}>OpenOverlay</button>
      <MobileBottomSheet events={events} />
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

describe('MobileBottomSheet', () => {
  it('is not visible when overlay is closed', () => {
    render(
      <OverlayProvider>
        <MobileBottomSheet events={[]} />
      </OverlayProvider>,
    );
    expect(screen.queryByTestId('mobile-bottom-sheet')).not.toBeInTheDocument();
  });

  it('is visible when overlay is open', async () => {
    const user = userEvent.setup();
    renderWithOverlay();
    await user.click(screen.getByText('OpenOverlay'));
    expect(screen.getByTestId('mobile-bottom-sheet')).toBeInTheDocument();
  });

  it('shows event timeline when open', async () => {
    const user = userEvent.setup();
    const events = [makeEvent({ event_name: 'click_nav' })];
    renderWithOverlay(events);
    await user.click(screen.getByText('OpenOverlay'));
    expect(screen.getByText('click_nav')).toBeInTheDocument();
  });

  it('has a drag handle element', async () => {
    const user = userEvent.setup();
    renderWithOverlay();
    await user.click(screen.getByText('OpenOverlay'));
    expect(screen.getByTestId('drag-handle')).toBeInTheDocument();
  });

  it('shows event detail when an event is selected', async () => {
    const user = userEvent.setup();
    const events = [makeEvent({ event_name: 'form_submit', parameters: { form_name: 'contact' } })];
    renderWithOverlay(events);
    await user.click(screen.getByText('OpenOverlay'));
    await user.click(screen.getByText('form_submit'));
    expect(screen.getByText(/data layer/i)).toBeInTheDocument();
    expect(screen.getByText('form_name')).toBeInTheDocument();
  });

  it('has a title', async () => {
    const user = userEvent.setup();
    renderWithOverlay();
    await user.click(screen.getByText('OpenOverlay'));
    expect(screen.getByText(/event stream/i)).toBeInTheDocument();
  });
});
