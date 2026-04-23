/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { EcomSubNav } from '@/components/demo/ecommerce/ecom-sub-nav';
import { CartProvider, useCart } from '@/components/demo/ecommerce/cart-context';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const React = require('react');

let mockPathname = '/demo/ecommerce';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

function Seed({ qty = 1 }: { qty?: number }) {
  const { addItem } = useCart();
  const seeded = React.useRef(false);
  // Test-fixture idiom: synchronously seed the cart exactly once on
  // first render (see cart-view.test.tsx for matching rationale).
  if (!seeded.current) {
    // eslint-disable-next-line react-hooks/immutability -- test-fixture synchronous seed
    seeded.current = true;
    addItem({
      product_id: 'tuna-plush-classic',
      product_name: 'Tuna Plush',
      product_price: 26,
      quantity: qty,
    });
  }
  return null;
}

function renderNav({ path = '/demo/ecommerce', cartQty = 0 } = {}) {
  mockPathname = path;
  return render(
    <CartProvider>
      {cartQty > 0 ? <Seed qty={cartQty} /> : null}
      <EcomSubNav />
    </CartProvider>,
  );
}

describe('EcomSubNav (Phase 9F follow-up)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders shop + cart links', () => {
    renderNav();
    const shopLink = screen.getByRole('link', { name: /^shop$/i });
    expect(shopLink.getAttribute('href')).toBe('/demo/ecommerce');
    const cartLink = screen.getByRole('link', { name: /cart/i });
    expect(cartLink.getAttribute('href')).toBe('/demo/ecommerce/cart');
  });

  it('marks shop as current when pathname is /demo/ecommerce', () => {
    renderNav({ path: '/demo/ecommerce' });
    const shopLink = screen.getByRole('link', { name: /^shop$/i });
    expect(shopLink.getAttribute('aria-current')).toBe('page');
    const cartLink = screen.getByRole('link', { name: /cart/i });
    expect(cartLink.getAttribute('aria-current')).toBeNull();
  });

  it('marks cart as current when pathname is /demo/ecommerce/cart', () => {
    renderNav({ path: '/demo/ecommerce/cart' });
    const cartLink = screen.getByRole('link', { name: /cart/i });
    expect(cartLink.getAttribute('aria-current')).toBe('page');
    const shopLink = screen.getByRole('link', { name: /^shop$/i });
    expect(shopLink.getAttribute('aria-current')).toBeNull();
  });

  it('does not mark either as current on deeper routes (e.g. product detail)', () => {
    renderNav({ path: '/demo/ecommerce/tuna-plush-classic' });
    expect(screen.getByRole('link', { name: /^shop$/i }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('link', { name: /cart/i }).getAttribute('aria-current')).toBeNull();
  });

  it('renders the cart count badge with 0 when cart is empty', () => {
    renderNav({ cartQty: 0 });
    const cartLink = screen.getByRole('link', { name: /cart/i });
    expect(cartLink.textContent).toMatch(/0/);
  });

  it('renders cart count badge reflecting live cart state', () => {
    renderNav({ cartQty: 3 });
    const cartLink = screen.getByRole('link', { name: /cart/i });
    expect(cartLink.textContent).toMatch(/3/);
  });

  it('has an accessible nav landmark with shop-sections label', () => {
    renderNav();
    const nav = screen.getByRole('navigation');
    expect(nav.getAttribute('aria-label')).toMatch(/tuna shop/i);
  });

  // UAT r1 item 2, wordmark and nav items hug the edges of the
  // viewport on the shipped version. The prototype caps the nav's
  // inner content width so the items align with page content
  // beneath. A max-width inner container provides the margin.
  it('wraps nav content in a max-width inner container (UAT r1 item 2)', () => {
    renderNav();
    const nav = screen.getByRole('navigation');
    const inner = nav.firstElementChild as HTMLElement | null;
    expect(inner).not.toBeNull();
    expect(inner?.className).toMatch(/mx-auto/);
    expect(inner?.className).toMatch(/max-w-content/);
  });
});
