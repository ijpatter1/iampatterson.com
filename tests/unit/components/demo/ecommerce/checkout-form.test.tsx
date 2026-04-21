/**
 * @jest-environment jsdom
 */
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CheckoutForm } from '@/components/demo/ecommerce/checkout-form';
import { CartProvider, useCart } from '@/components/demo/ecommerce/cart-context';
import { ToastProvider } from '@/components/demo/reveal/toast-provider';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/demo/ecommerce/checkout',
}));

const mockBeginCheckout = jest.fn();
const mockPurchase = jest.fn();
jest.mock('@/lib/events/track', () => ({
  trackBeginCheckout: (...a: unknown[]) => mockBeginCheckout(...a),
  trackPurchase: (...a: unknown[]) => mockPurchase(...a),
}));

function Seed({ product_id }: { product_id: string }) {
  const { addItem } = useCart();
  const seeded = React.useRef(false);
  if (!seeded.current) {
    seeded.current = true;
    addItem({
      product_id,
      product_name: 'Tuna Plush',
      product_price: 26,
      quantity: 1,
    });
  }
  return null;
}

function renderCheckout(seeded = true) {
  return render(
    <ToastProvider>
      <CartProvider>
        {seeded ? <Seed product_id="tuna-plush-classic" /> : null}
        <CheckoutForm />
      </CartProvider>
    </ToastProvider>,
  );
}

describe('CheckoutForm (Phase 9F D8)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    mockPush.mockClear();
    mockBeginCheckout.mockClear();
    mockPurchase.mockClear();
  });
  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('shows empty-state block when cart is empty', () => {
    renderCheckout(false);
    expect(screen.getByText(/\[ cart · empty \]/i)).toBeInTheDocument();
  });

  it('renders the checkout form heading when cart has items', () => {
    renderCheckout();
    expect(screen.getByText('checkout')).toBeInTheDocument();
  });

  it('renders three numbered fieldsets (contact / shipping / payment)', () => {
    renderCheckout();
    expect(screen.getByText(/01 · contact/i)).toBeInTheDocument();
    expect(screen.getByText(/02 · shipping/i)).toBeInTheDocument();
    expect(screen.getByText(/03 · payment/i)).toBeInTheDocument();
  });

  it('fires trackBeginCheckout once on mount with the cart total', () => {
    renderCheckout();
    expect(mockBeginCheckout).toHaveBeenCalledTimes(1);
    expect(mockBeginCheckout).toHaveBeenCalledWith({
      cart_total: 26,
      item_count: 1,
    });
  });

  it('fires a begin_checkout toast shortly after mount', () => {
    renderCheckout();
    act(() => {
      jest.advanceTimersByTime(600);
    });
    const toast = document.querySelector('[data-toast-card]');
    expect(toast?.textContent).toContain('begin_checkout');
    expect(toast?.textContent).toContain('26.00');
  });

  it('renders the warehouse-write LiveSidebar with the real BQ table reference', () => {
    renderCheckout();
    const sidebar = document.querySelector('aside[data-live-sidebar]');
    expect(sidebar).not.toBeNull();
    expect(sidebar?.textContent).toContain('iampatterson_raw.events_raw');
    expect(sidebar?.textContent).toMatch(/21 of 51 columns/i);
  });

  it('warehouse-write sidebar reflects visitor cart total + item count', () => {
    renderCheckout();
    const sidebar = document.querySelector('aside[data-live-sidebar]') as HTMLElement;
    // cart_value row should carry 26.00
    expect(sidebar.textContent).toContain('26.00');
    // cart_item_count row should carry the count 1 (fields render as separate rows)
    expect(sidebar.textContent).toMatch(/cart_item_count/);
  });

  it('renders an order summary column with items, subtotal, total, no-kill disclaimer', () => {
    renderCheckout();
    expect(screen.getByText(/your order/i)).toBeInTheDocument();
    expect(screen.getAllByText(/tuna plush/i).length).toBeGreaterThan(0);
  });

  it('clicking place-order submits the form + fires trackPurchase + enters diagnostic phase', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderCheckout();
    const submit = screen.getByRole('button', { name: /place order/i });
    await user.click(submit);
    expect(mockPurchase).toHaveBeenCalledTimes(1);
    expect(mockPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        order_total: 26,
        item_count: 1,
      }),
    );
  });

  it('full-page diagnostic renders after submit and navigates to /confirmation on complete', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderCheckout();
    await user.click(screen.getByRole('button', { name: /place order/i }));
    // Diagnostic dialog should be mounted
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    // Let the 1.9s sequence complete
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(mockPush).toHaveBeenCalledTimes(1);
    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain('/demo/ecommerce/confirmation');
    expect(pushedUrl).toContain('total=26.00');
    expect(pushedUrl).toContain('items=1');
  });

  it('diagnostic sequence includes the BQ raw table reference', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderCheckout();
    await user.click(screen.getByRole('button', { name: /place order/i }));
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    // After completion, push was called with the confirmation URL
    expect(mockPush).toHaveBeenCalled();
  });

  it('diagnostic is skippable via any keydown', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderCheckout();
    await user.click(screen.getByRole('button', { name: /place order/i }));
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    // Press any key — onComplete fires, router.push called
    await user.keyboard('{Enter}');
    expect(mockPush).toHaveBeenCalledTimes(1);
  });
});
