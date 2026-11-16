/**
 * @jest-environment jsdom
 */
import { act, render, screen } from '@testing-library/react';

import {
  ConfirmationCloser,
  OrderConfirmation,
} from '@/components/demo/ecommerce/order-confirmation';
import { ToastProvider } from '@/components/demo/reveal/toast-provider';

function renderConfirmation(
  props: { orderId?: string; orderTotal?: number; itemCount?: number } = {},
) {
  const { orderId = 'ORD-TEST-001', orderTotal = 47.5, itemCount = 2 } = props;
  return render(
    <ToastProvider>
      <OrderConfirmation orderId={orderId} orderTotal={orderTotal} itemCount={itemCount} />
    </ToastProvider>,
  );
}

describe('OrderConfirmation (Phase 9F D9)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders the editorial order-confirmed eyebrow with the orderId', () => {
    renderConfirmation({ orderId: 'ORD-ABC123' });
    expect(screen.getByText(/order confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/ORD-ABC123/)).toBeInTheDocument();
  });

  it('renders the sentence-cased serif headline', () => {
    renderConfirmation();
    expect(screen.getByText('Thanks. The event made it all the way through.')).toBeInTheDocument();
  });

  it('lead paragraph interpolates the order total when finite and positive', () => {
    renderConfirmation({ orderTotal: 47.5 });
    expect(
      screen.getByText(/Your \$47\.50 order just landed in production BigQuery/),
    ).toBeInTheDocument();
  });

  // 17.1 removed the dashboard embed that sat below this paragraph. The lead
  // must not send the visitor looking for a dashboard the page no longer has.
  it.each([47.5, 0])(
    'lead paragraph points at no dashboard on the page (total %s)',
    (orderTotal) => {
      const { container } = renderConfirmation({ orderTotal });
      const lead = container.querySelector('section p');
      expect(lead?.textContent).toMatch(/just landed in production BigQuery\.$/);
      expect(container.textContent).not.toMatch(/revenue below/);
      expect(container.textContent).not.toMatch(/what you.re looking at/);
    },
  );

  it('falls back to generic copy when orderTotal is 0 (zombie-state drift fix)', () => {
    renderConfirmation({ orderTotal: 0 });
    expect(screen.getByText(/A real order just landed in production BigQuery/)).toBeInTheDocument();
    expect(screen.queryByText(/\$0\.00/)).not.toBeInTheDocument();
  });

  it('falls back to generic copy when orderTotal is non-finite', () => {
    renderConfirmation({ orderTotal: Infinity });
    expect(screen.getByText(/A real order just landed in production BigQuery/)).toBeInTheDocument();
  });

  it('does NOT render the closer links, back to the shop or the review (they live in ConfirmationCloser)', () => {
    const { container } = renderConfirmation();
    expect(container.textContent).not.toMatch(/back to the shop/);
    expect(container.querySelector('a[href="/review"]')).toBeNull();
  });

  it('marks the journey timings as representative (UAT r2 item 19)', () => {
    renderConfirmation();
    const diag = document.querySelector('[data-inline-diagnostic]');
    expect(diag?.textContent).toContain('representative cadence');
  });

  // The pipeline journey keeps a heading, so a screen-reader user moving by
  // heading can still reach it.
  it('titles the journey from click to BigQuery', () => {
    renderConfirmation();
    expect(screen.getByRole('heading', { name: 'from click to BigQuery' })).toBeInTheDocument();
  });

  it('renders item count meta', () => {
    renderConfirmation({ itemCount: 3 });
    expect(screen.getByText(/items ·/i)).toBeInTheDocument();
    expect(screen.getByText(/^3$/)).toBeInTheDocument();
  });

  it('renders no-kill rescues footnote', () => {
    renderConfirmation();
    expect(screen.getByText(/no-kill rescues/i)).toBeInTheDocument();
  });

  it('fires a purchase toast shortly after mount with the order id', () => {
    renderConfirmation({ orderId: 'ORD-XYZ987' });
    act(() => {
      jest.advanceTimersByTime(600);
    });
    const toast = document.querySelector('[data-toast-card]');
    expect(toast?.textContent).toContain('purchase');
    expect(toast?.textContent).toContain('ORD-XYZ987');
  });

  it('renders the 3-step pipeline-journey list in an inline diagnostic', () => {
    renderConfirmation();
    const diag = document.querySelector('[data-inline-diagnostic]');
    expect(diag).not.toBeNull();
    expect(diag?.textContent).toContain('purchase event fired in browser');
    expect(diag?.textContent).toContain('sGTM received');
    expect(diag?.textContent).toContain('iampatterson_raw.events_raw');
    expect(diag?.querySelectorAll('li')).toHaveLength(3);
  });

  // Metabase is retired (18.3), and Dataform runs nightly, not per event. The
  // journey keeps only the steps that happen in the moment and ends where the
  // order really lands: one row in events_raw.
  it('ends the journey at the BigQuery row, with no dashboard and no Dataform step', () => {
    renderConfirmation();
    const diag = document.querySelector('[data-inline-diagnostic]');
    const steps = Array.from(diag?.querySelectorAll('li') ?? []).map((li) => li.textContent);
    expect(steps[steps.length - 1]).toMatch(/1 row → iampatterson_raw\.events_raw/);
    expect(diag?.textContent).not.toMatch(/dashboard|dataform|mart/i);
  });
});

describe('ConfirmationCloser (UAT r2 item 20 split)', () => {
  it('no longer claims a dashboard', () => {
    const { container } = render(<ConfirmationCloser />);
    expect(container.textContent).not.toMatch(/dashboard/i);
  });

  // The confirmation page is the end of the shop demo. It ends on the site's
  // one call to action (the homepage's "Start with a review"), with the way
  // back to the shop beside it. /services was deleted in 16.1.
  it('ends the demo on the way back to the shop, then the review call to action', () => {
    render(<ConfirmationCloser />);
    const hrefs = screen.getAllByRole('link').map((l) => l.getAttribute('href'));
    expect(hrefs).toEqual(['/demo/ecommerce', '/review']);
  });
});
