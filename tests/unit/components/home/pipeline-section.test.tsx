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

describe('PipelineSection — Watch it live CTA', () => {
  it('opens the overlay and fires click_cta with location pipeline_watch_it_live', async () => {
    const user = userEvent.setup();
    renderSection();
    const cta = screen.getByRole('button', { name: /watch it live/i });
    await user.click(cta);
    expect(screen.getByTestId('overlay-status')).toHaveTextContent('open');
    expect(trackClickCta).toHaveBeenCalledWith('Watch it live', 'pipeline_watch_it_live');
  });

  it('renders a real <button> (focus-trap-safe), not a link', () => {
    renderSection();
    const cta = screen.getByRole('button', { name: /watch it live/i });
    expect(cta.tagName).toBe('BUTTON');
    expect(cta.getAttribute('type')).toBe('button');
  });
});
