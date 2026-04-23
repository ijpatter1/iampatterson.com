/**
 * @jest-environment jsdom
 *
 * Phase 10a D2 behaviour pin for the ecommerce demo-entry Server
 * Component — parity with `homepage.test.tsx`'s pin. Closes the
 * Pass-2 asymmetric-coverage Minor (homepage had both source-sniff
 * + behaviour-level coverage; ecommerce-entry had only source-sniff
 * in `keep-warm-wiring.test.ts`).
 *
 * Catches refactors that drop the `after()` wrapper, shadow the hook
 * with a different function, or gate the warmup behind a conditional
 * that fails silently.
 */
import { render, screen } from '@testing-library/react';

import EcommerceDemoPage from '@/app/demo/ecommerce/page';

jest.mock('@/lib/events/track', () => ({
  trackClickCta: jest.fn(),
  trackClickNav: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/demo/ecommerce',
}));

jest.mock('@/lib/metabase/keep-warm', () => ({
  warmMetabaseDashboard: jest.fn(),
}));

// ListingView + ToastProvider are heavy Client Components that pull
// in CartProvider, event stream hooks, and other contexts we don't
// care about here — the test's scope is strictly the `after()`
// wiring. Stub them out so the Server Component can mount in jsdom
// without a full provider tree.
jest.mock('@/components/demo/ecommerce/listing-view', () => ({
  ListingView: () => null,
}));
jest.mock('@/components/demo/reveal/toast-provider', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mirror of `homepage.test.tsx`'s after() mock: the callback is
// executed synchronously so we can observe warmMetabaseDashboard's
// call-count downstream. Also unblocks jsdom, which otherwise chokes
// on next/server importing the Web Fetch `Request` global.
const afterMock = jest.fn((cb: () => void) => cb());
jest.mock('next/server', () => ({
  after: (cb: () => void) => afterMock(cb),
}));

describe('EcommerceDemoPage composition', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    afterMock.mockClear();
  });

  it('renders the listing main region', () => {
    render(<EcommerceDemoPage />);
    // ListingView is inside Suspense with `fallback={null}`, so on
    // initial render the Suspense boundary resolves synchronously in
    // jsdom (no React.lazy / async data fetching at this layer).
    // `<main>` from the page body is always in the tree.
    const main = screen.getAllByRole('main');
    expect(main.length).toBeGreaterThanOrEqual(1);
  });

  // Phase 10a D2 behaviour pin: ecommerce demo-entry render must
  // invoke `after()` exactly once with a callback that, when executed,
  // calls the real warmMetabaseDashboard hook. Parity with the
  // homepage pin — catches refactors that drop the warmup wiring,
  // shadow the hook, or gate it behind a conditional.
  it('schedules the Metabase warmup via after() on render', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const keepWarm = require('@/lib/metabase/keep-warm') as {
      warmMetabaseDashboard: jest.Mock;
    };
    keepWarm.warmMetabaseDashboard.mockClear();

    render(<EcommerceDemoPage />);

    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(typeof afterMock.mock.calls[0][0]).toBe('function');
    expect(keepWarm.warmMetabaseDashboard).toHaveBeenCalledTimes(1);
  });
});
