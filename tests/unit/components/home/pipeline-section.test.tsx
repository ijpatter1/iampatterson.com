/**
 * @jest-environment jsdom
 */
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { PipelineEvent } from '@/lib/events/pipeline-schema';

jest.mock('@/lib/events/track', () => ({
  trackClickCta: jest.fn(),
}));

let mockLiveEvents: PipelineEvent[] = [];
jest.mock('@/hooks/useLiveEvents', () => ({
  useLiveEvents: () => ({ events: mockLiveEvents, source: 'dataLayer' }),
}));

import { PipelineSection } from '@/components/home/pipeline-section';
import { OverlayProvider, useOverlay } from '@/components/overlay/overlay-context';
import { trackClickCta } from '@/lib/events/track';

function Probe() {
  const { isOpen } = useOverlay();
  return <span data-testid="overlay-status">{isOpen ? 'open' : 'closed'}</span>;
}

function renderSection() {
  return render(
    <OverlayProvider>
      <PipelineSection />
      <Probe />
    </OverlayProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLiveEvents = [];

  // Motion enabled by default (jsdom returns no matchMedia).
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  });

  // rAF + cAF — by default route through setTimeout so fake timers can drive it.
  Object.defineProperty(window, 'requestAnimationFrame', {
    writable: true,
    configurable: true,
    value: (cb: FrameRequestCallback) => window.setTimeout(() => cb(performance.now()), 16),
  });
  Object.defineProperty(window, 'cancelAnimationFrame', {
    writable: true,
    configurable: true,
    value: (id: number) => window.clearTimeout(id),
  });

  // Stub IntersectionObserver — default to in-view; tests that need
  // out-of-view override the constructor to capture and invoke the cb.
  class FakeIntersectionObserver {
    callback: IntersectionObserverCallback;
    constructor(cb: IntersectionObserverCallback) {
      this.callback = cb;
    }
    observe = jest.fn(() => {
      // Fire one in-view entry on observe to mimic the spec's initial dispatch.
      this.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
    });
    unobserve = jest.fn();
    disconnect = jest.fn();
    takeRecords = jest.fn(() => []);
  }
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: FakeIntersectionObserver,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

function makeEvent(id: string, name: string, ts: string): PipelineEvent {
  return {
    pipeline_id: id,
    received_at: ts,
    session_id: 'sid-test',
    event_name: name,
    timestamp: ts,
    page_path: '/pipeline',
    page_title: '',
    page_location: '',
    parameters: {},
    consent: {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functionality_storage: 'granted',
    },
    routing: [],
  };
}

/** Stub the section's bounding-rect + viewport so the bleed math is deterministic. */
function stubSectionGeometry(rectTop: number, vh = 800, h = 1600) {
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: vh,
  });
  // Patch HTMLElement.prototype so we don't need a ref.
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    writable: true,
    configurable: true,
    value: function () {
      return {
        top: rectTop,
        bottom: rectTop + h,
        left: 0,
        right: 0,
        width: 0,
        height: h,
        x: 0,
        y: rectTop,
        toJSON: () => ({}),
      };
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    writable: true,
    configurable: true,
    value: h,
  });
}

describe('PipelineSection — content', () => {
  it('renders the editorial heading with measurement emphasis', () => {
    renderSection();
    const h2 = screen.getByRole('heading', { level: 2 });
    expect(h2.textContent).toMatch(/Your session is[\s\S]*being[\s\S]*measured[\s\S]*right now/);
  });

  it('renders all five pipeline stages via the editorial schematic', () => {
    renderSection();
    expect(screen.getByTestId('pipeline-stage-01')).toBeInTheDocument();
    expect(screen.getByTestId('pipeline-stage-02')).toBeInTheDocument();
    expect(screen.getByTestId('pipeline-stage-03')).toBeInTheDocument();
    expect(screen.getByTestId('pipeline-stage-04')).toBeInTheDocument();
    expect(screen.getByTestId('pipeline-stage-05')).toBeInTheDocument();
  });

  it('rotates the active stage on a 1800ms interval', () => {
    jest.useFakeTimers();
    renderSection();
    expect(screen.getByTestId('pipeline-stage-01').dataset.active).toBe('true');
    act(() => {
      jest.advanceTimersByTime(1800);
    });
    expect(screen.getByTestId('pipeline-stage-02').dataset.active).toBe('true');
  });

  it('renders the seed footnote when the live event stream is empty', () => {
    mockLiveEvents = [];
    renderSection();
    const feed = screen.getByTestId('pipeline-log-feed');
    expect(feed.textContent).toContain('session_start');
  });

  it('renders real events in the footnote when available', () => {
    mockLiveEvents = [
      makeEvent('e1', 'page_view', '2026-04-18T14:30:00.000Z'),
      makeEvent('e2', 'scroll_depth', '2026-04-18T14:30:02.000Z'),
    ];
    renderSection();
    const feed = screen.getByTestId('pipeline-log-feed');
    expect(feed.textContent).toContain('page_view');
    expect(feed.textContent).toContain('scroll_depth');
  });
});

describe('PipelineSection — bleed reveal', () => {
  it('writes --bleed=0 and no tier class while the section is below the viewport', () => {
    jest.useFakeTimers();
    stubSectionGeometry(2000); // way below viewport
    renderSection();
    act(() => {
      jest.advanceTimersByTime(60); // a few rAF ticks
    });
    const section = screen.getByTestId('pipeline-section');
    expect(section.style.getPropertyValue('--bleed')).toBe('0.000');
    expect(section.className).not.toMatch(/\bwarm\b/);
    expect(section.className).not.toMatch(/\bhot\b/);
    expect(section.className).not.toMatch(/\bpeak\b/);
  });

  it('applies the warm tier class when bleed crosses 0.18', () => {
    jest.useFakeTimers();
    // bleed ~= 0.4 (between 0.18 and 0.55):
    //   p² = 0.4 → p = √0.4 ≈ 0.632 → clamped = 1 - 0.632 = 0.368
    //   span = enter - peak = 200 - (760 - 1600) = 1040
    //   rectTop - peak = 0.368 * 1040 ≈ 383 → rectTop = 383 + (760 - 1600) = -457
    stubSectionGeometry(-457);
    renderSection();
    act(() => {
      jest.advanceTimersByTime(60);
    });
    const section = screen.getByTestId('pipeline-section');
    expect(section.className).toMatch(/\bwarm\b/);
    expect(section.className).not.toMatch(/\bhot\b/);
  });

  it('applies the hot tier class when bleed crosses 0.55', () => {
    jest.useFakeTimers();
    // bleed ~= 0.7 → p = √0.7 ≈ 0.837 → clamped = 0.163 → rectTop ≈ -670
    stubSectionGeometry(-670);
    renderSection();
    act(() => {
      jest.advanceTimersByTime(60);
    });
    const section = screen.getByTestId('pipeline-section');
    expect(section.className).toMatch(/\bhot\b/);
    expect(section.className).not.toMatch(/\bpeak\b/);
  });

  it('applies the peak class when bleed crosses 0.85', () => {
    jest.useFakeTimers();
    // rectTop at peak threshold (vh*0.95 - h) → bleed = 1
    stubSectionGeometry(800 * 0.95 - 1600); // = -840
    renderSection();
    act(() => {
      jest.advanceTimersByTime(60);
    });
    const section = screen.getByTestId('pipeline-section');
    expect(section.className).toMatch(/\bpeak\b/);
    expect(section.className).toMatch(/\bhot\b/);
  });

  it('writes the computed --bleed value as a 3-decimal string', () => {
    jest.useFakeTimers();
    stubSectionGeometry(800 * 0.95 - 1600); // peak → bleed 1
    renderSection();
    act(() => {
      jest.advanceTimersByTime(60);
    });
    const section = screen.getByTestId('pipeline-section');
    expect(section.style.getPropertyValue('--bleed')).toBe('1.000');
  });

  it('renders the four bleed-layer siblings, all aria-hidden', () => {
    renderSection();
    const section = screen.getByTestId('pipeline-section');
    const layers = section.querySelectorAll('[data-bleed-layer]');
    expect(layers).toHaveLength(4);
    layers.forEach((layer) => {
      expect(layer.getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('does NOT start the rAF loop under prefers-reduced-motion', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });
    jest.useFakeTimers();
    stubSectionGeometry(800 * 0.95 - 1600);
    renderSection();
    act(() => {
      jest.advanceTimersByTime(120);
    });
    const section = screen.getByTestId('pipeline-section');
    // Bleed never gets written → stays at the inline default '0'.
    expect(section.style.getPropertyValue('--bleed')).toBe('0');
    expect(section.className).not.toMatch(/\bwarm\b/);
    expect(section.className).not.toMatch(/\bhot\b/);
    expect(section.className).not.toMatch(/\bpeak\b/);
  });

  it('does NOT schedule flicker bursts at calm tier', () => {
    jest.useFakeTimers();
    stubSectionGeometry(2000); // below viewport → bleed 0 → calm
    renderSection();
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    const section = screen.getByTestId('pipeline-section');
    expect(section.className).not.toMatch(/\bflick\b/);
  });

  it('pauses the rAF loop when the IntersectionObserver reports out-of-view', () => {
    let observerCallback: IntersectionObserverCallback | null = null;
    class CapturingIO {
      constructor(cb: IntersectionObserverCallback) {
        observerCallback = cb;
      }
      observe = jest.fn();
      unobserve = jest.fn();
      disconnect = jest.fn();
      takeRecords = jest.fn(() => []);
    }
    Object.defineProperty(window, 'IntersectionObserver', {
      writable: true,
      configurable: true,
      value: CapturingIO,
    });

    jest.useFakeTimers();
    stubSectionGeometry(800 * 0.95 - 1600);
    renderSection();

    // Fire OUT-of-view first; the loop should never start.
    act(() => {
      observerCallback?.(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      jest.advanceTimersByTime(120);
    });
    const section = screen.getByTestId('pipeline-section');
    expect(section.style.getPropertyValue('--bleed')).toBe('0');

    // Now flip to in-view — bleed should start writing.
    act(() => {
      observerCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      jest.advanceTimersByTime(60);
    });
    expect(section.style.getPropertyValue('--bleed')).toBe('1.000');
  });
});

describe('PipelineSection — flicker scheduler', () => {
  it('schedules a flicker burst at warm tier and clears it after the burst window', () => {
    // Pin Math.random to a deterministic value so we can compute the
    // exact delay/duration the scheduler will use:
    //   delay = 240 + (1 - bleed) * 2200 + rand * 400
    //   duration = 90 + rand * 120
    // With bleed ≈ 0.4 (warm) and rand = 0.5:
    //   delay = 240 + 0.6*2200 + 200 = 240 + 1320 + 200 = 1760ms
    //   duration = 90 + 60 = 150ms
    // The first setTimeout chain inside the scheduler effect is what
    // we drive — burst toggles on around 1762ms (240+0.601*2200+200),
    // off around 1762+150. Use generous brackets to absorb the floating-
    // point fraction in the bleed value and the 60ms warm-up overhead.
    const randSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    jest.useFakeTimers();
    stubSectionGeometry(-457); // warm tier (bleed ≈ 0.4)
    renderSection();
    act(() => {
      jest.advanceTimersByTime(60); // let the rAF compute the bleed → tier flips to warm
    });
    const section = screen.getByTestId('pipeline-section');
    expect(section.className).not.toMatch(/\bflick\b/);
    act(() => {
      jest.advanceTimersByTime(1700); // before the ~1762ms threshold
    });
    expect(section.className).not.toMatch(/\bflick\b/);
    act(() => {
      jest.advanceTimersByTime(100); // crosses the burst-on threshold
    });
    expect(section.className).toMatch(/\bflick\b/);
    act(() => {
      jest.advanceTimersByTime(200); // crosses the burst-off threshold (90+60=150ms duration)
    });
    expect(section.className).not.toMatch(/\bflick\b/);
    randSpy.mockRestore();
  });

  it('schedules MORE FREQUENT bursts as bleed grows (delay decreases with bleed)', () => {
    // The (1 - b) * 2200 term means higher bleed → shorter delay. Test
    // the two endpoints of the formula directly via the in-component
    // constants by asserting that warm-tier first-burst arrives later
    // than peak-tier first-burst.
    const randSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    jest.useFakeTimers();

    // First render: warm. rectTop=-457 with VH=800, H=1600 produces:
    //   p = 1 - ((-457 - (-840)) / 1040) = 1 - 0.3683 = 0.6317
    //   bleed = p² ≈ 0.399 → delay = 240 + (1-0.399)*2200 + 0 ≈ 1562.2ms.
    // Use a generous in/out bracket to absorb the floating-point fraction.
    stubSectionGeometry(-457);
    const { unmount } = renderSection();
    act(() => {
      jest.advanceTimersByTime(60);
    });
    let section = screen.getByTestId('pipeline-section');
    act(() => {
      jest.advanceTimersByTime(1500); // before the 1562ms threshold
    });
    expect(section.className).not.toMatch(/\bflick\b/);
    act(() => {
      jest.advanceTimersByTime(100); // crosses 1562ms → burst fires
    });
    expect(section.className).toMatch(/\bflick\b/);
    unmount();

    // Second render: peak — bleed = 1 → delay = 240 + 0*2200 + 0 = 240ms,
    // burst duration = 90 + 0 = 90ms (so it clears at ~330ms path-relative).
    // Use a slightly-wider-than-1ms bracket but stay within the 90ms burst
    // window so we land inside the on-state.
    stubSectionGeometry(800 * 0.95 - 1600);
    renderSection();
    act(() => {
      jest.advanceTimersByTime(60);
    });
    section = screen.getByTestId('pipeline-section');
    act(() => {
      jest.advanceTimersByTime(200); // T_path = 260, before the ~240ms-from-effect-start threshold
    });
    expect(section.className).not.toMatch(/\bflick\b/);
    act(() => {
      jest.advanceTimersByTime(50); // T_path = 310, inside the 90ms burst window
    });
    expect(section.className).toMatch(/\bflick\b/);
    randSpy.mockRestore();
  });
});

describe('PipelineSection — cleanup on unmount', () => {
  it('cancels rAF and disconnects IntersectionObserver on unmount', () => {
    // Fake timers FIRST — modern Jest replaces window.requestAnimationFrame
    // and window.cancelAnimationFrame when fake timers are enabled, so any
    // earlier override would be clobbered. Override our spies AFTER.
    jest.useFakeTimers({ doNotFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });

    const rafIds: number[] = [];
    let nextId = 1000;
    Object.defineProperty(window, 'requestAnimationFrame', {
      writable: true,
      configurable: true,
      value: (cb: FrameRequestCallback) => {
        const id = nextId++;
        rafIds.push(id);
        window.setTimeout(() => cb(performance.now()), 16);
        return id;
      },
    });
    const cancelSpy = jest.fn();
    Object.defineProperty(window, 'cancelAnimationFrame', {
      writable: true,
      configurable: true,
      value: cancelSpy,
    });
    const disconnectSpy = jest.fn();
    // Capture the IO callback and fire isIntersecting=true on observe so
    // the rAF loop actually starts — only then will unmount have a frame
    // to cancel.
    class CapturingIO {
      callback: IntersectionObserverCallback;
      constructor(cb: IntersectionObserverCallback) {
        this.callback = cb;
      }
      observe = jest.fn(() => {
        this.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      });
      unobserve = jest.fn();
      disconnect = disconnectSpy;
      takeRecords = jest.fn(() => []);
    }
    Object.defineProperty(window, 'IntersectionObserver', {
      writable: true,
      configurable: true,
      value: CapturingIO,
    });
    stubSectionGeometry(800 * 0.95 - 1600);
    const { unmount } = renderSection();
    act(() => {
      jest.advanceTimersByTime(60);
    });
    // Sanity: the rAF stub was hit at least once → loop is actually running.
    expect(rafIds.length).toBeGreaterThan(0);
    act(() => {
      unmount();
    });
    expect(disconnectSpy).toHaveBeenCalled();
    expect(cancelSpy).toHaveBeenCalled();
  });
});

describe('PipelineSection — See your session CTA', () => {
  it('opens the overlay and fires click_cta with location pipeline_see_your_session', async () => {
    const user = userEvent.setup();
    renderSection();
    const cta = screen.getByRole('button', { name: /see your session/i });
    await user.click(cta);
    expect(screen.getByTestId('overlay-status')).toHaveTextContent('open');
    expect(trackClickCta).toHaveBeenCalledWith('See your session', 'pipeline_see_your_session');
  });

  it('renders a real <button> (focus-trap-safe), not a link', () => {
    renderSection();
    const cta = screen.getByRole('button', { name: /see your session/i });
    expect(cta.tagName).toBe('BUTTON');
    expect(cta.getAttribute('type')).toBe('button');
  });
});
