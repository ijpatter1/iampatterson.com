/**
 * @jest-environment jsdom
 *
 * Phase 9F D9, integration test for the confirmation page Server Component.
 *
 * Numeric query params are sanitized at the page boundary so the order block
 * can trust them. 17.1 removed the Metabase dashboard embed: the page no
 * longer signs an embed URL or reads the embedding secret, so it renders the
 * same with or without the old env vars, and points no visitor at the BI host.
 */
import { render, screen } from '@testing-library/react';

import ConfirmationPage from '@/app/demo/ecommerce/confirmation/page';

const ORIG_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

async function renderPage(searchParams: Record<string, string | string[] | undefined> = {}) {
  // Next 15 made route props async; Server Components can `await props.searchParams`.
  // Tests unwrap by awaiting the page invocation before handing the element to RTL.
  const node = await ConfirmationPage({ searchParams: Promise.resolve(searchParams) });
  return render(node);
}

describe('ConfirmationPage', () => {
  it('renders the order confirmation block with the search-param values', async () => {
    await renderPage({ order_id: 'demo-d9', total: '44.98', items: '2' });
    expect(screen.getByText(/order confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/demo-d9/)).toBeInTheDocument();
    // $44.98 appears in the lead paragraph + the total meta row
    expect(screen.getAllByText(/\$44\.98/).length).toBeGreaterThanOrEqual(1);
  });

  // 17.1: Metabase is being retired and its embedding secret was exposed in
  // the 2026-09 compromise. Even with the old env vars still set on a
  // deployment, the page embeds nothing and links nowhere on the BI host.
  it('embeds no dashboard and names no BI host, even with the old embed env vars set', async () => {
    process.env.MB_EMBEDDING_SECRET_KEY = 'test-secret-0123456789abcdef0123456789abcdef';
    process.env.METABASE_EMBED_CONFIG = '{"dashboardId":2}';

    const { container } = await renderPage({ order_id: 'demo-d9', total: '44.98', items: '2' });

    expect(container.querySelectorAll('iframe')).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/bi\.iampatterson\.com|metabase/i);
    expect(container.innerHTML).not.toContain('test-secret-0123456789abcdef');
  });

  it('normalizes duplicate query params (string[] searchParams) to the first value', async () => {
    await renderPage({ order_id: ['demo-d9', 'second'], total: ['44.98', '99'], items: ['2'] });

    expect(screen.getByText(/demo-d9/)).toBeInTheDocument();
    expect(screen.getAllByText(/\$44\.98/).length).toBeGreaterThanOrEqual(1);
  });

  it('zombie-state fallback: non-finite total renders generic "a real order" copy, not $NaN', async () => {
    await renderPage({ order_id: 'ORD-D9-DEMO', total: 'abc', items: 'xyz' });
    // Generic lead copy (no $ interpolation)
    expect(
      screen.getByText(/a real order just landed in production BigQuery/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\$NaN/)).toBeNull();
    expect(screen.queryByText(/\$Infinity/)).toBeNull();
  });

  it('zombie-state fallback: negative total treated as 0, generic copy renders', async () => {
    await renderPage({ order_id: 'ORD-D9-DEMO', total: '-100', items: '-5' });
    expect(
      screen.getByText(/a real order just landed in production BigQuery/i),
    ).toBeInTheDocument();
    // No $-100.00 visible
    expect(screen.queryByText(/-100/)).toBeNull();
  });

  it('still closes with the way back to the shop and the site', async () => {
    await renderPage({ order_id: 'demo-d9', total: '44.98', items: '2' });
    const hrefs = screen.getAllByRole('link').map((l) => l.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/demo/ecommerce', '/']));
  });
});
