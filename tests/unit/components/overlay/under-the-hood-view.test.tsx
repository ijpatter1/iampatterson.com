/**
 * @jest-environment jsdom
 */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BOOT_SESSION_KEY, UnderTheHoodView } from '@/components/overlay/under-the-hood-view';

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

describe('UnderTheHoodView — editorial / CRT redesign', () => {
  it('renders as a full-page overlay when isOpen is true', () => {
    render(<UnderTheHoodView />);
    const view = screen.getByTestId('under-the-hood-view');
    expect(view).toBeInTheDocument();
    expect(view.className).toContain('fixed');
    expect(view.className).toContain('inset-0');
  });

  it('renders the "Back to site" close button', () => {
    render(<UnderTheHoodView />);
    expect(screen.getByRole('button', { name: /back to site/i })).toBeInTheDocument();
  });

  it('renders a backdrop close button behind the panel', () => {
    render(<UnderTheHoodView />);
    expect(screen.getByRole('button', { name: /close overlay/i })).toBeInTheDocument();
  });

  it('calls close when "Back to site" is clicked', async () => {
    const user = userEvent.setup();
    render(<UnderTheHoodView />);
    await user.click(screen.getByRole('button', { name: /back to site/i }));
    expect(mockClose).toHaveBeenCalled();
  });

  it('calls close when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    render(<UnderTheHoodView />);
    await user.click(screen.getByRole('button', { name: /close overlay/i }));
    expect(mockClose).toHaveBeenCalled();
  });

  it('renders only Overview / Timeline / Consent tabs in that order (post-9E-D2)', () => {
    render(<UnderTheHoodView />);
    // Overview + Timeline + Consent — the three-tab set after D2.
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
    render(<UnderTheHoodView />);
    expect(screen.getByTestId('overview-tab-stub')).toBeInTheDocument();
  });

  it('wraps the active tab label in terminal-style brackets (e.g. [ OVERVIEW ])', () => {
    // UX_PIVOT_SPEC §3.2: "active tab labels get terminal-style bracket
    // framing (e.g. `[ OVERVIEW ]` for active, plain for inactive)".
    // Uses aria-label to distinguish from the bracket-wrapped visible text.
    render(<UnderTheHoodView />);
    const activeTab = screen.getByRole('button', { name: /^Overview$/i });
    expect(activeTab.textContent).toContain('[ OVERVIEW ]');
    // Inactive tabs render plain text (no bracket wrapping).
    const inactiveTab = screen.getByRole('button', { name: /^Consent$/i });
    expect(inactiveTab.textContent).not.toContain('[');
  });

  it('renders the "Session" header label', () => {
    render(<UnderTheHoodView />);
    expect(screen.getByRole('heading', { name: /^session$/i })).toBeInTheDocument();
  });

  it('enters boot phase on open and transitions to on after ~260ms', () => {
    jest.useFakeTimers();
    render(<UnderTheHoodView />);
    const view = screen.getByTestId('under-the-hood-view');
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
    render(<UnderTheHoodView />);
    const view = screen.getByTestId('under-the-hood-view');
    expect(view.dataset.phase).toBe('on');
    expect(screen.getByTestId('crt-field')).toBeInTheDocument();
  });

  it('renders the ambient amber glow as a sibling of the CRT field, not inside it', () => {
    // The ambient layer is deliberately kept outside the z:3 CRT wrapper so
    // its amber blend stays scoped to the header. If it drifts back inside
    // crt-field it would cover tabs/body too, regressing the preserved effect.
    render(<UnderTheHoodView />);
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
    render(<UnderTheHoodView />);
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
    render(<UnderTheHoodView />);
    const view = screen.getByTestId('under-the-hood-view');
    expect(view.dataset.phase).toBe('boot');
    expect(screen.getByTestId('crt-ambient')).toBeInTheDocument();
  });

  it('wraps panel body content in a tab-flash element so boot-phase CSS can hide it', () => {
    // During boot the `[data-phase='boot'] .tab-flash { opacity: 0 }` rule
    // hides panel contents so the paint-down curtain reads as the terminal
    // filling in. Verify the wrapper class is present on the body pane.
    const { container } = render(<UnderTheHoodView />);
    expect(container.querySelector('.tab-flash')).not.toBeNull();
  });

  it('skips the boot phase when sessionStorage already records a prior boot', () => {
    // First open of a session plays the boot sequence; subsequent opens
    // within the same browser session go straight to phase-on. Simulate the
    // "already booted this session" state by pre-seeding the flag.
    window.sessionStorage.setItem(BOOT_SESSION_KEY, '1');
    render(<UnderTheHoodView />);
    const view = screen.getByTestId('under-the-hood-view');
    expect(view.dataset.phase).toBe('on');
  });

  it('sets the sessionStorage flag on first boot so re-opens skip the hold', () => {
    // Guards against regression where boot fires but the flag isn't persisted,
    // which would cause every open to re-boot (the behavior we moved away from).
    render(<UnderTheHoodView />);
    expect(window.sessionStorage.getItem(BOOT_SESSION_KEY)).toBe('1');
  });

  it('sets the boot-once flag even on the reduced-motion path', () => {
    // D9 says "once per session, period" — a visitor who opens the overlay
    // with reduced-motion on, then later disables reduced-motion and reopens,
    // should NOT see the boot sequence again. Setting the flag on both
    // branches preserves the once-per-session guarantee.
    mockReducedMotion(true);
    render(<UnderTheHoodView />);
    expect(window.sessionStorage.getItem(BOOT_SESSION_KEY)).toBe('1');
  });

  it('marks the header and tabs wrapper with an overlay-chrome class for boot-phase hiding', () => {
    // During boot, a `[data-phase='boot'] .overlay-chrome { opacity: 0 }` rule
    // hides the header and tabs so they don't paint under the curtain. Verify
    // the contract classes are on both elements — the CSS rule keys off them.
    const { container } = render(<UnderTheHoodView />);
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
