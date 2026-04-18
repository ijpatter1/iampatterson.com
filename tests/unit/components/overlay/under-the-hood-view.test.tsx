/**
 * @jest-environment jsdom
 */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { UnderTheHoodView } from '@/components/overlay/under-the-hood-view';

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

  it('renders exactly four tabs on the homepage (Overview/Timeline/Consent/Dashboards)', () => {
    render(<UnderTheHoodView />);
    expect(screen.getByRole('button', { name: /^Overview$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Timeline/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Consent$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Dashboards/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Narrative$/i })).not.toBeInTheDocument();
  });

  it('renders HomepageUnderside content by default on homepage', () => {
    render(<UnderTheHoodView />);
    // HomepageUnderside surfaces a recognizable editorial kicker
    expect(screen.getByText(/tier 1 · running under your session/i)).toBeInTheDocument();
  });

  it('renders the "Under the Hood" header label', () => {
    render(<UnderTheHoodView />);
    expect(screen.getByRole('heading', { name: /under the hood/i })).toBeInTheDocument();
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
});
