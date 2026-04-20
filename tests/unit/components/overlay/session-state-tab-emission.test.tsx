/**
 * `session_state_tab_view` emission semantics — Pass 1 I1 + I2.
 *
 * Fires ONLY when the visitor actively clicks the Session State tab after
 * the overlay has already opened on a different tab. A sticky-tab reopen
 * (overlay closed with Session State selected, then reopened) is NOT a
 * manual_select — it's a fresh open that happens to land on the tab via
 * state persistence. Deliverable 2 will introduce the `default_landing`
 * case; this file pins the pre-D2 semantic.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { OverlayProvider, useOverlay } from '@/components/overlay/overlay-context';
import { UnderTheHoodView } from '@/components/overlay/under-the-hood-view';

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
    </>
  );
}

function Harness() {
  return (
    <OverlayProvider>
      <OverlayControls />
      <UnderTheHoodView />
    </OverlayProvider>
  );
}

function dataLayerEventsNamed(name: string) {
  return ((window.dataLayer ?? []) as Array<{ event?: string }>).filter((e) => e.event === name);
}

describe('session_state_tab_view emission', () => {
  beforeEach(() => {
    window.dataLayer = [];
    window.sessionStorage.clear();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).dataLayer;
  });

  it('does not fire on the initial overlay open (first-seen tab is never a manual_select)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('open-overlay'));
    expect(dataLayerEventsNamed('session_state_tab_view')).toHaveLength(0);
  });

  it('fires manual_select when the visitor clicks the Session State tab from another tab', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    // Open — lands on Overview (homepage path).
    await user.click(screen.getByText('open-overlay'));
    // Click Session State tab in the tabs row.
    await user.click(screen.getByRole('button', { name: /^Session State$/i }));
    const events = dataLayerEventsNamed('session_state_tab_view');
    expect(events).toHaveLength(1);
    expect((events[0] as { source?: string }).source).toBe('manual_select');
  });

  it('does not re-emit when the overlay is closed and reopened with Session State sticky', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('open-overlay'));
    await user.click(screen.getByRole('button', { name: /^Session State$/i }));
    expect(dataLayerEventsNamed('session_state_tab_view')).toHaveLength(1);

    // Close + reopen — viewMode stays sticky at 'session_state' but this
    // reopen is NOT a manual select.
    await user.click(screen.getByText('close-overlay'));
    await user.click(screen.getByText('open-overlay'));

    expect(dataLayerEventsNamed('session_state_tab_view')).toHaveLength(1);
  });

  it('does not emit when a different tab is clicked', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('open-overlay'));
    await user.click(screen.getByRole('button', { name: /^Timeline/i }));
    expect(dataLayerEventsNamed('session_state_tab_view')).toHaveLength(0);
  });

  it('fires once per active transition back to Session State from another tab', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('open-overlay'));
    await user.click(screen.getByRole('button', { name: /^Session State$/i }));
    await user.click(screen.getByRole('button', { name: /^Timeline/i }));
    await user.click(screen.getByRole('button', { name: /^Session State$/i }));
    expect(dataLayerEventsNamed('session_state_tab_view')).toHaveLength(2);
  });

  // Note: `open('session_state')` — programmatic open directly to the tab
  // — is deliverable 2's territory. D2 promotes Session State to the default
  // and introduces the `default_landing` source; until then no caller in the
  // codebase uses that open-to-tab path, so the emission semantic for it is
  // not pinned here.
});
