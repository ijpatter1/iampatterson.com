/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SessionPulse } from '@/components/chrome/session-pulse';

// JSDOM does not implement PointerEvent. Define a minimal subclass of
// MouseEvent so React's onPointerEnter handler can observe `pointerType`
// and the coarse-pointer suppression test path is exercisable. Covers
// only the surface this suite needs (type + pointerType + bubbles).
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerType = init.pointerType ?? '';
    }
  }
  (globalThis as unknown as { PointerEvent: typeof PointerEvent }).PointerEvent =
    PointerEventPolyfill as unknown as typeof PointerEvent;
}

jest.mock('@/hooks/useDataLayerEvents', () => ({
  useDataLayerEvents: () => ({ events: [] }),
}));

jest.mock('@/lib/events/session', () => ({
  getSessionId: () => 'abcdef-xyz123456',
  // Phase 10a D3: useSessionId (via session-pulse + live-strip)
  // reads via readSessionCookie and subscribes to cookie-change
  // notifications. Mocks must supply the full API surface.
  readSessionCookie: () => 'abcdef-xyz123456',
  subscribeSessionCookie: () => () => {},
  notifySessionCookieChange: () => {},
}));

jest.mock('@/lib/events/track', () => ({
  trackSessionPulseHover: jest.fn(),
}));

import { trackSessionPulseHover } from '@/lib/events/track';

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe('SessionPulse', () => {
  it('renders a display-only span when no onClick is provided', () => {
    render(<SessionPulse />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/123456/)).toBeInTheDocument();
    expect(screen.getByText(/0 evt/)).toBeInTheDocument();
  });

  it('renders a button when onClick is provided', async () => {
    const onClick = jest.fn();
    const user = userEvent.setup();
    render(<SessionPulse onClick={onClick} />);

    const btn = screen.getByRole('button', { name: /open your session/i });
    expect(btn).toBeInTheDocument();

    await user.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows a session-id placeholder before mount (SSR-safe)', () => {
    render(<SessionPulse />);
    expect(screen.getByText(/123456/)).toBeInTheDocument();
  });

  // Phase 9E D1, hover affordance (tooltip removed in the F1 language
  // consolidation; the instrument-as-nav conceit stands on its own)

  it('does NOT render a verbal tooltip on hover (F1 rename, instrument-as-nav)', async () => {
    // The "NAV · UNDER THE HOOD" tooltip was removed in the F1 language
    // sweep. The button's aria-label carries the semantics for AT users;
    // visible chrome stays clean to avoid re-introducing the fragmentation
    // the rename resolved.
    const user = userEvent.setup();
    render(<SessionPulse onClick={jest.fn()} />);
    const btn = screen.getByRole('button');
    await user.hover(btn);
    expect(screen.queryByTestId('session-pulse-tooltip')).not.toBeInTheDocument();
    expect(screen.queryByText(/NAV[\s·]*UNDER THE HOOD/i)).not.toBeInTheDocument();
  });

  it('satisfies a minimum 44×44 hitbox (WCAG 2.5.5) via min-h-[44px] on the button', () => {
    render(<SessionPulse onClick={jest.fn()} />);
    const btn = screen.getByRole('button');
    // The hitbox is expressed as a Tailwind `min-h-[44px]` class; the
    // JSDOM layout isn't running Tailwind, so we assert the class is
    // present as the durable contract.
    expect(btn.className).toMatch(/min-h-\[44px\]/);
  });

  it('applies the stronger pulse animation at desktop breakpoints (UX_PIVOT_SPEC §3.1)', () => {
    // Spec: "pulse animation is slightly stronger on desktop than
    // mobile. The mobile eye forgives more motion; desktop visitors
    // stare longer." Mobile uses base `animate-session-pulse` (2.4s,
    // scale 2.2); desktop layers `md:animate-session-pulse-strong`
    // (1.9s, scale 2.6) to override. Assert both classes are present
    // on the inner pulse element.
    const { container } = render(<SessionPulse onClick={jest.fn()} />);
    const pulse = container.querySelector('.animate-session-pulse');
    expect(pulse).not.toBeNull();
    expect(pulse?.className).toMatch(/md:animate-session-pulse-strong/);
  });

  it('fires session_pulse_hover on mouse pointer hover (desktop pointer)', () => {
    render(<SessionPulse onClick={jest.fn()} />);
    const btn = screen.getByRole('button');

    // Use fireEvent.pointerEnter so React's synthetic-event system
    // observes the dispatch. Direct `dispatchEvent` on the element
    // wouldn't reach onPointerEnter in React 18 because enter/leave
    // don't bubble up to the delegated root listener.
    fireEvent.pointerEnter(btn, { pointerType: 'mouse' });

    expect(trackSessionPulseHover).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire session_pulse_hover on touch-synthesized hover (coarse-pointer suppression)', () => {
    render(<SessionPulse onClick={jest.fn()} />);
    const btn = screen.getByRole('button');

    fireEvent.pointerEnter(btn, { pointerType: 'touch' });

    expect(trackSessionPulseHover).not.toHaveBeenCalled();
  });

  it('debounces session_pulse_hover to once per 60 seconds per session', () => {
    render(<SessionPulse onClick={jest.fn()} />);
    const btn = screen.getByRole('button');

    fireEvent.pointerEnter(btn, { pointerType: 'mouse' });
    expect(trackSessionPulseHover).toHaveBeenCalledTimes(1);
    // A second hover within the debounce window must not re-emit.
    // Leaving + re-entering the button is the common repeat case.
    fireEvent.pointerLeave(btn, { pointerType: 'mouse' });
    fireEvent.pointerEnter(btn, { pointerType: 'mouse' });
    expect(trackSessionPulseHover).toHaveBeenCalledTimes(1);
  });
});
