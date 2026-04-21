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

  it('renders the lowercase serif headline', () => {
    renderConfirmation();
    expect(screen.getByText('thanks. the event made it all the way through.')).toBeInTheDocument();
  });

  it('lead paragraph interpolates the order total when finite and positive', () => {
    renderConfirmation({ orderTotal: 47.5 });
    expect(
      screen.getByText(/your \$47\.50 order just landed in production BigQuery/i),
    ).toBeInTheDocument();
  });

  it('falls back to generic copy when orderTotal is 0 (zombie-state drift fix)', () => {
    renderConfirmation({ orderTotal: 0 });
    expect(
      screen.getByText(/a real order just landed in production BigQuery/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\$0\.00/)).not.toBeInTheDocument();
  });

  it('falls back to generic copy when orderTotal is non-finite', () => {
    renderConfirmation({ orderTotal: Infinity });
    expect(
      screen.getByText(/a real order just landed in production BigQuery/i),
    ).toBeInTheDocument();
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
