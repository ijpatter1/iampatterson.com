/**
 * @jest-environment jsdom
 *
 * Integration-style tests using the REAL OverlayProvider, to cover state
 * transitions that the mocked-isOpen test can't exercise:
 *  - close-then-reopen resets phase and selectedEvent
 *  - `open(tab)` with a tab hint switches the panel to that tab
 *  - cross-pathname reopen doesn't leave stale viewMode
 */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

let mockPathname = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

jest.mock('@/hooks/useLiveEvents', () => ({
  useLiveEvents: () => ({ events: [], source: 'dataLayer' }),
}));

jest.mock('@/hooks/useFilteredEvents', () => ({
  useFilteredEvents: (events: unknown[]) => ({ filteredEvents: events }),
}));

// Overview tab content is tested in its own suite. Stub it here so this
// integration test stays focused on state-transition orchestration.
jest.mock('@/components/overlay/overview-tab', () => ({
  OverviewTab: () => <div data-testid="overview-tab-stub" />,
}));

// Emission side-effects (manual_select + default_landing) are asserted in
// their own focused suites. Silence them here so this file asserts viewMode
// transitions without fighting data-layer pollution.
jest.mock('@/lib/events/track', () => ({
  trackOverviewTabView: jest.fn(),
  trackTimelineTabView: jest.fn(),
  trackConsentTabView: jest.fn(),
}));

import { OverlayProvider, useOverlay, type OverlayTab } from '@/components/overlay/overlay-context';
import { OverlayView } from '@/components/overlay/overlay-view';

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

function Controls() {
  const { open, close } = useOverlay();
  return (
    <div>
      <button onClick={() => open()}>open</button>
      <button onClick={() => open('consent')}>open-consent</button>
      <button onClick={() => open('timeline')}>open-timeline</button>
      <button onClick={() => open('overview')}>open-overview</button>
      <button onClick={close}>close</button>
    </div>
  );
}

function renderHost() {
  return render(
    <OverlayProvider>
      <OverlayView />
      <Controls />
    </OverlayProvider>,
  );
}

beforeEach(() => {
  mockReducedMotion(true); // skip boot for most tests
  mockPathname = '/';
  // Per-session boot flag must reset between tests so each case controls
  // whether it's simulating "first open of the session" or a re-open.
  window.sessionStorage.clear();
});

afterEach(() => {
  // Guard against fake-timer leakage from one failing test hanging the next.
  jest.useRealTimers();
});

describe('OverlayView — integration with OverlayProvider', () => {
  it('is hidden until first open (no test-id rendered)', () => {
    mockReducedMotion(true);
    render(
      <OverlayProvider>
        <Controls />
      </OverlayProvider>,
    );
    expect(screen.queryByTestId('overlay-view')).not.toBeInTheDocument();
  });

  it('switches to the tab requested by open(tab)', async () => {
    const user = userEvent.setup();
    renderHost();
    await user.click(screen.getByText('open-consent'));
    // Active tab gets the accent-current border
    const consentTab = screen.getByRole('button', { name: /^Consent$/i });
    expect(consentTab.className).toContain('border-accent-current');
  });

  it('routes tab-hinted opens: overview (footer deep-link case)', async () => {
    const user = userEvent.setup();
    renderHost();
    // Land on Timeline first so the pendingTab transition is observable
    // as a viewMode change, not a no-op against the default.
    await user.click(screen.getByText('open-timeline'));
    await user.click(screen.getByText('close'));
    await user.click(screen.getByText('open-overview'));
    const overviewTab = screen.getByRole('button', { name: /^Overview$/i });
    expect(overviewTab.className).toContain('border-accent-current');
  });

  it('reopens to the last viewed tab when reopened without a tab hint (sticky)', async () => {
    const user = userEvent.setup();
    renderHost();
    await user.click(screen.getByText('open-consent'));
    expect(screen.getByRole('button', { name: /^Consent$/i }).className).toContain(
      'border-accent-current',
    );

    await user.click(screen.getByText('close'));
    // Reopen WITHOUT a tab hint — viewMode is sticky. D2 removed the
    // pathname-based tab reset (HomepageUnderside/EcommerceUnderside
    // routing is gone), so Overview is always available and viewMode
    // never needs to be "corrected" on reopen.
    await user.click(screen.getByText('open'));
    expect(screen.getByRole('button', { name: /^Consent$/i }).className).toContain(
      'border-accent-current',
    );
  });

  it('first open boots, close-then-reopen skips boot per once-per-session spec', async () => {
    jest.useFakeTimers();
    mockReducedMotion(false);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderHost();

    // First open of the browser session fires the boot sequence.
    await user.click(screen.getByText('open'));
    expect(screen.getByTestId('overlay-view').dataset.phase).toBe('boot');
    act(() => {
      jest.advanceTimersByTime(260);
    });
    expect(screen.getByTestId('overlay-view').dataset.phase).toBe('on');

    await user.click(screen.getByText('close'));
    expect(screen.getByTestId('overlay-view').dataset.phase).toBe('idle');

    // Second open within the same session skips boot and lands on 'on'
    // directly — the boot gesture is a one-time reveal, not a repeated effect.
    await user.click(screen.getByText('open'));
    expect(screen.getByTestId('overlay-view').dataset.phase).toBe('on');
  });

  it('tab set is pathname-independent — Overview default persists across routes', async () => {
    const user = userEvent.setup();
    mockPathname = '/';
    const { rerender } = renderHost();

    await user.click(screen.getByText('open'));
    // Homepage: Overview is the default and only landing tab.
    expect(screen.getByRole('button', { name: /^Overview$/i }).className).toContain(
      'border-accent-current',
    );
    expect(screen.queryByRole('button', { name: /^Session State$/i })).not.toBeInTheDocument();

    await user.click(screen.getByText('close'));
    // Navigate to a demo route — D2 removed pathname-specific routing.
    // The tab set is identical on every route.
    mockPathname = '/demo/ecommerce';
    rerender(
      <OverlayProvider>
        <OverlayView />
        <Controls />
      </OverlayProvider>,
    );

    await user.click(screen.getByText('open'));
    // Overview remains the landing tab; no pathname-dependent tabs.
    expect(screen.getByRole('button', { name: /^Overview$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Session State$/i })).not.toBeInTheDocument();
  });

  it('exports OverlayTab type for consumers — narrowed to three values post-D2', () => {
    // Type-only: if the export broke, TS would fail compilation. Array
    // matches the post-D2 union (overview | timeline | consent).
    const tab: OverlayTab = 'timeline';
    expect(['overview', 'timeline', 'consent']).toContain(tab);
  });
});
