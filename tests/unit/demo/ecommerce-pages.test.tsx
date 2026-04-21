/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { OrderConfirmation } from '@/components/demo/ecommerce/order-confirmation';

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

// CheckoutForm's direct-render tests moved to
// `tests/unit/components/demo/ecommerce/checkout-form.test.tsx`. Phase 9F D8
// rewrote CheckoutForm to the Tuna Shop hi-fi design + fire begin_checkout
// toast + render warehouse-write LiveSidebar + trigger the full-page
// diagnostic moment on submit before navigating to /confirmation.

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
