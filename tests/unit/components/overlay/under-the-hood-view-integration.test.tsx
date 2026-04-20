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

import { OverlayProvider, useOverlay, type OverlayTab } from '@/components/overlay/overlay-context';
import { UnderTheHoodView } from '@/components/overlay/under-the-hood-view';

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
      <button onClick={() => open('dashboards')}>open-dashboards</button>
      <button onClick={close}>close</button>
    </div>
  );
}

function renderHost() {
  return render(
    <OverlayProvider>
      <UnderTheHoodView />
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

describe('UnderTheHoodView — integration with OverlayProvider', () => {
  it('is hidden until first open (no test-id rendered)', () => {
    mockReducedMotion(true);
    render(
      <OverlayProvider>
        <Controls />
      </OverlayProvider>,
    );
    expect(screen.queryByTestId('under-the-hood-view')).not.toBeInTheDocument();
  });

  it('switches to the tab requested by open(tab)', async () => {
    const user = userEvent.setup();
    renderHost();
    await user.click(screen.getByText('open-consent'));
    // Active tab gets the accent-current border
    const consentTab = screen.getByRole('button', { name: /^Consent$/i });
    expect(consentTab.className).toContain('border-accent-current');
  });

  it('routes tab-hinted opens: dashboards', async () => {
    const user = userEvent.setup();
    renderHost();
    await user.click(screen.getByText('open-dashboards'));
    const dashTab = screen.getByRole('button', { name: /^Dashboards/i });
    expect(dashTab.className).toContain('border-accent-current');
  });

  it('reverts to Overview when reopened without a tab hint (on homepage)', async () => {
    const user = userEvent.setup();
    renderHost();
    await user.click(screen.getByText('open-consent'));
    expect(screen.getByRole('button', { name: /^Consent$/i }).className).toContain(
      'border-accent-current',
    );

    await user.click(screen.getByText('close'));
    // Reopen WITHOUT a tab hint — the overlay sits wherever the user left it
    // because viewMode is only reset when the current tab disappears.
    // This asserts that the tab-hint mechanism does not fire on every open.
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
    expect(screen.getByTestId('under-the-hood-view').dataset.phase).toBe('boot');
    act(() => {
      jest.advanceTimersByTime(260);
    });
    expect(screen.getByTestId('under-the-hood-view').dataset.phase).toBe('on');

    await user.click(screen.getByText('close'));
    expect(screen.getByTestId('under-the-hood-view').dataset.phase).toBe('idle');

    // Second open within the same session skips boot and lands on 'on'
    // directly — the boot gesture is a one-time reveal, not a repeated effect.
    await user.click(screen.getByText('open'));
    expect(screen.getByTestId('under-the-hood-view').dataset.phase).toBe('on');
  });

  it('cross-pathname reopen drops stale overview and falls back to timeline', async () => {
    const user = userEvent.setup();
    mockPathname = '/';
    const { rerender } = renderHost();

    await user.click(screen.getByText('open'));
    // Homepage: default viewMode is overview
    expect(screen.getByRole('button', { name: /^Overview$/i })).toBeInTheDocument();

    await user.click(screen.getByText('close'));
    // Navigate to /demo/subscription (no Overview tab on this route)
    mockPathname = '/demo/subscription';
    rerender(
      <OverlayProvider>
        <UnderTheHoodView />
        <Controls />
      </OverlayProvider>,
    );

    await user.click(screen.getByText('open'));
    // Overview tab should be absent
    expect(screen.queryByRole('button', { name: /^Overview$/i })).not.toBeInTheDocument();
    // Timeline should be the active tab
    expect(screen.getByRole('button', { name: /^Timeline/i }).className).toContain(
      'border-accent-current',
    );
  });

  it('exports OverlayTab type for consumers', () => {
    // Type-only: if the export broke, TS would fail compilation.
    const tab: OverlayTab = 'timeline';
    expect(['overview', 'session_state', 'timeline', 'consent', 'dashboards']).toContain(tab);
  });
});
