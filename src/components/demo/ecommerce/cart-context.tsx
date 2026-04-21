'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';

/**
 * Phase 9F D7, cart-context with localStorage persistence.
 *
 * Storage shape matches the prototype's contract:
 * - key: `iampatterson.tunashop.cart.v1`
 * - cross-tab sync via the `storage` event
 * - persisted on every mutation; cleared on successful checkout (not on cart
 *   navigation) via `clearCart()`
 *
 * The internal `CartItem` shape keeps the `product_id` / `product_name` /
 * `product_price` / `quantity` field names established pre-9F rather than
 * switching to the prototype's `{ id, qty, price, name }`, this preserves
 * the existing `CartItem` type contract across the many consumers (listing
 * view, product detail, tracking helpers, tests). The persisted LOCAL
 * storage payload uses the internal shape; visitors migrating from a
 * pre-9F session will see their old in-memory cart cleared because the
 * storage key is new.
 */

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
  | { type: 'HYDRATE'; items: CartItem[] }
  | { type: 'ADD_ITEM'; item: CartItem }
  | { type: 'REMOVE_ITEM'; product_id: string }
  | { type: 'UPDATE_QUANTITY'; product_id: string; quantity: number }
  | { type: 'CLEAR' };

const STORAGE_KEY = 'iampatterson.tunashop.cart.v1';

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'HYDRATE':
      return { items: action.items };
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

function loadItems(): CartItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (i): i is CartItem =>
        !!i &&
        typeof i.product_id === 'string' &&
        typeof i.product_name === 'string' &&
        typeof i.product_price === 'number' &&
        typeof i.quantity === 'number',
    );
  } catch {
    return [];
  }
}

function saveItems(items: CartItem[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Best-effort; Safari private mode / quota failures are silently ignored.
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
  // Initial state is always empty; post-mount effect reconciles against
  // localStorage. Reading in the useReducer initialiser would produce SSR/CSR
  // hydration mismatches, 9E UAT F4 pattern.
  const [state, dispatch] = useReducer(cartReducer, { items: [] });

  // Hydrate from localStorage on mount.
  useEffect(() => {
    const stored = loadItems();
    if (stored.length > 0) dispatch({ type: 'HYDRATE', items: stored });
  }, []);

  // Persist every state change to localStorage.
  useEffect(() => {
    saveItems(state.items);
  }, [state.items]);

  // Cross-tab sync: if another tab mutates the same key, pull those changes in.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      dispatch({ type: 'HYDRATE', items: loadItems() });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

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
