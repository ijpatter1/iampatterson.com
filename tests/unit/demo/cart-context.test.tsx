/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';

import { CartProvider, useCart } from '@/components/demo/ecommerce/cart-context';

function wrapper({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}

describe('useCart', () => {
  beforeEach(() => {
    // Phase 9F D7 added localStorage persistence; clear between tests so
    // earlier-test writes don't hydrate later-test providers.
    localStorage.clear();
  });

  it('starts with an empty cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.items).toHaveLength(0);
    expect(result.current.itemCount).toBe(0);
    expect(result.current.total).toBe(0);
  });

  it('adds an item to the cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addItem({
        product_id: 'tuna-plush',
        product_name: 'Tuna Plush Toy',
        product_price: 24.99,
        quantity: 1,
      });
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].product_id).toBe('tuna-plush');
    expect(result.current.itemCount).toBe(1);
    expect(result.current.total).toBeCloseTo(24.99);
  });

  it('increments quantity when adding the same item', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addItem({
        product_id: 'tuna-plush',
        product_name: 'Tuna Plush Toy',
        product_price: 24.99,
        quantity: 1,
      });
    });
    act(() => {
      result.current.addItem({
        product_id: 'tuna-plush',
        product_name: 'Tuna Plush Toy',
        product_price: 24.99,
        quantity: 2,
      });
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(3);
    expect(result.current.total).toBeCloseTo(74.97);
  });

  it('updates item quantity', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addItem({
        product_id: 'tuna-plush',
        product_name: 'Tuna Plush Toy',
        product_price: 24.99,
        quantity: 1,
      });
    });
    act(() => {
      result.current.updateQuantity('tuna-plush', 5);
    });
    expect(result.current.items[0].quantity).toBe(5);
    expect(result.current.total).toBeCloseTo(124.95);
  });

  it('removes item when quantity set to 0', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addItem({
        product_id: 'tuna-plush',
        product_name: 'Tuna Plush Toy',
        product_price: 24.99,
        quantity: 1,
      });
    });
    act(() => {
      result.current.updateQuantity('tuna-plush', 0);
    });
    expect(result.current.items).toHaveLength(0);
  });

  it('removes an item by ID', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addItem({
        product_id: 'tuna-plush',
        product_name: 'Tuna Plush Toy',
        product_price: 24.99,
        quantity: 1,
      });
      result.current.addItem({
        product_id: 'tuna-mug',
        product_name: 'Tuna Mug',
        product_price: 17.99,
        quantity: 1,
      });
    });
    act(() => {
      result.current.removeItem('tuna-plush');
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].product_id).toBe('tuna-mug');
  });

  it('clears the cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addItem({
        product_id: 'tuna-plush',
        product_name: 'Tuna Plush Toy',
        product_price: 24.99,
        quantity: 1,
      });
    });
    act(() => {
      result.current.clearCart();
    });
    expect(result.current.items).toHaveLength(0);
    expect(result.current.total).toBe(0);
  });

  it('computes itemCount across multiple items', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addItem({
        product_id: 'tuna-plush',
        product_name: 'Tuna Plush Toy',
        product_price: 24.99,
        quantity: 2,
      });
      result.current.addItem({
        product_id: 'tuna-mug',
        product_name: 'Tuna Mug',
        product_price: 17.99,
        quantity: 3,
      });
    });
    expect(result.current.itemCount).toBe(5);
  });
});
