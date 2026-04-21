/**
 * @jest-environment jsdom
 */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CartView } from '@/components/demo/ecommerce/cart-view';
import { CartProvider, useCart } from '@/components/demo/ecommerce/cart-context';
import { ToastProvider } from '@/components/demo/reveal/toast-provider';

const mockRemoveFromCart = jest.fn();
jest.mock('@/lib/events/track', () => ({
  trackRemoveFromCart: (...a: unknown[]) => mockRemoveFromCart(...a),
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
beforeEach(() => {
  mockSession.mockReturnValue(DEFAULT_SESSION);
  mockRemoveFromCart.mockClear();
});

function SeedItem({
  product_id,
  product_name,
  product_price,
  quantity,
}: {
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
}) {
  const { addItem } = useCart();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const seededRef = React.useRef(false);
  if (!seededRef.current) {
    seededRef.current = true;
    addItem({ product_id, product_name, product_price, quantity });
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const React = require('react');

function renderWithCart(seeds: Array<React.ComponentProps<typeof SeedItem>> = []) {
  return render(
    <ToastProvider>
      <CartProvider>
        {seeds.map((s) => (
          <SeedItem key={s.product_id} {...s} />
        ))}
        <CartView />
      </CartProvider>
    </ToastProvider>,
  );
}

describe('CartView (Phase 9F D7)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders the empty-state block when the cart has no items', () => {
    renderWithCart();
    expect(screen.getByText(/\[ cart · empty \]/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing in here yet/i)).toBeInTheDocument();
  });

  it('renders the continue-shopping link in the empty state', () => {
    renderWithCart();
    const links = screen.getAllByRole('link');
    expect(links.some((l) => l.getAttribute('href') === '/demo/ecommerce')).toBe(true);
  });

  it('fires a view_cart toast on mount', () => {
    renderWithCart();
    act(() => {
      jest.advanceTimersByTime(600);
    });
    const toast = document.querySelector('[data-toast-card]');
    expect(toast?.textContent).toContain('view_cart');
  });

  it('renders the your cart heading (lowercase)', () => {
    renderWithCart();
    expect(screen.getByText('your cart')).toBeInTheDocument();
  });

  it('renders the data-quality LiveSidebar with all 6 assertions', () => {
    renderWithCart();
    const sidebar = document.querySelector('aside[data-live-sidebar]');
    expect(sidebar).not.toBeNull();
    expect(sidebar?.textContent).toContain('schema_validation');
    expect(sidebar?.textContent).toContain('null_check');
    expect(sidebar?.textContent).toContain('volume_anomaly');
    expect(sidebar?.textContent).toContain('session_join_integrity');
    expect(sidebar?.textContent).toContain('freshness');
    expect(sidebar?.textContent).toContain('referential_integrity');
  });

  it('sidebar shows the 6/6 passing pipeline-health meter with empty cart', () => {
    renderWithCart();
    const sidebar = document.querySelector('aside[data-live-sidebar]');
    expect(sidebar?.textContent).toContain('6 / 6 passing');
  });

  it('renders cart rows when the cart has items', () => {
    renderWithCart([
      {
        product_id: 'tuna-plush-classic',
        product_name: 'Tuna Plush',
        product_price: 26,
        quantity: 2,
      },
    ]);
    expect(screen.getByText('Tuna Plush')).toBeInTheDocument();
    // Per-item price. Post-2026-04-21 mobile-layout fix renders the price
    // twice in the DOM (mobile-only inline copy + sm+ grid cell) since
    // jsdom doesn't evaluate responsive CSS, both co-exist in the tree.
    expect(screen.getAllByText('$26.00').length).toBeGreaterThanOrEqual(1);
    // Line total ($52) + subtotal + total all show $52.
    expect(screen.getAllByText('$52.00').length).toBeGreaterThanOrEqual(1);
  });

  it('renders a summary block with subtotal, total, and checkout link when items present', () => {
    renderWithCart([
      {
        product_id: 'tuna-plush-classic',
        product_name: 'Tuna Plush',
        product_price: 26,
        quantity: 1,
      },
      {
        product_id: 'tuna-calendar-2026',
        product_name: '2026 Tuna Calendar',
        product_price: 14,
        quantity: 1,
      },
    ]);
    expect(screen.getByText(/subtotal/i)).toBeInTheDocument();
    expect(screen.getByText(/^total$/i)).toBeInTheDocument();
    const links = screen.getAllByRole('link');
    expect(links.some((l) => l.getAttribute('href') === '/demo/ecommerce/checkout')).toBe(true);
  });

  it('increments quantity when the + button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderWithCart([
      {
        product_id: 'tuna-plush-classic',
        product_name: 'Tuna Plush',
        product_price: 26,
        quantity: 1,
      },
    ]);
    const plusButton = screen.getByLabelText(/increase quantity for tuna plush/i);
    await user.click(plusButton);
    // Line total updates to $52.00 (2 × $26.00), appears as line + subtotal + total
    expect(screen.getAllByText('$52.00').length).toBeGreaterThanOrEqual(1);
  });

  it('removes item when the remove link is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderWithCart([
      {
        product_id: 'tuna-plush-classic',
        product_name: 'Tuna Plush',
        product_price: 26,
        quantity: 1,
      },
    ]);
    expect(screen.getByText('Tuna Plush')).toBeInTheDocument();
    await user.click(screen.getByLabelText(/remove tuna plush/i));
    // Cart becomes empty again
    expect(screen.getByText(/\[ cart · empty \]/i)).toBeInTheDocument();
  });

  it('shows FAIL volume_anomaly with cart-honest phrasing when no live stream', () => {
    // No live events yet → cart-itemCount fallback. Detail names the
    // cart explicitly, not the event stream.
    renderWithCart([
      {
        product_id: 'tuna-plush-classic',
        product_name: 'Tuna Plush',
        product_price: 26,
        quantity: 15,
      },
    ]);
    const sidebar = document.querySelector('aside[data-live-sidebar]');
    expect(sidebar?.textContent).toMatch(/cart holds 15 items/i);
    expect(sidebar?.textContent).toMatch(/threshold tripped/i);
  });

  it('renders the no-kill rescues trust line in the summary', () => {
    renderWithCart([
      {
        product_id: 'tuna-plush-classic',
        product_name: 'Tuna Plush',
        product_price: 26,
        quantity: 1,
      },
    ]);
    expect(screen.getByText(/no-kill rescues/i)).toBeInTheDocument();
  });

  // UAT r2 item 12, walkthrough blurb with mobile scroll-to-sidebar chip.
  describe('UAT r2 item 12, walkthrough blurb', () => {
    it('renders a WalkthroughBlurb with route="cart"', () => {
      renderWithCart([
        {
          product_id: 'tuna-plush-classic',
          product_name: 'Tuna Plush',
          product_price: 26,
          quantity: 1,
        },
      ]);
      const blurb = document.querySelector('[data-walkthrough-blurb]');
      expect(blurb).not.toBeNull();
      expect(blurb?.getAttribute('data-route')).toBe('cart');
    });

    it('renders the mobile "see the stack ↓" chip', () => {
      renderWithCart([
        {
          product_id: 'tuna-plush-classic',
          product_name: 'Tuna Plush',
          product_price: 26,
          quantity: 1,
        },
      ]);
      expect(document.querySelector('[data-walkthrough-stack-link]')).not.toBeNull();
    });
  });

  // UAT r2 follow-up (user-flagged 2026-04-21): the walkthrough
  // promised remove_from_cart fires but no code path did.
  describe('remove_from_cart event firing', () => {
    it('fires trackRemoveFromCart when the remove link is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderWithCart([
        {
          product_id: 'tuna-plush-classic',
          product_name: 'Tuna Plush',
          product_price: 26,
          quantity: 2,
        },
      ]);
      await user.click(screen.getByLabelText(/remove tuna plush/i));
      expect(mockRemoveFromCart).toHaveBeenCalledTimes(1);
      expect(mockRemoveFromCart).toHaveBeenCalledWith(
        expect.objectContaining({
          product_id: 'tuna-plush-classic',
          product_name: 'Tuna Plush',
          product_price: 26,
          quantity: 2,
        }),
      );
    });

    it('fires a remove_from_cart toast at near-cart position', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderWithCart([
        {
          product_id: 'tuna-plush-classic',
          product_name: 'Tuna Plush',
          product_price: 26,
          quantity: 1,
        },
      ]);
      await user.click(screen.getByLabelText(/remove tuna plush/i));
      const toast = Array.from(document.querySelectorAll('[data-toast-card]')).find((c) =>
        c.textContent?.includes('remove_from_cart'),
      );
      expect(toast).toBeTruthy();
    });

    it('fires remove_from_cart when decrementing quantity from 1 to 0', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderWithCart([
        {
          product_id: 'tuna-plush-classic',
          product_name: 'Tuna Plush',
          product_price: 26,
          quantity: 1,
        },
      ]);
      await user.click(screen.getByLabelText(/decrease quantity for tuna plush/i));
      expect(mockRemoveFromCart).toHaveBeenCalledTimes(1);
    });

    it('does NOT fire remove_from_cart on an ordinary quantity decrement (2 to 1)', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderWithCart([
        {
          product_id: 'tuna-plush-classic',
          product_name: 'Tuna Plush',
          product_price: 26,
          quantity: 2,
        },
      ]);
      await user.click(screen.getByLabelText(/decrease quantity for tuna plush/i));
      expect(mockRemoveFromCart).not.toHaveBeenCalled();
    });
  });

  // UAT r2 follow-up (user-flagged 2026-04-21): the cart line item's
  // pre-fix `grid-cols-[1fr_90px_90px_90px]` (4 fixed tracks, ~306px)
  // overflowed 360px viewports. Mobile now stacks; desktop keeps the grid.
  describe('mobile viewport containment', () => {
    it('cart line items stack vertically on mobile and grid on sm+', () => {
      renderWithCart([
        {
          product_id: 'tuna-plush-classic',
          product_name: 'Tuna Plush',
          product_price: 26,
          quantity: 1,
        },
      ]);
      const line = document.querySelector('[data-cart-line]') as HTMLElement;
      expect(line).not.toBeNull();
      // Mobile: flex-col. sm+: grid.
      expect(line.className).toMatch(/flex-col/);
      expect(line.className).toMatch(/sm:grid\b/);
      // The grid uses minmax(0, 1fr) so the item column can shrink.
      expect(line.className).toMatch(/minmax\(0,1fr\)/);
    });
  });
});

describe('CartProvider, localStorage persistence (Phase 9F D7)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists cart to iampatterson.tunashop.cart.v1 on update', () => {
    const { unmount } = render(
      <CartProvider>
        <SeedItem
          product_id="tuna-plush-classic"
          product_name="Tuna Plush"
          product_price={26}
          quantity={1}
        />
      </CartProvider>,
    );
    const raw = localStorage.getItem('iampatterson.tunashop.cart.v1');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? '[]');
    expect(parsed).toHaveLength(1);
    expect(parsed[0].product_id).toBe('tuna-plush-classic');
    unmount();
  });

  it('hydrates from localStorage on mount', () => {
    localStorage.setItem(
      'iampatterson.tunashop.cart.v1',
      JSON.stringify([
        {
          product_id: 'tuna-plush-classic',
          product_name: 'Tuna Plush',
          product_price: 26,
          quantity: 2,
        },
      ]),
    );
    render(
      <ToastProvider>
        <CartProvider>
          <CartView />
        </CartProvider>
      </ToastProvider>,
    );
    expect(screen.getByText('Tuna Plush')).toBeInTheDocument();
    expect(screen.getAllByText('$52.00').length).toBeGreaterThanOrEqual(1);
  });

  it('hydrates from a cross-tab storage event on the same key', () => {
    const { rerender } = render(
      <ToastProvider>
        <CartProvider>
          <CartView />
        </CartProvider>
      </ToastProvider>,
    );
    // Simulate another tab writing to the same localStorage key
    localStorage.setItem(
      'iampatterson.tunashop.cart.v1',
      JSON.stringify([
        { product_id: 'colin-plush', product_name: 'Colin Plush', product_price: 16, quantity: 1 },
      ]),
    );
    window.dispatchEvent(new StorageEvent('storage', { key: 'iampatterson.tunashop.cart.v1' }));
    rerender(
      <ToastProvider>
        <CartProvider>
          <CartView />
        </CartProvider>
      </ToastProvider>,
    );
    expect(screen.getByText('Colin Plush')).toBeInTheDocument();
  });

  it('ignores storage events for unrelated keys', () => {
    render(
      <ToastProvider>
        <CartProvider>
          <CartView />
        </CartProvider>
      </ToastProvider>,
    );
    expect(screen.getByText(/\[ cart · empty \]/i)).toBeInTheDocument();
    // A storage event for a different key should not dispatch HYDRATE
    window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated.other.v1' }));
    expect(screen.getByText(/\[ cart · empty \]/i)).toBeInTheDocument();
  });

  it('discards malformed persisted data (invalid JSON or unexpected shape)', () => {
    localStorage.setItem('iampatterson.tunashop.cart.v1', 'not-json');
    render(
      <ToastProvider>
        <CartProvider>
          <CartView />
        </CartProvider>
      </ToastProvider>,
    );
    // Falls back to empty cart; no crash
    expect(screen.getByText(/\[ cart · empty \]/i)).toBeInTheDocument();
  });

  // UAT r1 item 8, data-quality sidebar reflects live session facts.
  describe('UAT r1 item 8, live data-quality sidebar', () => {
    it('surfaces live add_to_cart count into volume_anomaly detail', () => {
      mockSession.mockReturnValue({
        ...DEFAULT_SESSION,
        events_in_session: 6,
        add_to_cart_in_last_30s: 4,
      });
      renderWithCart([
        {
          product_id: 'tuna-plush-classic',
          product_name: 'Tuna Plush',
          product_price: 26,
          quantity: 1,
        },
      ]);
      const sidebar = document.querySelector('aside[data-live-sidebar]');
      expect(sidebar?.textContent).toMatch(/4 add_to_cart in 30s/);
    });

    it('shows real session_id in session_join_integrity detail', () => {
      mockSession.mockReturnValue({
        ...DEFAULT_SESSION,
        session_id: 'abc12345-6789-4def-8abc-deadbeefcafe',
      });
      renderWithCart([
        {
          product_id: 'x',
          product_name: 'x',
          product_price: 1,
          quantity: 1,
        },
      ]);
      const sidebar = document.querySelector('aside[data-live-sidebar]');
      expect(sidebar?.textContent).toMatch(/session_id = abc12345…/);
    });

    it('shows real seconds-since-last-event in freshness detail', () => {
      mockSession.mockReturnValue({
        ...DEFAULT_SESSION,
        last_event_name: 'add_to_cart',
        last_event_at: new Date().toISOString(),
        seconds_since_last_event: 7,
      });
      renderWithCart([
        {
          product_id: 'x',
          product_name: 'x',
          product_price: 1,
          quantity: 1,
        },
      ]);
      const sidebar = document.querySelector('aside[data-live-sidebar]');
      expect(sidebar?.textContent).toMatch(/last add_to_cart 7s ago/);
    });

    it('header source line names the latest event when present', () => {
      mockSession.mockReturnValue({
        ...DEFAULT_SESSION,
        last_event_name: 'add_to_cart',
        last_event_at: new Date().toISOString(),
      });
      renderWithCart([
        {
          product_id: 'x',
          product_name: 'x',
          product_price: 1,
          quantity: 1,
        },
      ]);
      const sidebar = document.querySelector('aside[data-live-sidebar]');
      expect(sidebar?.textContent).toMatch(/add_to_cart · streaming/);
    });

    it('falls back to seed copy when no events have flowed yet', () => {
      renderWithCart([
        {
          product_id: 'x',
          product_name: 'x',
          product_price: 1,
          quantity: 1,
        },
      ]);
      const sidebar = document.querySelector('aside[data-live-sidebar]');
      expect(sidebar?.textContent).toMatch(/raw\.events · streaming/);
    });
  });
});
