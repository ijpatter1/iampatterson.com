/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react';

type Callback = (metric: {
  name: 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  id: string;
  navigationType: string;
}) => void;

const callbacks: Partial<Record<'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB', Callback>> = {};

jest.mock('web-vitals', () => ({
  onLCP: (cb: Callback) => {
    callbacks.LCP = cb;
  },
  onCLS: (cb: Callback) => {
    callbacks.CLS = cb;
  },
  onINP: (cb: Callback) => {
    callbacks.INP = cb;
  },
  onFCP: (cb: Callback) => {
    callbacks.FCP = cb;
  },
  onTTFB: (cb: Callback) => {
    callbacks.TTFB = cb;
  },
}));

jest.mock('@/lib/events/track', () => ({
  trackWebVital: jest.fn(),
}));

import { trackWebVital } from '@/lib/events/track';

const mockTrackWebVital = trackWebVital as jest.Mock;

async function flushDynamicImport(): Promise<void> {
  // The reporter uses `import('web-vitals')`, which resolves on a microtask.
  // Two awaits cover both the dynamic import's resolution and the `.then`
  // callback landing the subscription functions.
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(callbacks) as Array<keyof typeof callbacks>) {
    delete callbacks[k];
  }
});

describe('WebVitalsReporter', () => {
  function getComponent() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@/components/scripts/web-vitals-reporter').WebVitalsReporter;
  }

  it('renders nothing', () => {
    const WebVitalsReporter = getComponent();
    const { container } = render(<WebVitalsReporter />);
    expect(container.firstChild).toBeNull();
  });

  it('subscribes to all five CWV callbacks (LCP, CLS, INP, FCP, TTFB) after mount', async () => {
    const WebVitalsReporter = getComponent();
    render(<WebVitalsReporter />);
    await flushDynamicImport();
    expect(callbacks.LCP).toBeDefined();
    expect(callbacks.CLS).toBeDefined();
    expect(callbacks.INP).toBeDefined();
    expect(callbacks.FCP).toBeDefined();
    expect(callbacks.TTFB).toBeDefined();
  });

  it('forwards each metric to trackWebVital with the schema-shaped params', async () => {
    const WebVitalsReporter = getComponent();
    render(<WebVitalsReporter />);
    await flushDynamicImport();

    callbacks.LCP?.({
      name: 'LCP',
      value: 1850,
      rating: 'good',
      id: 'v4-LCP-1',
      navigationType: 'navigate',
    });
    expect(mockTrackWebVital).toHaveBeenLastCalledWith({
      metric_name: 'LCP',
      metric_value: 1850,
      metric_rating: 'good',
      metric_id: 'v4-LCP-1',
      navigation_type: 'navigate',
    });

    callbacks.CLS?.({
      name: 'CLS',
      value: 0.08,
      rating: 'good',
      id: 'v4-CLS-1',
      navigationType: 'navigate',
    });
    expect(mockTrackWebVital).toHaveBeenLastCalledWith({
      metric_name: 'CLS',
      metric_value: 0.08,
      metric_rating: 'good',
      metric_id: 'v4-CLS-1',
      navigation_type: 'navigate',
    });

    callbacks.INP?.({
      name: 'INP',
      value: 240,
      rating: 'needs-improvement',
      id: 'v4-INP-1',
      navigationType: 'back-forward-cache',
    });
    expect(mockTrackWebVital).toHaveBeenLastCalledWith({
      metric_name: 'INP',
      metric_value: 240,
      metric_rating: 'needs-improvement',
      metric_id: 'v4-INP-1',
      navigation_type: 'back-forward-cache',
    });

    expect(mockTrackWebVital).toHaveBeenCalledTimes(3);
  });

  it('cancels a pending dynamic import when unmount precedes module resolution', async () => {
    // Scope: this test pins the cancelled-before-subscribe path. The
    // reporter is root-layout-scoped so a post-subscribe unmount isn't
    // a real-world path; if that ever changes (e.g. the reporter moves
    // under a conditional route boundary), add a separate test covering
    // unsubscribe after web-vitals has registered its listeners.
    const WebVitalsReporter = getComponent();
    const { unmount } = render(<WebVitalsReporter />);
    unmount();
    await flushDynamicImport();
    expect(callbacks.LCP).toBeUndefined();
    expect(callbacks.CLS).toBeUndefined();
    expect(callbacks.INP).toBeUndefined();
    expect(callbacks.FCP).toBeUndefined();
    expect(callbacks.TTFB).toBeUndefined();
  });

  // Note: the reporter's import('web-vitals').catch(...) handler swallows
  // CDN / adblock / integrity failures silently. Not pinned by a jest
  // test here because jest.resetModules + jest.doMock for a throwing
  // web-vitals mock also resets React and breaks the hook dispatcher.
  // The try-at-call-site is the guard; if jest's test infrastructure
  // later supports per-test module-graph overrides that preserve React,
  // add an assertion that no unhandled rejection surfaces on import
  // failure.
});
