/**
 * @jest-environment jsdom
 *
 * Phase 9E D1 first-session pulse-ring hint. Pinning:
 *  - 3s idle trigger / 10s auto-clear (animated) / 6s fade (reduced-motion)
 *  - Idle definition: scroll/click/keydown/pointermove on document
 *  - Dismissal modes: scroll, click_outside, timeout, three values post-
 *    UAT (click_session_pulse removed: SessionPulse click is a
 *    conversion tracked via click_cta(session_pulse), not a dismissal)
 *  - Once-per-session via sessionStorage gate (set on render, not mount)
 *  - Homepage-entry-scoped (only fires on `/`)
 *  - Reduced-motion: static text "← your session" instead of ring
 *  - nav_hint_shown emits on render; nav_hint_dismissed emits on dismiss
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';

import { NAV_HINT_STORAGE_KEY, NavHint } from '@/components/chrome/nav-hint';

let mockPathname = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

jest.mock('@/lib/events/track', () => ({
  trackNavHintShown: jest.fn(),
  trackNavHintDismissed: jest.fn(),
}));

import { trackNavHintDismissed, trackNavHintShown } from '@/lib/events/track';

const mockShown = trackNavHintShown as jest.Mock;
const mockDismissed = trackNavHintDismissed as jest.Mock;

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

function Harness() {
  // The harness owns the ref to the simulated SessionPulse element so
  // SessionPulse-click (hide visually, no dismissal event) vs
  // exercised by clicking inside vs outside this element.
  const pulseRef = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button ref={pulseRef} type="button" data-testid="fake-session-pulse">
        SessionPulse stand-in
      </button>
      <NavHint sessionPulseRef={pulseRef} />
    </div>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  window.sessionStorage.clear();
  mockPathname = '/';
  mockReducedMotion(false);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('NavHint, first-session pulse ring', () => {
  it('does NOT render on initial mount (waits for the 3s idle window)', () => {
    render(<Harness />);
    expect(screen.queryByTestId('nav-hint')).not.toBeInTheDocument();
  });

  it('renders the animated pulse ring after 3s of idle on the homepage', () => {
    render(<Harness />);
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    const hint = screen.getByTestId('nav-hint');
    expect(hint.dataset.variant).toBe('pulse-ring');
    expect(mockShown).toHaveBeenCalledTimes(1);
  });

  it('writes the sessionStorage gate when the hint actually renders (not on mount)', () => {
    render(<Harness />);
    expect(window.sessionStorage.getItem(NAV_HINT_STORAGE_KEY)).toBeNull();
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(window.sessionStorage.getItem(NAV_HINT_STORAGE_KEY)).toBe('1');
  });

  it('does NOT render if the sessionStorage gate is already set (once-per-session)', () => {
    window.sessionStorage.setItem(NAV_HINT_STORAGE_KEY, '1');
    render(<Harness />);
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(screen.queryByTestId('nav-hint')).not.toBeInTheDocument();
    expect(mockShown).not.toHaveBeenCalled();
  });

  it('does NOT render on non-homepage routes (homepage-entry-scoped)', () => {
    mockPathname = '/services';
    render(<Harness />);
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(screen.queryByTestId('nav-hint')).not.toBeInTheDocument();
    expect(mockShown).not.toHaveBeenCalled();
  });

  describe('idle reset (any scroll/click/keydown/pointermove pushes the 3s timer)', () => {
    it('resets on scroll', () => {
      render(<Harness />);
      act(() => {
        jest.advanceTimersByTime(2500);
        document.dispatchEvent(new Event('scroll'));
        jest.advanceTimersByTime(2500);
      });
      // Total elapsed = 5s, but only 2.5s has passed since the last
      // idle-breaking event, hint must not have shown yet.
      expect(screen.queryByTestId('nav-hint')).not.toBeInTheDocument();
      act(() => {
        jest.advanceTimersByTime(500);
      });
      expect(screen.getByTestId('nav-hint')).toBeInTheDocument();
    });

    it('resets on click', () => {
      render(<Harness />);
      act(() => {
        jest.advanceTimersByTime(2500);
        document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        jest.advanceTimersByTime(2500);
      });
      expect(screen.queryByTestId('nav-hint')).not.toBeInTheDocument();
    });

    // Bug fix 2026-04-25: clicking SessionPulse during the pre-show idle
    // window IS a discovery signal (the visitor proved they found the
    // affordance). The hint must never fire after this in the same
    // session. The previous behaviour was to fall through to `resetIdle`
    // — same path as any other click — which kept the timer running and
    // the hint fired ~3s of inactivity later (confirmed in the wild via
    // a Timeline showing nav_hint_shown 10s AFTER click_cta on
    // SessionPulse, then nav_hint_dismissed 10s after that). The
    // session-storage gate must also be set so a subsequent homepage
    // visit in the same session doesn't re-arm the hint.
    it('cancels the pending hint timer when SessionPulse is clicked before show', () => {
      render(<Harness />);
      const pulse = screen.getByTestId('fake-session-pulse');
      act(() => {
        jest.advanceTimersByTime(1500);
        fireEvent.click(pulse);
        // After the SessionPulse click, advance through the original
        // 3s window AND the auto-clear window — the hint must never
        // appear and the dismissal event must never fire.
        jest.advanceTimersByTime(15000);
      });
      expect(screen.queryByTestId('nav-hint')).not.toBeInTheDocument();
      expect(mockShown).not.toHaveBeenCalled();
      expect(mockDismissed).not.toHaveBeenCalled();
    });

    it('writes the sessionStorage gate when SessionPulse is clicked before show', () => {
      render(<Harness />);
      const pulse = screen.getByTestId('fake-session-pulse');
      act(() => {
        jest.advanceTimersByTime(1500);
        fireEvent.click(pulse);
      });
      // Gate set so a subsequent homepage visit in the same session
      // doesn't re-trigger the hint timer.
      expect(window.sessionStorage.getItem('iampatterson.nav_hint.shown')).toBe('1');
    });

    it('resets on keydown', () => {
      render(<Harness />);
      act(() => {
        jest.advanceTimersByTime(2500);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
        jest.advanceTimersByTime(2500);
      });
      expect(screen.queryByTestId('nav-hint')).not.toBeInTheDocument();
    });

    it('resets on pointermove', () => {
      render(<Harness />);
      act(() => {
        jest.advanceTimersByTime(2500);
        document.dispatchEvent(new Event('pointermove'));
        jest.advanceTimersByTime(2500);
      });
      expect(screen.queryByTestId('nav-hint')).not.toBeInTheDocument();
    });
  });

  describe('dismissal modes (after show)', () => {
    function showHint() {
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(screen.getByTestId('nav-hint')).toBeInTheDocument();
    }

    it('dismisses with `scroll` on a scroll event after show', () => {
      render(<Harness />);
      showHint();
      act(() => {
        document.dispatchEvent(new Event('scroll'));
      });
      expect(screen.queryByTestId('nav-hint')).not.toBeInTheDocument();
      expect(mockDismissed).toHaveBeenCalledWith('scroll');
    });

    it('hides visually but does NOT fire nav_hint_dismissed on a SessionPulse click (conversion, not dismissal)', () => {
      // Pre-UAT the enum had `click_session_pulse` as a fourth dismissal
      // value. Post-UAT that value was removed: clicking SessionPulse is
      // the hint's intended conversion, already tracked by click_cta
      // with cta_location='session_pulse'. Firing a dismissal event for
      // the conversion path would conflate engagement with abandonment
      // in BI, making the dismissal metric useless. The hint still
      // disappears visually, this test pins that DOM behavior while
      // confirming zero dismissal-event emission.
      render(<Harness />);
      showHint();
      const pulse = screen.getByTestId('fake-session-pulse');
      mockDismissed.mockClear();
      act(() => {
        fireEvent.click(pulse);
      });
      expect(screen.queryByTestId('nav-hint')).not.toBeInTheDocument();
      expect(mockDismissed).not.toHaveBeenCalled();
    });

    it('dismisses with `click_outside` on a click whose target is anywhere else', () => {
      render(<Harness />);
      showHint();
      // Dispatch a click on document body, target is body, not the
      // pulse element or any descendant of it.
      act(() => {
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(screen.queryByTestId('nav-hint')).not.toBeInTheDocument();
      expect(mockDismissed).toHaveBeenCalledWith('click_outside');
    });

    it('dismisses with `timeout` after the 10s auto-clear timer elapses', () => {
      render(<Harness />);
      showHint();
      act(() => {
        jest.advanceTimersByTime(10_000);
      });
      expect(screen.queryByTestId('nav-hint')).not.toBeInTheDocument();
      expect(mockDismissed).toHaveBeenCalledWith('timeout');
    });

    it('does NOT dismiss on keydown or pointermove during show (those are idle-only events)', () => {
      render(<Harness />);
      showHint();
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
        document.dispatchEvent(new Event('pointermove'));
      });
      expect(screen.getByTestId('nav-hint')).toBeInTheDocument();
      expect(mockDismissed).not.toHaveBeenCalled();
    });

    it('emits dismissal at most once per show even if multiple dismissal triggers fire in succession', () => {
      // Defensive guard against double-emit if scroll + click both fire
      // in the same tick. The dismiss path early-returns when the hint
      // has already left the showing state.
      render(<Harness />);
      showHint();
      act(() => {
        document.dispatchEvent(new Event('scroll'));
        document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(mockDismissed).toHaveBeenCalledTimes(1);
    });
  });

  describe('storage edge cases (Pass 1 evaluator coverage)', () => {
    it('still renders + emits nav_hint_shown when sessionStorage.setItem throws (strict-privacy fallback)', () => {
      // `markShownThisSession` is wrapped in try/catch specifically to
      // survive privacy settings that throw on setItem. The hint must
      // still render + emit in that case, the gate just won't persist
      // (re-fires on next homepage visit). Pass 1 flagged this path
      // as documented-but-untested.
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = jest.fn(() => {
        throw new Error('QuotaExceededError: sessionStorage disabled');
      });

      try {
        render(<Harness />);
        act(() => {
          jest.advanceTimersByTime(3000);
        });
        expect(screen.getByTestId('nav-hint')).toBeInTheDocument();
        expect(mockShown).toHaveBeenCalledTimes(1);
      } finally {
        Storage.prototype.setItem = originalSetItem;
      }
    });

    it('homepage re-visit within the same session is suppressed by the gate after first render', () => {
      // Full re-entry sequence: visitor enters on /services (no hint),
      // navigates to / (hint fires, gate set), navigates to /services
      // (no hint by scope), navigates back to / (no hint by gate).
      mockPathname = '/services';
      const { rerender } = render(<Harness />);
      act(() => {
        jest.advanceTimersByTime(10_000);
      });
      expect(screen.queryByTestId('nav-hint')).not.toBeInTheDocument();

      mockPathname = '/';
      rerender(<Harness />);
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(screen.getByTestId('nav-hint')).toBeInTheDocument();
      expect(mockShown).toHaveBeenCalledTimes(1);

      // Navigate away and back, gate is set; hint must not re-fire.
      mockPathname = '/services';
      rerender(<Harness />);
      mockPathname = '/';
      rerender(<Harness />);
      act(() => {
        jest.advanceTimersByTime(10_000);
      });
      expect(mockShown).toHaveBeenCalledTimes(1);
    });
  });

  describe('reduced-motion variant', () => {
    it('renders the static-text variant under prefers-reduced-motion', () => {
      mockReducedMotion(true);
      render(<Harness />);
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      const hint = screen.getByTestId('nav-hint');
      expect(hint.dataset.variant).toBe('static');
      expect(hint.textContent).toMatch(/your session/i);
    });

    it('auto-clears after 6s in reduced-motion (instead of 10s)', () => {
      mockReducedMotion(true);
      render(<Harness />);
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(screen.getByTestId('nav-hint')).toBeInTheDocument();

      // 6s is the reduced-motion fade duration; advance to 5.9s, still showing.
      act(() => {
        jest.advanceTimersByTime(5900);
      });
      expect(screen.getByTestId('nav-hint')).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(screen.queryByTestId('nav-hint')).not.toBeInTheDocument();
      expect(mockDismissed).toHaveBeenCalledWith('timeout');
    });
  });
});
