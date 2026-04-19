/**
 * @jest-environment jsdom
 *
 * Phase 9B deliverable 6b — integration test for the confirmation page
 * Server Component. Guards the env → signer → Tier3Embeds wiring so a
 * typo in an env var name, a dropped `&&` guard, or a mis-named prop
 * fails loudly here rather than silently breaking the deployed page.
 */
import type { ReactElement } from 'react';

import { render, screen } from '@testing-library/react';

import ConfirmationPage from '@/app/demo/ecommerce/confirmation/page';

const VALID_CONFIG = '{"dashboardId":2,"cardIds":{"funnel":40,"aov":41,"dailyRevenue":45}}';
const VALID_SECRET = 'test-secret-0123456789abcdef0123456789abcdef';

const ORIG_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

function renderPage(searchParams: Record<string, string | string[] | undefined> = {}) {
  // ConfirmationPage is a Server Component; at runtime it's invoked with
  // { searchParams } and returns JSX synchronously (no async work).
  //
  // ⚠️ If this page ever becomes `async` (e.g., to await data), this cast
  // silently lies — render(node) will receive a Promise<ReactElement>
  // instead of an element. In that case, switch to:
  //   const node = await (ConfirmationPage as unknown as (p: ...) => Promise<ReactElement>)({...})
  // and make the tests async.
  const node = (
    ConfirmationPage as unknown as (p: {
      searchParams: Record<string, string | string[] | undefined>;
    }) => ReactElement
  )({ searchParams });
  return render(node);
}

describe('ConfirmationPage — env → embeds wiring', () => {
  it('renders the order confirmation block with the search-param values', () => {
    renderPage({ order_id: 'demo-tier3', total: '44.98', items: '2' });
    expect(screen.getByText(/Order confirmed · demo-tier3/)).toBeInTheDocument();
    expect(screen.getByText(/\$44\.98/)).toBeInTheDocument();
  });

  it('mints three iframe URLs when both env vars are present', () => {
    process.env.MB_EMBEDDING_SECRET_KEY = VALID_SECRET;
    process.env.METABASE_EMBED_CONFIG = VALID_CONFIG;

    const { container } = renderPage({ order_id: 'demo-tier3', total: '44.98', items: '2' });

    const iframes = container.querySelectorAll('iframe');
    expect(iframes).toHaveLength(3);
    iframes.forEach((frame) => {
      expect(
        frame.getAttribute('src')?.startsWith('https://bi.iampatterson.com/embed/question/'),
      ).toBe(true);
    });
  });

  it('renders the visible fallback block when MB_EMBEDDING_SECRET_KEY is missing', () => {
    delete process.env.MB_EMBEDDING_SECRET_KEY;
    process.env.METABASE_EMBED_CONFIG = VALID_CONFIG;

    renderPage({ order_id: 'demo-tier3', total: '44.98', items: '2' });

    expect(screen.getByTestId('tier3-fallback')).toBeInTheDocument();
    expect(screen.queryByTitle(/Daily revenue/)).toBeNull();
  });

  it('renders the visible fallback when METABASE_EMBED_CONFIG is missing', () => {
    process.env.MB_EMBEDDING_SECRET_KEY = VALID_SECRET;
    delete process.env.METABASE_EMBED_CONFIG;

    renderPage({ order_id: 'demo-tier3', total: '44.98', items: '2' });

    expect(screen.getByTestId('tier3-fallback')).toBeInTheDocument();
  });

  it('interpolates the order total into the AOV caption (spec drift guard)', () => {
    process.env.MB_EMBEDDING_SECRET_KEY = VALID_SECRET;
    process.env.METABASE_EMBED_CONFIG = VALID_CONFIG;

    renderPage({ order_id: 'demo-tier3', total: '44.98', items: '2' });

    expect(screen.getByText(/your order was \$44\.98/i)).toBeInTheDocument();
  });

  it('normalizes duplicate query params (string[] searchParams) to the first value', () => {
    process.env.MB_EMBEDDING_SECRET_KEY = VALID_SECRET;
    process.env.METABASE_EMBED_CONFIG = VALID_CONFIG;

    // Next.js App Router gives string[] for repeated params like ?total=1&total=2
    renderPage({ order_id: ['demo-tier3', 'second'], total: ['44.98', '99'], items: ['2'] });

    expect(screen.getByText(/Order confirmed · demo-tier3/)).toBeInTheDocument();
    // $44.98 may appear in both the order total and the AOV caption —
    // finding at least one instance confirms the first-value normalization
    expect(screen.getAllByText(/\$44\.98/).length).toBeGreaterThanOrEqual(1);
  });

  it('sanitizes non-finite total/items so OrderConfirmation never renders "$NaN"', () => {
    // parseFloat('abc') → NaN; ?total=Infinity or negative values also slip
    // past a naive `> 0` guard. The page boundary now clamps these to 0.
    renderPage({ order_id: 'ORD-T3-DEMO', total: 'abc', items: 'xyz' });
    expect(screen.getByText(/\$0\.00/)).toBeInTheDocument();
    expect(screen.queryByText(/\$NaN/)).toBeNull();
    expect(screen.queryByText(/\$Infinity/)).toBeNull();
  });

  it('rejects negative numeric params at the page boundary (treats as 0)', () => {
    renderPage({ order_id: 'ORD-T3-DEMO', total: '-100', items: '-5' });
    expect(screen.getByText(/\$0\.00/)).toBeInTheDocument();
    // Items row should show 0, not -5
    expect(screen.queryByText(/-5/)).toBeNull();
  });

  it('does not leak MB_EMBEDDING_SECRET_KEY into the rendered HTML', () => {
    process.env.MB_EMBEDDING_SECRET_KEY = VALID_SECRET;
    process.env.METABASE_EMBED_CONFIG = VALID_CONFIG;

    const { container } = renderPage({ order_id: 'demo-tier3', total: '44.98', items: '2' });
    expect(container.innerHTML).not.toContain(VALID_SECRET);
  });
});
