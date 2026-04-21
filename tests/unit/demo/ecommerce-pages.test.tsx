/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CheckoutForm } from '@/components/demo/ecommerce/checkout-form';
import { OrderConfirmation } from '@/components/demo/ecommerce/order-confirmation';
import { CartProvider, useCart } from '@/components/demo/ecommerce/cart-context';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/demo/ecommerce/checkout',
}));

jest.mock('@/lib/events/track', () => ({
  trackProductView: jest.fn(),
  trackAddToCart: jest.fn(),
  trackBeginCheckout: jest.fn(),
  trackPurchase: jest.fn(),
  trackClickCta: jest.fn(),
  trackClickNav: jest.fn(),
}));

import {
  trackProductView,
  trackAddToCart,
  trackBeginCheckout,
  trackPurchase,
} from '@/lib/events/track';

const mockTrackProductView = trackProductView as jest.Mock;
const mockTrackAddToCart = trackAddToCart as jest.Mock;
const mockTrackBeginCheckout = trackBeginCheckout as jest.Mock;
const mockTrackPurchase = trackPurchase as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

// ProductListing's direct-render tests moved to
// `tests/unit/components/demo/ecommerce/listing-view.test.tsx`. Phase 9F D5
// rewrote ProductListing to require `products` / `onAddToCart` props and
// introduced the ListingView client wrapper which composes it with the
// session-boot toast cascade + hero block + cart wiring.

// ProductDetail's direct-render tests moved to
// `tests/unit/components/demo/ecommerce/product-detail.test.tsx`. Phase 9F D6
// rewrote ProductDetail to the Tuna Shop hi-fi design + fire the product_view
// toast + render the staging-layer LiveSidebar; the new tests cover that
// composed surface (ToastProvider + CartProvider render context).

// CartView's direct-render tests moved to
// `tests/unit/components/demo/ecommerce/cart-view.test.tsx`. Phase 9F D7
// rewrote CartView to the Tuna Shop hi-fi design + fire view_cart toast +
// render the data-quality LiveSidebar; the new tests cover that composed
// surface (ToastProvider + CartProvider + localStorage persistence).

function AddItemThenCheckout() {
  const { addItem } = useCart();
  React.useEffect(() => {
    addItem({
      product_id: 'tuna-plush-classic',
      product_name: 'Tuna Plush',
      product_price: 26,
      quantity: 1,
    });
  }, [addItem]);
  return <CheckoutForm />;
}

describe('CheckoutForm', () => {
  it('shows empty state when cart has no items', () => {
    render(
      <CartProvider>
        <CheckoutForm />
      </CartProvider>,
    );
    expect(screen.getByText(/cart is empty/i)).toBeInTheDocument();
  });

  it('renders shipping form fields when cart has items', () => {
    render(
      <CartProvider>
        <AddItemThenCheckout />
      </CartProvider>,
    );
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('renders Complete Purchase button when cart has items', () => {
    render(
      <CartProvider>
        <AddItemThenCheckout />
      </CartProvider>,
    );
    expect(screen.getByRole('button', { name: /complete purchase/i })).toBeInTheDocument();
  });
});

describe('OrderConfirmation', () => {
  it('renders confirmation heading', () => {
    render(<OrderConfirmation orderId="ORD-TEST-001" orderTotal={49.98} itemCount={2} />);
    expect(screen.getByText(/ORD-TEST-001/)).toBeInTheDocument();
  });

  it('shows the order total', () => {
    render(<OrderConfirmation orderId="ORD-TEST-001" orderTotal={49.98} itemCount={2} />);
    expect(screen.getByText(/\$49\.98/)).toBeInTheDocument();
  });

  it('shows the open-your-session prompt', () => {
    render(<OrderConfirmation orderId="ORD-TEST-001" orderTotal={49.98} itemCount={2} />);
    expect(screen.getByText(/open your session/i)).toBeInTheDocument();
  });
});
