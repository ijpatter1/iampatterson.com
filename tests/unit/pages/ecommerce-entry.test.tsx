/**
 * @jest-environment jsdom
 *
 * The shop's front page. 17.1 removed the Metabase warmup it scheduled on
 * every visit: with the dashboard embed gone, the warmup spent BigQuery on
 * nothing, and forcing dynamic rendering for it gave up a static page.
 */
import { render, screen } from '@testing-library/react';

import * as EcommerceEntryModule from '@/app/demo/ecommerce/page';

const EcommerceDemoPage = EcommerceEntryModule.default;

jest.mock('@/lib/events/track', () => ({
  trackClickCta: jest.fn(),
  trackClickNav: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/demo/ecommerce',
}));

// ListingView + ToastProvider are heavy Client Components that pull
// in CartProvider, event stream hooks, and other contexts we don't
// care about here — the test's scope is the page shell. Stub them out so the Server Component can mount in jsdom
// without a full provider tree.
jest.mock('@/components/demo/ecommerce/listing-view', () => ({
  ListingView: () => null,
}));
jest.mock('@/components/demo/reveal/toast-provider', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Observes whether the page schedules post-response work. Also unblocks
// jsdom, which otherwise chokes on next/server importing the Web Fetch
// `Request` global.
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

  it('schedules no post-response work on render (17.1 removed the Metabase warmup)', () => {
    render(<EcommerceDemoPage />);
    expect(afterMock).not.toHaveBeenCalled();
  });

  // Rendered per request: ListingView reads useSearchParams() under Suspense,
  // and on a static page that boundary renders nothing on the server, so
  // crawlers would get no heading and no product links (17.1 gate).
  it('renders per request so the listing is in the server HTML', () => {
    expect((EcommerceEntryModule as { dynamic?: string }).dynamic).toBe('force-dynamic');
  });
});
