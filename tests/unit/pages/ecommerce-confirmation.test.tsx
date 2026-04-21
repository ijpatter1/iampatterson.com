/**
 * @jest-environment jsdom
 *
 * Phase 9F D9 — integration test for the confirmation page Server Component.
 *
 * Guards the env → dashboard-signer → DashboardPayoff wiring so a typo in an
 * env var name, a dropped `&&` guard, or a mis-named prop fails loudly here
 * rather than silently breaking the deployed page. Replaces the pre-9F
 * three-iframe integration guards (`/embed/question/:jwt` × 3 + AOV caption
 * interpolation + `tier3-fallback` testid) with the single-dashboard-embed
 * variants (`/embed/dashboard/:jwt` × 1 + `view full dashboard` link +
 * zombie-state $total fallback per the doc spec).
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
  const node = (
    ConfirmationPage as unknown as (p: {
      searchParams: Record<string, string | string[] | undefined>;
    }) => ReactElement
  )({ searchParams });
  return render(node);
}

describe('ConfirmationPage — env → dashboard-embed wiring', () => {
  it('renders the order confirmation block with the search-param values', () => {
    renderPage({ order_id: 'demo-d9', total: '44.98', items: '2' });
    expect(screen.getByText(/order confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/demo-d9/)).toBeInTheDocument();
    // $44.98 appears in the lead paragraph + the total meta row
    expect(screen.getAllByText(/\$44\.98/).length).toBeGreaterThanOrEqual(1);
  });

  it('mints ONE full-dashboard iframe URL when both env vars are present', () => {
    process.env.MB_EMBEDDING_SECRET_KEY = VALID_SECRET;
    process.env.METABASE_EMBED_CONFIG = VALID_CONFIG;

    const { container } = renderPage({ order_id: 'demo-d9', total: '44.98', items: '2' });

    const iframes = container.querySelectorAll('iframe');
    expect(iframes).toHaveLength(1);
    expect(iframes[0].getAttribute('src')).toMatch(
      /^https:\/\/bi\.iampatterson\.com\/embed\/dashboard\//,
    );
  });

  it('renders the visible fallback when MB_EMBEDDING_SECRET_KEY is missing', () => {
    delete process.env.MB_EMBEDDING_SECRET_KEY;
    process.env.METABASE_EMBED_CONFIG = VALID_CONFIG;

    const { container } = renderPage({ order_id: 'demo-d9', total: '44.98', items: '2' });

    expect(container.querySelectorAll('iframe')).toHaveLength(0);
    expect(
      screen.getByText(/signing env vars aren't wired in this environment/i),
    ).toBeInTheDocument();
  });

  it('renders the visible fallback when METABASE_EMBED_CONFIG is missing', () => {
    process.env.MB_EMBEDDING_SECRET_KEY = VALID_SECRET;
    delete process.env.METABASE_EMBED_CONFIG;

    const { container } = renderPage({ order_id: 'demo-d9', total: '44.98', items: '2' });

    expect(container.querySelectorAll('iframe')).toHaveLength(0);
    expect(
      screen.getByText(/signing env vars aren't wired in this environment/i),
    ).toBeInTheDocument();
  });

  it('normalizes duplicate query params (string[] searchParams) to the first value', () => {
    process.env.MB_EMBEDDING_SECRET_KEY = VALID_SECRET;
    process.env.METABASE_EMBED_CONFIG = VALID_CONFIG;

    renderPage({ order_id: ['demo-d9', 'second'], total: ['44.98', '99'], items: ['2'] });

    expect(screen.getByText(/demo-d9/)).toBeInTheDocument();
    expect(screen.getAllByText(/\$44\.98/).length).toBeGreaterThanOrEqual(1);
  });

  it('zombie-state fallback: non-finite total renders generic "a real order" copy, not $NaN', () => {
    renderPage({ order_id: 'ORD-D9-DEMO', total: 'abc', items: 'xyz' });
    // Generic lead copy (no $ interpolation)
    expect(
      screen.getByText(/a real order just landed in production BigQuery/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\$NaN/)).toBeNull();
    expect(screen.queryByText(/\$Infinity/)).toBeNull();
  });

  it('zombie-state fallback: negative total treated as 0, generic copy renders', () => {
    renderPage({ order_id: 'ORD-D9-DEMO', total: '-100', items: '-5' });
    expect(
      screen.getByText(/a real order just landed in production BigQuery/i),
    ).toBeInTheDocument();
    // No $-100.00 visible
    expect(screen.queryByText(/-100/)).toBeNull();
  });

  it('does not leak MB_EMBEDDING_SECRET_KEY into the rendered HTML', () => {
    process.env.MB_EMBEDDING_SECRET_KEY = VALID_SECRET;
    process.env.METABASE_EMBED_CONFIG = VALID_CONFIG;

    const { container } = renderPage({ order_id: 'demo-d9', total: '44.98', items: '2' });
    expect(container.innerHTML).not.toContain(VALID_SECRET);
  });

  it('page container widens to max-w-[1200px] per the doc spec', () => {
    const { container } = renderPage({ order_id: 'x', total: '10', items: '1' });
    const main = container.querySelector('main');
    expect(main?.className).toMatch(/max-w-\[1200px\]/);
  });

  // UAT r2 item 20 — the dashboard was rendering AFTER the "Dashboards
  // are not the payoff" CTA, which fought the payoff framing.
  describe('UAT r2 item 20 — dashboard lands before the closing beat', () => {
    it('dashboard embed (iframe) appears before the closing beat in the DOM', () => {
      process.env.MB_EMBEDDING_SECRET_KEY = VALID_SECRET;
      process.env.METABASE_EMBED_CONFIG = VALID_CONFIG;

      const { container } = renderPage({ order_id: 'demo-d9', total: '44.98', items: '2' });
      const iframe = container.querySelector('iframe');
      const closingBeat = Array.from(container.querySelectorAll('p')).find((p) =>
        /Dashboards are not the payoff/.test(p.textContent ?? ''),
      );
      expect(iframe).not.toBeNull();
      expect(closingBeat).toBeDefined();
      // documentPosition FOLLOWING means the second arg comes AFTER the first.
      const pos = iframe!.compareDocumentPosition(closingBeat as Node);
      expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('even in the fallback path (no env), the closing beat still comes after the dashboard-payoff block', () => {
      delete process.env.MB_EMBEDDING_SECRET_KEY;
      process.env.METABASE_EMBED_CONFIG = VALID_CONFIG;

      const { container } = renderPage({ order_id: 'demo-d9', total: '44.98', items: '2' });
      const fallback = Array.from(container.querySelectorAll('p')).find((p) =>
        /signing env vars aren't wired/i.test(p.textContent ?? ''),
      );
      const closingBeat = Array.from(container.querySelectorAll('p')).find((p) =>
        /Dashboards are not the payoff/.test(p.textContent ?? ''),
      );
      expect(fallback).toBeDefined();
      expect(closingBeat).toBeDefined();
      const pos = fallback!.compareDocumentPosition(closingBeat as Node);
      expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });
  });
});
