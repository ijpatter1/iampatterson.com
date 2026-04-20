/**
 * @jest-environment jsdom
 *
 * Deliverable 2 — `overview_tab_view` `default_landing` emission.
 *
 * Complements the `manual_select` semantics pinned in
 * `overview-tab-emission.test.tsx`. Covers the case where a visitor
 * lands on Overview without clicking the tab in the tabs bar:
 *  - fresh first open per session (Overview is the default tab)
 *  - close → reopen where viewMode is sticky at overview
 *  - `open('overview')` from outside (e.g. footer deep-link)
 *
 * Architectural invariant: emission fires once per overlay-open that
 * lands on Overview. A `manual_select` tab-bar click INSIDE the
 * same open DOES NOT re-fire `default_landing` — the landing event
 * describes how the visitor arrived, not transitions within a session.
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

function mockReducedMotion(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? matches : false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

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
      <button type="button" onClick={() => open('overview')}>
        open-with-pending-overview
      </button>
      <button type="button" onClick={() => open('timeline')}>
        open-with-pending-timeline
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

beforeEach(() => {
  window.dataLayer = [];
  window.sessionStorage.clear();
  mockReducedMotion(true); // skip boot hold so overlay reaches phase-on synchronously
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).dataLayer;
});

describe('overview_tab_view default_landing emission (deliverable 2)', () => {
  it('fires once on the first overlay open — Overview is the default landing tab', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('open-overlay'));

    const events = dataLayerEventsNamed('overview_tab_view');
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('default_landing');
  });

  it('fires again on each overlay re-open that lands on Overview (sticky reopen)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    // First open — default_landing (viewMode = overview by default)
    await user.click(screen.getByText('open-overlay'));
    await user.click(screen.getByText('close-overlay'));
    // Second open — viewMode sticky at overview, still a landing event
    await user.click(screen.getByText('open-overlay'));

    const events = dataLayerEventsNamed('overview_tab_view');
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.source === 'default_landing')).toBe(true);
  });

  it('fires default_landing when open("overview") is called from outside (e.g. footer link)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    // First land on Timeline so the pendingTab transition is observable
    await user.click(screen.getByText('open-with-pending-timeline'));
    await user.click(screen.getByText('close-overlay'));
    // Reopen with a overview pendingTab — the visitor chose the
    // destination from outside the tabs bar; this counts as a landing.
    await user.click(screen.getByText('open-with-pending-overview'));

    const events = dataLayerEventsNamed('overview_tab_view');
    // The open-with-pending-timeline open should have fired zero events
    // (viewMode landed on timeline). Only the reopen-to-overview
    // fires default_landing.
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('default_landing');
  });

  it('does NOT fire default_landing on opens that land on Timeline or Consent', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('open-with-pending-timeline'));

    expect(dataLayerEventsNamed('overview_tab_view')).toHaveLength(0);
  });

  it('does NOT fire default_landing on a manual_select click after landing resolved to Timeline (orthogonality regression — Pass 1 evaluator)', async () => {
    // Pinning the dual-fire bug caught in Pass 1 eval of D2.
    // Scenario:
    //   1. open('timeline') → landing resolves to Timeline, no emission.
    //      The landing-phase gate was previously only written inside the
    //      emission branch, so it stayed open.
    //   2. Click Overview from the tabs bar → handleTabChange emits
    //      manual_select (correct). viewMode transitions to overview.
    //   3. default_landing effect re-runs on the viewMode edge, sees the
    //      gate still open, and ALSO emits default_landing (dual-fire).
    // Post-fix: the gate closes on landing-phase resolution regardless of
    // which tab the landing resolved to, so the later click-back can only
    // fire manual_select.
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('open-with-pending-timeline'));
    expect(dataLayerEventsNamed('overview_tab_view')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: /^Overview$/i }));

    const events = dataLayerEventsNamed('overview_tab_view');
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('manual_select');
  });

  it('does NOT fire default_landing on a manual_select click after landing resolved to Consent (orthogonality regression — parallel case)', async () => {
    // Parallel coverage for the `open('consent')` path so any future tab
    // that resolves as a non-Session-State landing is covered by the same
    // invariant. A third tab added later would inherit the same guard
    // (landing-phase-resolved ref closes regardless of destination).
    const user = userEvent.setup();
    const Controls = () => {
      const { open } = useOverlay();
      return (
        <button type="button" onClick={() => open('consent')}>
          open-with-pending-consent
        </button>
      );
    };
    render(
      <OverlayProvider>
        <Controls />
        <UnderTheHoodView />
      </OverlayProvider>,
    );
    await user.click(screen.getByText('open-with-pending-consent'));
    expect(dataLayerEventsNamed('overview_tab_view')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: /^Overview$/i }));

    const events = dataLayerEventsNamed('overview_tab_view');
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('manual_select');
  });

  it('does NOT re-fire default_landing when the visitor clicks back to Overview from Timeline within the same open', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    // Open → default_landing fires once.
    await user.click(screen.getByText('open-overlay'));
    expect(dataLayerEventsNamed('overview_tab_view')).toHaveLength(1);

    // Click Timeline, then click back to Overview — the latter is
    // manual_select (click-bound, pinned by overview-tab-emission).
    // default_landing must NOT re-fire on that return transition.
    await user.click(screen.getByRole('button', { name: /^Timeline/i }));
    await user.click(screen.getByRole('button', { name: /^Overview$/i }));

    const events = dataLayerEventsNamed('overview_tab_view');
    expect(events).toHaveLength(2);
    expect(events[0].source).toBe('default_landing');
    expect(events[1].source).toBe('manual_select');
  });

  it('fires default_landing regardless of prefers-reduced-motion (emission is not gated by CRT boot)', async () => {
    mockReducedMotion(true);
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('open-overlay'));

    const events = dataLayerEventsNamed('overview_tab_view');
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('default_landing');
  });

  it('fires default_landing even when the boot-hold is active (matches=false)', async () => {
    // Pinning that the emission effect depends on [isOpen, viewMode,
    // pendingTab] and NOT on `phase` — emission must fire on the open
    // edge regardless of whether the CRT boot sequence is mid-animation.
    // A future refactor that accidentally gates the effect on `phase ===
    // 'on'` would regress the normal-motion case without this test.
    mockReducedMotion(false);
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('open-overlay'));

    const events = dataLayerEventsNamed('overview_tab_view');
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('default_landing');
  });

  it('chained sticky-Timeline reopen + click Overview emits only manual_select (no default_landing dual-fire)', async () => {
    // Close+reopen with a sticky non-target viewMode, then click back to
    // Overview. The landingResolvedRef must reset on close AND get
    // closed unconditionally on the reopen's landing resolution so the
    // later click-back fires only manual_select. Catches a regression
    // where the ref reset logic drifts (e.g., only resetting when
    // landingResolvedRef was set, not when the overlay closed).
    const user = userEvent.setup();
    render(<Harness />);
    // First open lands on Overview — default_landing emits.
    await user.click(screen.getByText('open-overlay'));
    expect(dataLayerEventsNamed('overview_tab_view')).toHaveLength(1);

    // Navigate to Timeline within the same open; no new emission.
    await user.click(screen.getByRole('button', { name: /^Timeline/i }));
    expect(dataLayerEventsNamed('overview_tab_view')).toHaveLength(1);

    // Close with Timeline sticky, then reopen — landing resolves to
    // Timeline (sticky), no default_landing emission.
    await user.click(screen.getByText('close-overlay'));
    await user.click(screen.getByText('open-overlay'));
    expect(dataLayerEventsNamed('overview_tab_view')).toHaveLength(1);

    // Click Overview tab — emits manual_select ONLY. Dual-fire
    // regression would push the count to 3 here.
    await user.click(screen.getByRole('button', { name: /^Overview$/i }));
    const events = dataLayerEventsNamed('overview_tab_view');
    expect(events).toHaveLength(2);
    expect(events[0].source).toBe('default_landing');
    expect(events[1].source).toBe('manual_select');
  });

  it('does NOT fire default_landing on initial mount while the overlay is still closed', () => {
    render(<Harness />);
    expect(dataLayerEventsNamed('overview_tab_view')).toHaveLength(0);
  });
});
