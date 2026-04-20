/**
 * `session_state_tab_view` `manual_select` emission semantics.
 *
 * Fires ONLY when the visitor actively clicks the Session State tab
 * from the tabs bar. Programmatic transitions — a sticky-tab reopen,
 * `open('session_state')` via pendingTab, the default landing on fresh
 * open — are the `default_landing` case covered in
 * `default-landing-emission.test.tsx`; this file pins the click-bound
 * manual_select invariant.
 *
 * Post-D2 note: Session State is now the default landing tab, so the
 * first overlay open fires `default_landing` (not `manual_select`).
 * Tests here filter by `source === 'manual_select'` where relevant to
 * assert the click-bound path in isolation.
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
      <button type="button" onClick={() => open('session_state')}>
        open-with-pending-session-state
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
  return ((window.dataLayer ?? []) as Array<{ event?: string; source?: string }>).filter(
    (e) => e.event === name,
  );
}

function manualSelectEvents() {
  return dataLayerEventsNamed('session_state_tab_view').filter((e) => e.source === 'manual_select');
}

describe('session_state_tab_view emission', () => {
  beforeEach(() => {
    window.dataLayer = [];
    window.sessionStorage.clear();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).dataLayer;
  });

  it('does not fire manual_select on the initial overlay open (the default landing is not a click)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('open-overlay'));
    // Post-D2 the default landing emits `default_landing`, which is a
    // different source value asserted in the default-landing suite.
    expect(manualSelectEvents()).toHaveLength(0);
  });

  it('fires manual_select when the visitor clicks the Session State tab from another tab', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    // Open — Session State is the default landing tab post-D2. Navigate
    // to Timeline first so the click back to Session State is observable
    // as a tab-bar click (the manual_select case).
    await user.click(screen.getByText('open-overlay'));
    await user.click(screen.getByRole('button', { name: /^Timeline/i }));
    await user.click(screen.getByRole('button', { name: /^Session State$/i }));
    const events = manualSelectEvents();
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('manual_select');
  });

  it('does not re-emit manual_select when the overlay is closed and reopened with Session State sticky', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('open-overlay'));
    await user.click(screen.getByRole('button', { name: /^Timeline/i }));
    await user.click(screen.getByRole('button', { name: /^Session State$/i }));
    expect(manualSelectEvents()).toHaveLength(1);

    // Close + reopen — viewMode stays sticky at 'session_state' but this
    // reopen is NOT a manual select; it's a default_landing (covered in
    // its own suite). manual_select count stays at 1.
    await user.click(screen.getByText('close-overlay'));
    await user.click(screen.getByText('open-overlay'));

    expect(manualSelectEvents()).toHaveLength(1);
  });

  it('does not emit manual_select when a different tab is clicked', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('open-overlay'));
    await user.click(screen.getByRole('button', { name: /^Timeline/i }));
    expect(manualSelectEvents()).toHaveLength(0);
  });

  it('fires once per active tab-bar transition back to Session State from another tab', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('open-overlay'));
    // default_landing fires here; navigate away + back twice to rack up
    // two manual_select emissions.
    await user.click(screen.getByRole('button', { name: /^Timeline/i }));
    await user.click(screen.getByRole('button', { name: /^Session State$/i }));
    await user.click(screen.getByRole('button', { name: /^Timeline/i }));
    await user.click(screen.getByRole('button', { name: /^Session State$/i }));
    expect(manualSelectEvents()).toHaveLength(2);
  });

  it('does NOT fire manual_select when viewMode lands on session_state via pendingTab (click-bound invariant)', async () => {
    // Pinning the architectural invariant: manual_select emission is
    // click-bound (via `handleTabChange`), so programmatic tab changes —
    // `open('session_state')` via pendingTab, the default landing on
    // fresh open — never emit manual_select. They emit default_landing
    // instead (asserted in default-landing-emission.test.tsx). A future
    // refactor that reverts to an effect-based manual_select emitter
    // would regress the pendingTab path and fail here.
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('open-with-pending-session-state'));
    expect(manualSelectEvents()).toHaveLength(0);
  });
});
