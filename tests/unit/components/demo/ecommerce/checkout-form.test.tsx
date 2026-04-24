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
let mockSearchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/demo/ecommerce/checkout',
  useSearchParams: () => mockSearchParams,
}));

const mockBeginCheckout = jest.fn();
const mockPurchase = jest.fn();
jest.mock('@/lib/events/track', () => ({
  trackBeginCheckout: (...a: unknown[]) => mockBeginCheckout(...a),
  trackPurchase: (...a: unknown[]) => mockPurchase(...a),
}));

const mockSession = jest.fn();
jest.mock('@/hooks/useSessionContext', () => ({
  useSessionContext: () => mockSession(),
}));
const DEFAULT_SESSION = {
  session_id: '',
  last_event_name: '',
  last_event_at: '',
  seconds_since_last_event: 0,
  events_in_session: 0,
  add_to_cart_in_last_30s: 0,
  consent_analytics: false,
  consent_marketing: false,
};

function Seed({ product_id }: { product_id: string }) {
  const { addItem } = useCart();
  const seeded = React.useRef(false);
  // Test-fixture idiom: synchronously seed the cart exactly once on
  // first render (see cart-view.test.tsx for matching rationale).
  // eslint-disable-next-line react-hooks/refs -- test-fixture synchronous seed
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

/**
 * Test-only cart mutator. Exposes a data-testid button that adds a
 * different product to the cart on each click, re-rendering the
 * CheckoutForm with updated `total` / `itemCount`. Used by the
 * orderId-stability regression pin — if the pre-10a
 * `useMemo([total, itemCount])` regression ever returned, cart
 * mutations here would re-mint `ORD-${Date.now()...}` mid-checkout.
 */
function CartMutator() {
  const { addItem } = useCart();
  return (
    <button
      data-testid="mutate-cart"
      type="button"
      onClick={() =>
        addItem({
          product_id: 'bonus-add',
          product_name: 'Bonus',
          product_price: 1,
          quantity: 1,
        })
      }
    >
      mutate cart
    </button>
  );
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
    mockSession.mockReturnValue(DEFAULT_SESSION);
    mockSearchParams = new URLSearchParams();
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
    // Let the full 4.5s sequence complete (UAT r1 item 14, bumped
    // from 1.9s so readers have time to read each line).
    act(() => {
      jest.advanceTimersByTime(3300);
    });
    expect(mockPush).toHaveBeenCalledTimes(1);
    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain('/demo/ecommerce/confirmation');
    expect(pushedUrl).toContain('total=26.00');
    expect(pushedUrl).toContain('items=1');
  });

  // Phase 10a D3 regression pin: the previous
  // `useMemo([total, itemCount], () => Date.now()...)` order-ID
  // computation was surfaced by `react-hooks/purity` as a re-mint
  // bug — a visitor editing their cart mid-checkout would see the
  // order ID regenerate on each cart change, producing a different
  // `order_id=` query param on the confirmation URL than was active
  // during `begin_checkout`. The fix was to use `useState` lazy-init
  // so the ID is minted exactly once per mount. This test pins the
  // fix: two cart mutations (adding items) between mount and submit
  // must not change the order ID in the pushed confirmation URL.
  it('orderId is stable across cart edits mid-checkout (regression pin for useMemo→useState fix)', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const startMs = 1_700_000_000_000;
    jest.setSystemTime(new Date(startMs));
    const expectedOrderId = `ORD-${startMs.toString(36).toUpperCase()}`;

    render(
      <ToastProvider>
        <CartProvider>
          <Seed product_id="tuna-plush-classic" />
          <CartMutator />
          <CheckoutForm />
        </CartProvider>
      </ToastProvider>,
    );

    // Advance wall-clock time so any re-mint (if the bug returns) would
    // produce a different Date.now()-derived ID than expectedOrderId.
    jest.setSystemTime(new Date(startMs + 10_000));
    await user.click(screen.getByTestId('mutate-cart'));
    jest.setSystemTime(new Date(startMs + 20_000));
    await user.click(screen.getByTestId('mutate-cart'));

    await user.click(screen.getByRole('button', { name: /place order/i }));
    act(() => {
      jest.advanceTimersByTime(3300);
    });

    expect(mockPush).toHaveBeenCalledTimes(1);
    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain(`order_id=${expectedOrderId}`);
    // And trackPurchase got the same (stable) ID
    expect(mockPurchase).toHaveBeenCalledWith(
      expect.objectContaining({ order_id: expectedOrderId }),
    );
  });

  it('diagnostic sequence includes the BQ raw table reference', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderCheckout();
    await user.click(screen.getByRole('button', { name: /place order/i }));
    act(() => {
      jest.advanceTimersByTime(3300);
    });
    // After completion, push was called with the confirmation URL
    expect(mockPush).toHaveBeenCalled();
  });

  it('diagnostic is skippable via any keydown', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderCheckout();
    await user.click(screen.getByRole('button', { name: /place order/i }));
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    // Press any key, onComplete fires, router.push called
    await user.keyboard('{Enter}');
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  // UAT r1 item 14, the full-page intermission was too fast + used
  // hardcoded consent values. The duration bump (1900 → 4500) is pinned
  // in the full-page-diagnostic test; the live-consent substitution is
  // pinned here.
  describe('UAT r1 item 14, live consent in full-page diagnostic', () => {
    it('uses live consent in the diagnostic consent-check line when events have flowed', async () => {
      mockSession.mockReturnValue({
        ...DEFAULT_SESSION,
        events_in_session: 2,
        consent_analytics: false,
        consent_marketing: true,
      });
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderCheckout();
      await user.click(screen.getByRole('button', { name: /place order/i }));
      const dialog = document.querySelector('[role="dialog"]');
      // Let all lines stagger-in (dialog spans 4500ms total with 7 lines).
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(dialog?.textContent).toMatch(/consent check · analytics=denied, marketing=granted/);
    });

    it('falls back to the static seed lines when no events have flowed yet', async () => {
      // No events → events_in_session=0 → stays on seed list, which
      // reads analytics=granted + marketing=denied.
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderCheckout();
      await user.click(screen.getByRole('button', { name: /place order/i }));
      const dialog = document.querySelector('[role="dialog"]');
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(dialog?.textContent).toMatch(/consent check · analytics=granted, marketing=denied/);
    });
  });

  // UAT r1 items 11 + 13, warehouse-write sidebar reflects real session.
  describe('UAT r1 items 11 + 13, live warehouse-write sidebar', () => {
    it('substitutes real session_id into the BQ row preview', () => {
      mockSession.mockReturnValue({
        ...DEFAULT_SESSION,
        session_id: 'abc12345-6789-4def-8abc-deadbeefcafe',
      });
      renderCheckout();
      const sidebar = document.querySelector('aside[data-live-sidebar]');
      expect(sidebar?.textContent).toMatch(/abc12345…/);
    });

    it('substitutes event_timestamp with the real last-event ISO', () => {
      const iso = '2026-04-21T18:15:02.000Z';
      mockSession.mockReturnValue({
        ...DEFAULT_SESSION,
        last_event_at: iso,
      });
      renderCheckout();
      const sidebar = document.querySelector('aside[data-live-sidebar]');
      expect(sidebar?.textContent).toContain(iso);
    });

    it('substitutes consent flags once events have flowed', () => {
      mockSession.mockReturnValue({
        ...DEFAULT_SESSION,
        events_in_session: 2,
        consent_analytics: true,
        consent_marketing: true,
      });
      renderCheckout();
      const sidebar = document.querySelector('aside[data-live-sidebar]');
      // Both should read granted when events carry both flags granted.
      const grantedMatches = (sidebar?.textContent ?? '').match(/granted/g) ?? [];
      expect(grantedMatches.length).toBeGreaterThanOrEqual(2);
    });

    it('falls back to seed consent values when no events have flowed yet', () => {
      renderCheckout();
      const sidebar = document.querySelector('aside[data-live-sidebar]');
      // Seed has analytics=granted, marketing=denied.
      expect(sidebar?.textContent).toMatch(/granted/);
      expect(sidebar?.textContent).toMatch(/denied/);
    });
  });

  // UAT r2 item 12, walkthrough blurb with mobile scroll-to-sidebar chip.
  describe('UAT r2 item 12, walkthrough blurb', () => {
    it('renders a WalkthroughBlurb with route="checkout"', () => {
      renderCheckout();
      const blurb = document.querySelector('[data-walkthrough-blurb]');
      expect(blurb).not.toBeNull();
      expect(blurb?.getAttribute('data-route')).toBe('checkout');
    });

    it('renders the mobile "see the stack ↓" chip', () => {
      renderCheckout();
      expect(document.querySelector('[data-walkthrough-stack-link]')).not.toBeNull();
    });
  });

  // UAT r2 item 16, the mobile checkout had flex items spilling past the
  // viewport. The fix is a belt-and-braces set: inputs are all w-full, the
  // form + aside columns both carry min-w-0 so they can shrink inside the
  // grid, and the grid template uses minmax(0, 1fr) instead of plain 1fr.
  describe('UAT r2 item 16, mobile viewport containment', () => {
    it('every form input is w-full with min-w-0 so nothing forces the form wider than its column', () => {
      renderCheckout();
      const inputs = document.querySelectorAll('input');
      expect(inputs.length).toBeGreaterThan(0);
      inputs.forEach((el) => {
        expect(el.className).toMatch(/\bw-full\b/);
        expect(el.className).toMatch(/\bmin-w-0\b/);
      });
    });

    it('form + aside columns carry min-w-0 so the grid lets them shrink', () => {
      renderCheckout();
      const form = document.querySelector('form');
      expect(form?.className).toMatch(/\bmin-w-0\b/);
      // The aside directly holding the live sidebar is the right column
      // (NOT the aria-labelled sidebar itself which has its own width logic).
      const asideOuter = document.querySelector('form + aside');
      expect(asideOuter?.className).toMatch(/\bmin-w-0\b/);
    });
  });

  // UAT r2 item 13, warehouse-write readout's key/value cells used to
  // overflow on narrow viewports because the first two grid tracks were
  // plain `1fr` (which lets grid items grow past their track) with no
  // truncate on the key span.
  describe('UAT r2 item 13, warehouse-write readout cells truncate on narrow viewports', () => {
    it('BQ row rows use minmax(0, 1fr) tracks with truncate on both key + value spans', () => {
      renderCheckout();
      const sidebar = document.querySelector('aside[data-live-sidebar]') as HTMLElement;
      const rows = sidebar.querySelectorAll('div.grid');
      expect(rows.length).toBeGreaterThan(0);
      const first = rows[0] as HTMLElement;
      expect(first.className).toMatch(/minmax\(0,1fr\)/);
      const spans = first.querySelectorAll('span');
      // First two spans should truncate + min-w-0. Third span is the
      // right-aligned type cell and doesn't need truncate.
      expect(spans[0].className).toMatch(/\btruncate\b/);
      expect(spans[0].className).toMatch(/\bmin-w-0\b/);
      expect(spans[1].className).toMatch(/\btruncate\b/);
      expect(spans[1].className).toMatch(/\bmin-w-0\b/);
    });
  });

  // UAT r1 item 10, the pre-rework defaults "Courtney" / "Patterson"
  // carried the site owner's own family name into the demo checkout.
  // Generic placeholder names only.
  describe('UAT r1 item 10, generic checkout placeholder names', () => {
    it('does NOT prefill "Courtney" as first name', () => {
      renderCheckout();
      const firstName = screen.getByLabelText(/first name/i) as HTMLInputElement;
      expect(firstName.value).not.toBe('Courtney');
    });

    it('does NOT prefill "Patterson" as last name', () => {
      renderCheckout();
      const lastName = screen.getByLabelText(/last name/i) as HTMLInputElement;
      expect(lastName.value).not.toBe('Patterson');
    });
  });
});
