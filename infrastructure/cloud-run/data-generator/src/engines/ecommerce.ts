/**
 * E-commerce session engine — generates a sequence of events
 * simulating a visitor browsing, adding to cart, and purchasing
 * on the Tuna Shop.
 */

import type {
  EcommerceProfile,
  Product,
  SyntheticEvent,
  SyntheticPageViewEvent,
  ProductViewEvent,
  AddToCartEvent,
  BeginCheckoutEvent,
  PurchaseEvent,
} from '../types';
import type { SessionContext } from '../session';
import { createBaseEvent } from '../session';
import { SeededRandom } from '../random';

/**
 * Generate events for one e-commerce session.
 *
 * Funnel: page_view → product_view(s) → add_to_cart → begin_checkout → purchase
 * Each step has a configurable drop-off rate.
 */
export function generateEcommerceSession(
  ctx: SessionContext,
  profile: EcommerceProfile,
  rng: SeededRandom,
): SyntheticEvent[] {
  const events: SyntheticEvent[] = [];
  let offsetMs = 0;

  // 1. Page view (landing on the shop)
  const pageView: SyntheticPageViewEvent = {
    ...createBaseEvent(ctx, 'page_view', offsetMs),
    event: 'page_view',
    page_referrer: ctx.utmSource === '(direct)' ? '' : `https://${ctx.utmSource || 'google'}.com`,
  };
  events.push(pageView);
  offsetMs += rng.int(2000, 8000);

  // 2. Browse products — view 1-4 products
  const numProductViews = rng.int(1, 4);
  const viewedProducts: Product[] = [];

  for (let i = 0; i < numProductViews; i++) {
    const product = selectProduct(profile.products, rng);
    viewedProducts.push(product);

    const productView: ProductViewEvent = {
      ...createBaseEvent(ctx, 'product_view', offsetMs),
      event: 'product_view',
      page_path: `/demo/ecommerce/product/${product.id}`,
      page_title: product.name,
      product_id: product.id,
      product_name: product.name,
      product_price: product.price,
      product_category: product.category,
    };
    events.push(productView);
    offsetMs += rng.int(5000, 30000);
  }

  // 3. Add to cart (funnel gate)
  if (!rng.chance(profile.funnelRates.viewToCart)) {
    return events; // Bounced after browsing
  }

  // Add 1+ items to cart
  const numItemsToAdd = Math.max(1, Math.round(rng.gaussian(profile.avgItemsPerOrder, 0.5)));
  const cartItems: Array<{ product: Product; quantity: number }> = [];

  for (let i = 0; i < numItemsToAdd; i++) {
    // Prefer products already viewed, but sometimes add new ones
    const product =
      i < viewedProducts.length && rng.chance(0.7)
        ? viewedProducts[i]
        : selectProduct(profile.products, rng);
    const quantity = rng.chance(0.8) ? 1 : rng.int(2, 3);

    cartItems.push({ product, quantity });

    const addToCart: AddToCartEvent = {
      ...createBaseEvent(ctx, 'add_to_cart', offsetMs),
      event: 'add_to_cart',
      page_path: `/demo/ecommerce/product/${product.id}`,
      page_title: product.name,
      product_id: product.id,
      product_name: product.name,
      product_price: product.price,
      quantity,
    };
    events.push(addToCart);
    offsetMs += rng.int(1000, 5000);
  }

  // 4. Begin checkout (funnel gate)
  if (!rng.chance(profile.funnelRates.cartToCheckout)) {
    return events; // Cart abandoned
  }

  const cartTotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const beginCheckout: BeginCheckoutEvent = {
    ...createBaseEvent(ctx, 'begin_checkout', offsetMs),
    event: 'begin_checkout',
    page_path: '/demo/ecommerce/checkout',
    page_title: 'Checkout',
    cart_total: Math.round(cartTotal * 100) / 100,
    item_count: itemCount,
  };
  events.push(beginCheckout);
  offsetMs += rng.int(15000, 60000);

  // 5. Purchase (funnel gate)
  if (!rng.chance(profile.funnelRates.checkoutToPurchase)) {
    return events; // Checkout abandoned
  }

  const orderId = `ORD-${Date.now()}-${rng.int(1000, 9999)}`;
  const purchase: PurchaseEvent = {
    ...createBaseEvent(ctx, 'purchase', offsetMs),
    event: 'purchase',
    page_path: '/demo/ecommerce/checkout/confirm',
    page_title: 'Order Confirmation',
    order_id: orderId,
    order_total: Math.round(cartTotal * 100) / 100,
    item_count: itemCount,
    products: cartItems.map((item) => ({
      product_id: item.product.id,
      product_name: item.product.name,
      price: item.product.price,
      quantity: item.quantity,
    })),
  };
  events.push(purchase);

  return events;
}

/**
 * Select a product weighted by popularity.
 */
function selectProduct(products: Product[], rng: SeededRandom): Product {
  const items: Array<readonly [Product, number]> = products.map((p) => [p, p.weight]);
  return rng.weighted(items);
}
