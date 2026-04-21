'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { trackBeginCheckout, trackPurchase } from '@/lib/events/track';
import { useCart } from './cart-context';
import { useToast } from '@/components/demo/reveal/toast-provider';
import { LiveSidebar } from '@/components/demo/reveal/live-sidebar';
import { FullPageDiagnostic } from '@/components/demo/reveal/full-page-diagnostic';
import { useSessionContext } from '@/hooks/useSessionContext';
import { WarehouseWriteReadout } from './warehouse-write-readout';
import {
  FULL_PAGE_DIAGNOSTIC_LINES,
  diagnosticLinesForConsent,
} from '@/lib/demo/reveal/warehouse-write';
import { classifyUtm, resolveUtmMeta } from '@/lib/demo/reveal/campaign-taxonomy';

/**
 * Phase 9F D8 — checkout page content.
 *
 * Fires `trackBeginCheckout` + a `begin_checkout` toast at `near-cart` on
 * mount; renders a 2-col layout with the editorial form + summary column,
 * a Pattern 2 `LiveSidebar` showing the warehouse-write BigQuery row
 * preview, and on submit triggers the one Pattern 4 full-page diagnostic
 * moment across the whole ecommerce demo before navigating to
 * `/demo/ecommerce/confirmation`.
 */
export function CheckoutForm() {
  const { items, total, itemCount, clearCart } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { push } = useToast();
  const session = useSessionContext();

  // Derive URL + browser-derivable values to thread into the BQ row
  // preview so the warehouse-write sidebar stops rendering hardcoded
  // utm / page / referrer values as if they were the visitor's.
  // Pulled on client post-mount via state so SSR stays consistent.
  const utmMeta = useMemo(
    () => resolveUtmMeta({ utm_campaign: searchParams?.get('utm_campaign') }),
    [searchParams],
  );
  const utmClassification = useMemo(() => classifyUtm(utmMeta.value), [utmMeta.value]);
  const [pageLocation, setPageLocation] = useState('');
  const [pageReferrer, setPageReferrer] = useState('');
  const [deviceCategory, setDeviceCategory] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPageLocation(window.location.href);
      // Conservative UA-based device classifier. "mobile" / "tablet" /
      // "desktop" — matches GA4's device_category dimension. Enough for
      // the demo's honest "this is what actually lands in the row"
      // reading; avoids a dependency on the heavier UA-parser libs.
      const ua = navigator.userAgent;
      if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) setDeviceCategory('tablet');
      else if (/Mobi|Android|iPhone|iPod/i.test(ua)) setDeviceCategory('mobile');
      else setDeviceCategory('desktop');
    }
    if (typeof document !== 'undefined') setPageReferrer(document.referrer);
  }, []);
  const toastedRef = useRef(false);
  const checkoutFiredRef = useRef(false);
  const [step, setStep] = useState<'form' | 'diagnostic'>('form');

  // Fire begin_checkout event + toast on mount (only when cart has items).
  useEffect(() => {
    if (checkoutFiredRef.current) return;
    if (items.length === 0) return;
    checkoutFiredRef.current = true;
    trackBeginCheckout({ cart_total: total, item_count: itemCount });

    if (toastedRef.current) return;
    toastedRef.current = true;
    const t = setTimeout(() => {
      push({
        event_name: 'begin_checkout',
        detail: `value=${total.toFixed(2)}  items=${itemCount}`,
        routing: ['GA4', 'BigQuery', 'Meta CAPI'],
        position: 'near-cart',
        duration: 2200,
      });
    }, 500);
    return () => clearTimeout(t);
  }, [items.length, total, itemCount, push]);

  const orderParams = useMemo(() => {
    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
    return { orderId, total, itemCount };
  }, [total, itemCount]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (items.length === 0) return;
    const productsJson = JSON.stringify(
      items.map((i) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        price: i.product_price,
        quantity: i.quantity,
      })),
    );
    trackPurchase({
      order_id: orderParams.orderId,
      order_total: total,
      item_count: itemCount,
      products: productsJson,
    });
    setStep('diagnostic');
  }

  function handleDiagnosticComplete() {
    clearCart();
    router.push(
      `/demo/ecommerce/confirmation?order_id=${orderParams.orderId}&total=${total.toFixed(2)}&items=${itemCount}`,
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded border border-[var(--shop-warm-brown,#5C4A3D)]/12 bg-[var(--shop-cream-2,#F5EEDB)] p-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--shop-warm-brown,#5C4A3D)]/70">
          [ cart · empty ]
        </div>
        <p className="text-[15px] text-[var(--shop-warm-brown,#5C4A3D)]/80">
          nothing to check out. your cart&apos;s empty.
        </p>
        <Link
          href="/demo/ecommerce"
          className="font-mono text-xs uppercase tracking-[0.1em] text-[var(--shop-terracotta,#C4703A)] hover:underline"
        >
          back to the shop →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <Link
        href="/demo/ecommerce/cart"
        className="font-mono text-xs text-[var(--shop-warm-brown,#5C4A3D)]/70 hover:text-[var(--shop-terracotta,#C4703A)]"
      >
        ← back to cart
      </Link>
      <h1 className="font-display text-[clamp(2.5rem,5vw,4rem)] leading-[1.05] tracking-[-0.015em] text-[var(--shop-warm-brown,#5C4A3D)]">
        checkout
      </h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:gap-10">
        <form
          onSubmit={handleSubmit}
          autoComplete="off"
          className="flex flex-col gap-6 text-[var(--shop-warm-brown,#5C4A3D)]"
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--shop-warm-brown,#5C4A3D)]/55">
            demo prefill — nothing ships from here, nothing is charged.
          </div>
          <fieldset className="flex flex-col gap-3">
            <legend className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--shop-warm-brown,#5C4A3D)]/70">
              01 · contact
            </legend>
            <label className="flex flex-col gap-1 text-xs">
              <span>email</span>
              <input
                type="email"
                defaultValue="hello@example.com"
                className="rounded border border-[var(--shop-warm-brown,#5C4A3D)]/25 bg-[var(--shop-cream-2,#F5EEDB)] px-3 py-2 text-sm"
              />
            </label>
          </fieldset>

          <fieldset className="flex flex-col gap-3 border-t border-[var(--shop-warm-brown,#5C4A3D)]/12 pt-4">
            <legend className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--shop-warm-brown,#5C4A3D)]/70">
              02 · shipping
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs">
                <span>first name</span>
                <input
                  type="text"
                  defaultValue="Jane"
                  className="rounded border border-[var(--shop-warm-brown,#5C4A3D)]/25 bg-[var(--shop-cream-2,#F5EEDB)] px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span>last name</span>
                <input
                  type="text"
                  defaultValue="Rivera"
                  className="rounded border border-[var(--shop-warm-brown,#5C4A3D)]/25 bg-[var(--shop-cream-2,#F5EEDB)] px-3 py-2 text-sm"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-xs">
              <span>address</span>
              <input
                type="text"
                defaultValue="123 Abbot Kinney Blvd"
                className="rounded border border-[var(--shop-warm-brown,#5C4A3D)]/25 bg-[var(--shop-cream-2,#F5EEDB)] px-3 py-2 text-sm"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-xs">
                <span>city</span>
                <input
                  type="text"
                  defaultValue="Venice"
                  className="rounded border border-[var(--shop-warm-brown,#5C4A3D)]/25 bg-[var(--shop-cream-2,#F5EEDB)] px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span>state</span>
                <input
                  type="text"
                  defaultValue="CA"
                  className="rounded border border-[var(--shop-warm-brown,#5C4A3D)]/25 bg-[var(--shop-cream-2,#F5EEDB)] px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span>zip</span>
                <input
                  type="text"
                  defaultValue="90291"
                  className="rounded border border-[var(--shop-warm-brown,#5C4A3D)]/25 bg-[var(--shop-cream-2,#F5EEDB)] px-3 py-2 text-sm"
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3 border-t border-[var(--shop-warm-brown,#5C4A3D)]/12 pt-4">
            <legend className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--shop-warm-brown,#5C4A3D)]/70">
              03 · payment
            </legend>
            <label className="flex flex-col gap-1 text-xs">
              <span>card number</span>
              <input
                type="text"
                defaultValue="4242 4242 4242 4242"
                className="rounded border border-[var(--shop-warm-brown,#5C4A3D)]/25 bg-[var(--shop-cream-2,#F5EEDB)] px-3 py-2 font-mono text-sm"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs">
                <span>expiry</span>
                <input
                  type="text"
                  defaultValue="12 / 28"
                  className="rounded border border-[var(--shop-warm-brown,#5C4A3D)]/25 bg-[var(--shop-cream-2,#F5EEDB)] px-3 py-2 font-mono text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span>cvc</span>
                <input
                  type="text"
                  defaultValue="123"
                  className="rounded border border-[var(--shop-warm-brown,#5C4A3D)]/25 bg-[var(--shop-cream-2,#F5EEDB)] px-3 py-2 font-mono text-sm"
                />
              </label>
            </div>
          </fieldset>

          <button
            type="submit"
            className="mt-2 flex items-center justify-between rounded bg-[var(--shop-terracotta,#C4703A)] px-5 py-3 text-sm font-medium text-[var(--shop-cream,#FBF6EA)] transition-opacity hover:opacity-90"
          >
            <span>place order</span>
            <span>${total.toFixed(2)}</span>
          </button>
          <p className="text-[11px] text-[var(--shop-warm-brown,#5C4A3D)]/70">
            no real charge. placing the order fires the{' '}
            <span className="font-mono text-[var(--shop-warm-brown,#5C4A3D)]">purchase</span> event
            through the full pipeline.
          </p>
        </form>

        <aside className="flex flex-col gap-4">
          <section className="rounded border border-[var(--shop-warm-brown,#5C4A3D)]/12 bg-[var(--shop-cream-2,#F5EEDB)] p-4">
            <header className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--shop-warm-brown,#5C4A3D)]/70">
              <span>your order</span>
              <span>{itemCount} items</span>
            </header>
            <ul className="flex flex-col gap-2">
              {items.map((item) => (
                <li
                  key={item.product_id}
                  className="flex items-center justify-between text-xs text-[var(--shop-warm-brown,#5C4A3D)]"
                >
                  <span className="font-mono text-[var(--shop-warm-brown,#5C4A3D)]/60">
                    {item.quantity}×
                  </span>
                  <span className="flex-1 px-2">{item.product_name}</span>
                  <span>${(item.product_price * item.quantity).toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <footer className="mt-3 flex items-center justify-between border-t border-[var(--shop-warm-brown,#5C4A3D)]/15 pt-3 text-sm font-medium text-[var(--shop-warm-brown,#5C4A3D)]">
              <span>total</span>
              <span>${total.toFixed(2)}</span>
            </footer>
          </section>

          <LiveSidebar
            route="checkout"
            title="Warehouse write · begin_checkout"
            tag="UNDER · BIGQUERY WRITE"
          >
            <WarehouseWriteReadout
              total={total}
              itemCount={itemCount}
              uniqueItems={items.length}
              live={{
                sessionId: session.session_id,
                eventTimestamp: session.last_event_at || undefined,
                // Consent flags only substitute once at least one event
                // has landed — before that we don't know the real state.
                consentAnalytics:
                  session.events_in_session > 0 ? session.consent_analytics : undefined,
                consentMarketing:
                  session.events_in_session > 0 ? session.consent_marketing : undefined,
                pageLocation: pageLocation || undefined,
                pageReferrer: pageReferrer || undefined,
                utmCampaign: utmMeta.value,
                utmIsLive: utmMeta.isLive,
                utmSource: utmClassification.source,
                channelClassified: `${utmClassification.source} · ${utmClassification.bucket}`,
                deviceCategory: deviceCategory || undefined,
              }}
            />
          </LiveSidebar>
        </aside>
      </div>

      {step === 'diagnostic' ? (
        <FullPageDiagnostic
          lines={
            session.events_in_session > 0
              ? diagnosticLinesForConsent({
                  analytics: session.consent_analytics,
                  marketing: session.consent_marketing,
                })
              : FULL_PAGE_DIAGNOSTIC_LINES
          }
          onComplete={handleDiagnosticComplete}
        />
      ) : null}
    </div>
  );
}
