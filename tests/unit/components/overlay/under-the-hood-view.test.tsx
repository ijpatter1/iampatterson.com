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
});
