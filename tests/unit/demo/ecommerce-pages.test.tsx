/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ProductDetail } from '@/components/demo/ecommerce/product-detail';
import { CartView } from '@/components/demo/ecommerce/cart-view';
import { CheckoutForm } from '@/components/demo/ecommerce/checkout-form';
import { OrderConfirmation } from '@/components/demo/ecommerce/order-confirmation';
import { CartProvider, useCart } from '@/components/demo/ecommerce/cart-context';
import { getProduct } from '@/lib/demo/products';

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

describe('ProductDetail', () => {
  const product = getProduct('tuna-plush-classic')!;

  it('renders product name and price', () => {
    render(
      <CartProvider>
        <ProductDetail product={product} />
      </CartProvider>,
    );
    expect(screen.getByText('Tuna Plush')).toBeInTheDocument();
    expect(screen.getByText('$26.00')).toBeInTheDocument();
  });

  it('fires trackProductView on mount', () => {
    render(
      <CartProvider>
        <ProductDetail product={product} />
      </CartProvider>,
    );
    expect(mockTrackProductView).toHaveBeenCalledWith({
      product_id: 'tuna-plush-classic',
      product_name: 'Tuna Plush',
      product_price: 26,
      product_category: 'plush',
    });
  });

  it('fires trackAddToCart when Add to Cart is clicked', async () => {
    const user = userEvent.setup();
    render(
      <CartProvider>
        <ProductDetail product={product} />
      </CartProvider>,
    );
    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    expect(mockTrackAddToCart).toHaveBeenCalledWith({
      product_id: 'tuna-plush-classic',
      product_name: 'Tuna Plush',
      product_price: 26,
      quantity: 1,
    });
  });

  it('renders product description', () => {
    render(
      <CartProvider>
        <ProductDetail product={product} />
      </CartProvider>,
    );
    expect(screen.getByText(/moldable body, bendable legs/i)).toBeInTheDocument();
  });
});

describe('CartView', () => {
  it('shows empty cart message when no items', () => {
    render(
      <CartProvider>
        <CartView />
      </CartProvider>,
    );
    expect(screen.getByText(/cart is empty/i)).toBeInTheDocument();
  });

  it('shows link to continue shopping', () => {
    render(
      <CartProvider>
        <CartView />
      </CartProvider>,
    );
    expect(screen.getByRole('link', { name: /continue shopping/i })).toHaveAttribute(
      'href',
      '/demo/ecommerce',
    );
  });
});

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
