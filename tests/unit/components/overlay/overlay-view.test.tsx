/**
 * @jest-environment jsdom
 */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BOOT_SESSION_KEY, OverlayView } from '@/components/overlay/overlay-view';

const mockClose = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

jest.mock('@/components/overlay/overlay-context', () => ({
  useOverlay: () => ({
    isOpen: true,
    toggle: mockClose,
    open: jest.fn(),
    close: mockClose,
  }),
}));

jest.mock('@/hooks/useLiveEvents', () => ({
  useLiveEvents: () => ({ events: [], source: 'dataLayer' }),
}));

jest.mock('@/hooks/useFilteredEvents', () => ({
  useFilteredEvents: (events: unknown[]) => ({ filteredEvents: events }),
}));

// Overview tab content is tested in its own suite. Stub the component here
// so the overlay tests stay focused on chrome + tab-level behavior and
// don't pull the full SessionStateProvider mount chain into scope.
jest.mock('@/components/overlay/overview-tab', () => ({
  OverviewTab: () => <div data-testid="overview-tab-stub" />,
}));

// Emission side-effects are asserted in the default-landing-emission and
// overview-tab-emission suites. Silence them here so repeated tab renders
// don't pollute window.dataLayer across tests in this file.
jest.mock('@/lib/events/track', () => ({
  trackOverviewTabView: jest.fn(),
  trackTimelineTabView: jest.fn(),
  trackConsentTabView: jest.fn(),
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

beforeEach(() => {
  jest.clearAllMocks();
  mockReducedMotion(false);
  // Clear the boot-once-per-session flag so each test starts from a fresh
  // "first open of the session" state.
  window.sessionStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('OverlayView, editorial / CRT redesign', () => {
  it('renders as a full-page overlay when isOpen is true', () => {
    render(<OverlayView />);
    const view = screen.getByTestId('overlay-view');
    expect(view).toBeInTheDocument();
    expect(view.className).toContain('fixed');
    expect(view.className).toContain('inset-0');
  });

  it('renders the "Back to site" close button', () => {
    render(<OverlayView />);
    expect(screen.getByRole('button', { name: /back to site/i })).toBeInTheDocument();
  });

  it('does NOT render the dead -z-10 backdrop button (F3 UAT fix)', () => {
    // Pre-F3 shipped an `absolute inset-0 -z-10` "backdrop close" button that
    // was permanently occluded by the flex-column header/tabs/content children,
    // so it never received a click. UAT S8 reported "backdrop click does not
    // close overlay", the button is gone; Escape is the close affordance.
    render(<OverlayView />);
    expect(screen.queryByRole('button', { name: /close overlay/i })).not.toBeInTheDocument();
  });

  it('calls close when "Back to site" is clicked', async () => {
    const user = userEvent.setup();
    render(<OverlayView />);
    await user.click(screen.getByRole('button', { name: /back to site/i }));
    expect(mockClose).toHaveBeenCalled();
  });

  it('calls close when the Escape key is pressed (F3 UAT S8 fix)', () => {
    // Standard modal behavior.
    render(<OverlayView />);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(mockClose).toHaveBeenCalled();
  });

  it('calls close when the outer overlay backdrop itself is clicked (F8 user feedback)', () => {
    // Background-click-closes gesture: the listener uses the bubble-phase
    // `e.target === e.currentTarget` check, so only direct clicks on the
    // outer fixed container close, descendant clicks bubble through
    // normally without triggering close.
    render(<OverlayView />);
    const view = screen.getByTestId('overlay-view');
    act(() => {
      view.click();
    });
    expect(mockClose).toHaveBeenCalled();
  });

  it('does NOT close when an interactive descendant (the close button) is clicked', async () => {
    // Pin the contract that bubbled clicks from inner interactive
    // elements don't accidentally trigger the background-close listener.
    // Click → button's onClick fires close() once; the bubble reaches
    // the outer div but target !== currentTarget so background handler
    // no-ops. Exact-count assertion catches any regression to an
    // always-close listener.
    const user = userEvent.setup();
    render(<OverlayView />);
    mockClose.mockClear();
    await user.click(screen.getByRole('button', { name: /back to site/i }));
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT listen for Escape after isOpen flips false (cleanup)', () => {
    // Close the overlay first by flipping the mock (re-render with isOpen=false
    // would normally be driven by the provider; here we verify by asserting the
    // listener attaches only when isOpen is true).
    const { unmount } = render(<OverlayView />);
    unmount();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    // mockClose was called during the initial setup in a prior test path;
    // here we verify that a post-unmount Escape doesn't fire close. Use
    // clearAllMocks semantics via the beforeEach jest.clearAllMocks to baseline.
    expect(mockClose).not.toHaveBeenCalled();
  });

  it('renders only Overview / Timeline / Consent tabs in that order (post-9E-D2)', () => {
    render(<OverlayView />);
    // Overview + Timeline + Consent, the three-tab set after D2.
    expect(screen.getByRole('button', { name: /^Overview$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Timeline/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Consent$/i })).toBeInTheDocument();
    // Legacy Session State / Dashboards / Narrative tabs removed as part of
    // the D2 restructure (UX_PIVOT_SPEC §3.2). HomepageUnderside +
    // DashboardView components deleted; EcommerceUnderside pathname routing
    // removed.
    expect(screen.queryByRole('button', { name: /^Session State$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Dashboards/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Narrative$/i })).not.toBeInTheDocument();
  });

  it('renders the Overview tab content by default on first open', () => {
    // Overview replaces the legacy Overview/Session State tabs as the
    // default landing surface (UX_PIVOT_SPEC §3.2). The stubbed OverviewTab
    // component exposes a stable test-id used here.
    render(<OverlayView />);
    expect(screen.getByTestId('overview-tab-stub')).toBeInTheDocument();
  });

  it('wraps the active tab label in terminal-style brackets (e.g. [ OVERVIEW ])', () => {
    // UX_PIVOT_SPEC §3.2: "active tab labels get terminal-style bracket
    // framing (e.g. `[ OVERVIEW ]` for active, plain for inactive)".
    // Uses aria-label to distinguish from the bracket-wrapped visible text.
    render(<OverlayView />);
    const activeTab = screen.getByRole('button', { name: /^Overview$/i });
    expect(activeTab.textContent).toContain('[ OVERVIEW ]');
    // Inactive tabs render plain text (no bracket wrapping).
    const inactiveTab = screen.getByRole('button', { name: /^Consent$/i });
    expect(inactiveTab.textContent).not.toContain('[');
  });

  it('renders ALL three tab labels in the accent-current color (F2 UAT, not only the active one)', () => {
    // Pre-F2 inactive tabs used text-u-ink-3 (grey), visually they read
    // as low-priority chrome. Post-F2 all three are amber; the bracket
    // framing + border signal active. UAT feedback: "The three tab labels
    // should be amber, not just the active tab label."
    render(<OverlayView />);
    for (const name of ['Overview', 'Timeline', 'Consent']) {
      const tab = screen.getByRole('button', { name: new RegExp(`^${name}`, 'i') });
      expect(tab.className).toMatch(/text-accent-current/);
    }
  });

  it('inactive tabs dim via opacity, not color (accent stays constant)', () => {
    render(<OverlayView />);
    const active = screen.getByRole('button', { name: /^Overview$/i });
    const inactive = screen.getByRole('button', { name: /^Timeline/i });
    // Active: opacity-100 and border-accent-current.
    expect(active.className).toMatch(/opacity-100/);
    expect(active.className).toMatch(/border-accent-current/);
    // Inactive: opacity-60 and no amber border underline.
    expect(inactive.className).toMatch(/opacity-60/);
    expect(inactive.className).toMatch(/border-transparent/);
  });

  it('renders the "Session" header label', () => {
    render(<OverlayView />);
    expect(screen.getByRole('heading', { name: /^session$/i })).toBeInTheDocument();
  });

  it('hides the header icon + subtitle on mobile (F5 UAT S11 declutter)', () => {
    // UAT feedback: overlay header too cluttered on mobile. Icon SVG
    // wrapper + "Live · yours, right now" subtitle both gated `hidden
    // md:flex`/`md:block`; only "Session" title + close button render
    // at <md. Desktop keeps the fuller chrome treatment.
    render(<OverlayView />);
    const title = screen.getByRole('heading', { name: /^session$/i });
    const header = title.closest('header');
    expect(header).not.toBeNull();
    const iconWrapper = header!.querySelector('svg')?.parentElement;
    expect(iconWrapper).not.toBeNull();
    expect(iconWrapper!.className).toMatch(/hidden/);
    expect(iconWrapper!.className).toMatch(/md:flex/);
    // Subtitle ("Live · yours, right now") is the <p> sibling of the h1.
    const subtitle = title.parentElement?.querySelector('p');
    expect(subtitle).not.toBeNull();
    expect(subtitle!.className).toMatch(/hidden/);
    expect(subtitle!.className).toMatch(/md:flex/);
  });

  it('keeps each tab on a single line (whitespace-nowrap) with mobile overflow-x-auto (F5 UAT S11)', () => {
    // UAT feedback: bracket framing wrapped to 3 lines on 360px. Fix
    // pins the responsive layout contract.
    render(<OverlayView />);
    const overview = screen.getByRole('button', { name: /^Overview$/i });
    expect(overview.className).toMatch(/whitespace-nowrap/);
    expect(overview.className).toMatch(/flex-shrink-0/);
    const tabsRow = overview.parentElement;
    expect(tabsRow).not.toBeNull();
    expect(tabsRow!.className).toMatch(/overflow-x-auto/);
  });

  it('enters boot phase on open and transitions to on after ~260ms', () => {
    jest.useFakeTimers();
    render(<OverlayView />);
    const view = screen.getByTestId('overlay-view');
    expect(view.dataset.phase).toBe('boot');
    // CRT field is mounted during boot so the paint-down curtain and warm
    // flicker can animate through the boot hold.
    expect(screen.getByTestId('crt-field')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(260);
    });
    expect(view.dataset.phase).toBe('on');
    expect(screen.getByTestId('crt-field')).toBeInTheDocument();
  });

  it('skips the boot phase under prefers-reduced-motion', () => {
    mockReducedMotion(true);
    render(<OverlayView />);
    const view = screen.getByTestId('overlay-view');
    expect(view.dataset.phase).toBe('on');
    expect(screen.getByTestId('crt-field')).toBeInTheDocument();
  });

  it('renders the ambient amber glow as a sibling of the CRT field, not inside it', () => {
    // The ambient layer is deliberately kept outside the z:3 CRT wrapper so
    // its amber blend stays scoped to the header. If it drifts back inside
    // crt-field it would cover tabs/body too, regressing the preserved effect.
    render(<OverlayView />);
    const ambient = screen.getByTestId('crt-ambient');
    const crtField = screen.getByTestId('crt-field');
    expect(ambient).toBeInTheDocument();
    expect(crtField).toBeInTheDocument();
    expect(crtField.contains(ambient)).toBe(false);
  });

  it('renders all three CRT boot layers inside the z-indexed field wrapper', () => {
    // Prototype boot sequence is: flicker → bloom → scanlines, all inside a
    // z:3 wrapper that covers positioned siblings. Guards against a layer
    // being accidentally dropped during future refactors.
    render(<OverlayView />);
    const crtField = screen.getByTestId('crt-field');
    expect(crtField.querySelector('.crt-flicker')).not.toBeNull();
    expect(crtField.querySelector('.crt-bloom')).not.toBeNull();
    expect(crtField.querySelector('.crt-scanlines')).not.toBeNull();
    expect(crtField.style.zIndex).toBe('3');
  });

  it('mounts the ambient glow during the boot phase', () => {
    // Ambient glow must be present from the moment the overlay opens so the
    // amber reads on the header throughout boot, not just after phase-on.
    jest.useFakeTimers();
    render(<OverlayView />);
    const view = screen.getByTestId('overlay-view');
    expect(view.dataset.phase).toBe('boot');
    expect(screen.getByTestId('crt-ambient')).toBeInTheDocument();
  });

  it('wraps panel body content in a tab-flash element so boot-phase CSS can hide it', () => {
    // During boot the `[data-phase='boot'] .tab-flash { opacity: 0 }` rule
    // hides panel contents so the paint-down curtain reads as the terminal
    // filling in. Verify the wrapper class is present on the body pane.
    const { container } = render(<OverlayView />);
    expect(container.querySelector('.tab-flash')).not.toBeNull();
  });

  it('skips the boot phase when sessionStorage already records a prior boot', () => {
    // First open of a session plays the boot sequence; subsequent opens
    // within the same browser session go straight to phase-on. Simulate the
    // "already booted this session" state by pre-seeding the flag.
    window.sessionStorage.setItem(BOOT_SESSION_KEY, '1');
    render(<OverlayView />);
    const view = screen.getByTestId('overlay-view');
    expect(view.dataset.phase).toBe('on');
  });

  it('sets the sessionStorage flag on first boot so re-opens skip the hold', () => {
    // Guards against regression where boot fires but the flag isn't persisted,
    // which would cause every open to re-boot (the behavior we moved away from).
    render(<OverlayView />);
    expect(window.sessionStorage.getItem(BOOT_SESSION_KEY)).toBe('1');
  });

  it('sets the boot-once flag even on the reduced-motion path', () => {
    // D9 says "once per session, period", a visitor who opens the overlay
    // with reduced-motion on, then later disables reduced-motion and reopens,
    // should NOT see the boot sequence again. Setting the flag on both
    // branches preserves the once-per-session guarantee.
    mockReducedMotion(true);
    render(<OverlayView />);
    expect(window.sessionStorage.getItem(BOOT_SESSION_KEY)).toBe('1');
  });

  it('marks the header and tabs wrapper with an overlay-chrome class for boot-phase hiding', () => {
    // During boot, a `[data-phase='boot'] .overlay-chrome { opacity: 0 }` rule
    // hides the header and tabs so they don't paint under the curtain. Verify
    // the contract classes are on both elements, the CSS rule keys off them.
    const { container } = render(<OverlayView />);
    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    expect(header?.className).toMatch(/overlay-chrome/);

    // Tabs wrapper is the parent div of the tab buttons.
    const tabButton = screen.getByRole('button', { name: /^Overview$/i });
    const tabsWrapper = tabButton.parentElement;
    expect(tabsWrapper).not.toBeNull();
    expect(tabsWrapper?.className).toMatch(/overlay-chrome/);
  });
});
