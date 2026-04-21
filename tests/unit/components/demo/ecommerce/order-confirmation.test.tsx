/**
 * @jest-environment jsdom
 */
import { act, render, screen } from '@testing-library/react';

import { OrderConfirmation } from '@/components/demo/ecommerce/order-confirmation';
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

  it('lead paragraph second sentence is sentence-cased (UAT r2 item 18)', () => {
    renderConfirmation({ orderTotal: 47.5 });
    expect(
      screen.getByText(/The dashboard ops reads in the morning is what you/),
    ).toBeInTheDocument();
  });

  it('falls back to generic copy when orderTotal is 0 (zombie-state drift fix)', () => {
    renderConfirmation({ orderTotal: 0 });
    expect(screen.getByText(/A real order just landed in production BigQuery/)).toBeInTheDocument();
    expect(screen.queryByText(/\$0\.00/)).not.toBeInTheDocument();
  });

  it('falls back to generic copy when orderTotal is non-finite', () => {
    renderConfirmation({ orderTotal: Infinity });
    expect(screen.getByText(/A real order just landed in production BigQuery/)).toBeInTheDocument();
  });

  it('closing beat is sentence-cased (UAT r2 item 18)', () => {
    renderConfirmation();
    expect(
      screen.getByText(/Dashboards are not the payoff\. Answers are\. The mart layer/),
    ).toBeInTheDocument();
  });

  it('inline-diagnostic title drops the ~840ms specific claim (UAT r2 item 19)', () => {
    renderConfirmation();
    const diag = document.querySelector('[data-inline-diagnostic]');
    expect(diag?.textContent).not.toContain('840ms end-to-end');
    expect(diag?.textContent).toContain('from click to dashboard');
    expect(diag?.textContent).toContain('representative cadence');
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

  it('renders the 6-step pipeline-journey list in an inline diagnostic', () => {
    renderConfirmation();
    const diag = document.querySelector('[data-inline-diagnostic]');
    expect(diag).not.toBeNull();
    expect(diag?.textContent).toContain('purchase event fired in browser');
    expect(diag?.textContent).toContain('sGTM received');
    expect(diag?.textContent).toContain('iampatterson_raw.events_raw');
    expect(diag?.textContent).toContain('Dataform staging');
    expect(diag?.textContent).toContain('marts refreshed');
    expect(diag?.textContent).toContain('dashboard KPIs reflect this order');
  });

  it('final pipeline step has [LIVE] tag instead of [OK]', () => {
    renderConfirmation();
    const diag = document.querySelector('[data-inline-diagnostic]');
    expect(diag?.textContent).toContain('[LIVE]');
  });

  it('has back-to-shop and return-to-iampatterson links', () => {
    renderConfirmation();
    const links = screen.getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/demo/ecommerce');
    expect(hrefs).toContain('/');
  });
});
