'use client';

import { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';

export interface CartItem {
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
}

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: 'ADD_ITEM'; item: CartItem }
  | { type: 'REMOVE_ITEM'; product_id: string }
  | { type: 'UPDATE_QUANTITY'; product_id: string; quantity: number }
  | { type: 'CLEAR' };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find((i) => i.product_id === action.item.product_id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.product_id === action.item.product_id
              ? { ...i, quantity: i.quantity + action.item.quantity }
              : i,
          ),
        };
      }
      return { items: [...state.items, action.item] };
    }
    case 'REMOVE_ITEM':
      return { items: state.items.filter((i) => i.product_id !== action.product_id) };
    case 'UPDATE_QUANTITY': {
      if (action.quantity <= 0) {
        return { items: state.items.filter((i) => i.product_id !== action.product_id) };
      }
      return {
        items: state.items.map((i) =>
          i.product_id === action.product_id ? { ...i, quantity: action.quantity } : i,
        ),
      };
    }
    case 'CLEAR':
      return { items: [] };
  }
}

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  total: number;
  addItem: (item: CartItem) => void;
  removeItem: (product_id: string) => void;
  updateQuantity: (product_id: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });

  const addItem = useCallback((item: CartItem) => dispatch({ type: 'ADD_ITEM', item }), []);
  const removeItem = useCallback(
    (product_id: string) => dispatch({ type: 'REMOVE_ITEM', product_id }),
    [],
  );
  const updateQuantity = useCallback(
    (product_id: string, quantity: number) =>
      dispatch({ type: 'UPDATE_QUANTITY', product_id, quantity }),
    [],
  );
  const clearCart = useCallback(() => dispatch({ type: 'CLEAR' }), []);

  const itemCount = useMemo(
    () => state.items.reduce((sum, i) => sum + i.quantity, 0),
    [state.items],
  );
  const total = useMemo(
    () => state.items.reduce((sum, i) => sum + i.product_price * i.quantity, 0),
    [state.items],
  );

  const value = useMemo(
    () => ({
      items: state.items,
      itemCount,
      total,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
    }),
    [state.items, itemCount, total, addItem, removeItem, updateQuantity, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}
