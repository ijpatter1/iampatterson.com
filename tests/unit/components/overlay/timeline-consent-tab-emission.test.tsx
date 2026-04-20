/**
 * Parallel to overview-tab-emission — pins manual_select + default_landing
 * semantics for the `timeline_tab_view` and `consent_tab_view` events added
 * in the F2 UAT close-out. Each tab gets its own event (not a single
 * `tab_view` event with a discriminator) so the Overview tab's coverage
 * chip grid can signal depth-of-exploration per tab.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { OverlayProvider, useOverlay } from '@/components/overlay/overlay-context';
import { OverlayView } from '@/components/overlay/overlay-view';

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

jest.mock('@/hooks/useLiveEvents', () => ({
  useLiveEvents: () => ({ events: [], source: 'dataLayer' }),
}));

jest.mock('@/hooks/useFilteredEvents', () => ({
  useFilteredEvents: (events: unknown[]) => ({ filteredEvents: events }),
}));

jest.mock('@/components/session-state-provider', () => ({
  SessionStateProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSessionState: () => null,
}));

function OverlayControls() {
  const { open, close } = useOverlay();
  return (
    <>
      <button type="button" onClick={() => open()}>
        open-overlay
      </button>
      <button type="button" onClick={() => close()}>
        close-overlay
      </button>
      <button type="button" onClick={() => open('timeline')}>
        open-with-pending-timeline
      </button>
      <button type="button" onClick={() => open('consent')}>
        open-with-pending-consent
      </button>
    </>
  );
}

function Harness() {
  return (
    <OverlayProvider>
      <OverlayControls />
      <OverlayView />
    </OverlayProvider>
  );
}

function dataLayerEventsNamed(name: string) {
  return ((window.dataLayer ?? []) as Array<{ event?: string; source?: string }>).filter(
    (e) => e.event === name,
  );
}

beforeEach(() => {
  window.dataLayer = [];
  window.sessionStorage.clear();
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).dataLayer;
});

describe('timeline_tab_view emission', () => {
  it('fires default_landing when the overlay opens with pendingTab=timeline', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('open-with-pending-timeline'));

    const events = dataLayerEventsNamed('timeline_tab_view');
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('default_landing');
  });

  it('fires manual_select when the visitor clicks the Timeline tab from another tab', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    // Open (lands on Overview), then click Timeline tab.
    await user.click(screen.getByText('open-overlay'));
    await user.click(screen.getByRole('button', { name: /^Timeline/i }));

    const events = dataLayerEventsNamed('timeline_tab_view');
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('manual_select');
  });

  it('does not fire on the initial overlay open when landing resolves to Overview', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('open-overlay'));
    expect(dataLayerEventsNamed('timeline_tab_view')).toHaveLength(0);
  });

  it('does not re-fire default_landing when clicking between tabs within the same open', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    // open('timeline') → default_landing fires for timeline.
    await user.click(screen.getByText('open-with-pending-timeline'));
    expect(dataLayerEventsNamed('timeline_tab_view')).toHaveLength(1);

    // Click to Overview + back to Timeline — the Timeline return is
    // manual_select, not default_landing (orthogonality preserved).
    await user.click(screen.getByRole('button', { name: /^Overview$/i }));
    await user.click(screen.getByRole('button', { name: /^Timeline/i }));

    const events = dataLayerEventsNamed('timeline_tab_view');
    expect(events).toHaveLength(2);
    expect(events[0].source).toBe('default_landing');
    expect(events[1].source).toBe('manual_select');
  });
});

describe('consent_tab_view emission', () => {
  it('fires default_landing when the overlay opens with pendingTab=consent', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('open-with-pending-consent'));

    const events = dataLayerEventsNamed('consent_tab_view');
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('default_landing');
  });

  it('fires manual_select when the visitor clicks the Consent tab from another tab', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('open-overlay'));
    await user.click(screen.getByRole('button', { name: /^Consent$/i }));

    const events = dataLayerEventsNamed('consent_tab_view');
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('manual_select');
  });

  it('does not fire on opens that land on Overview or Timeline', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('open-overlay'));
    await user.click(screen.getByRole('button', { name: /^Timeline/i }));
    expect(dataLayerEventsNamed('consent_tab_view')).toHaveLength(0);
  });
});

describe('tab_view events are orthogonal per tab (one event per tab, never cross-fire)', () => {
  it('clicking Timeline does not emit overview_tab_view or consent_tab_view', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('open-overlay'));
    // Initial open fires overview_tab_view('default_landing'). Clicking
    // Timeline should fire ONLY timeline_tab_view('manual_select').
    const beforeOverview = dataLayerEventsNamed('overview_tab_view').length;
    const beforeConsent = dataLayerEventsNamed('consent_tab_view').length;
    await user.click(screen.getByRole('button', { name: /^Timeline/i }));

    expect(dataLayerEventsNamed('overview_tab_view')).toHaveLength(beforeOverview);
    expect(dataLayerEventsNamed('consent_tab_view')).toHaveLength(beforeConsent);
    expect(dataLayerEventsNamed('timeline_tab_view')).toHaveLength(1);
  });

  it('clicking Consent does not emit overview_tab_view or timeline_tab_view', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('open-overlay'));
    const beforeOverview = dataLayerEventsNamed('overview_tab_view').length;
    const beforeTimeline = dataLayerEventsNamed('timeline_tab_view').length;
    await user.click(screen.getByRole('button', { name: /^Consent$/i }));

    expect(dataLayerEventsNamed('overview_tab_view')).toHaveLength(beforeOverview);
    expect(dataLayerEventsNamed('timeline_tab_view')).toHaveLength(beforeTimeline);
    expect(dataLayerEventsNamed('consent_tab_view')).toHaveLength(1);
  });
});
