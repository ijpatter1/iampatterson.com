'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

import { ProductListing } from './product-listing';
import { useCart } from './cart-context';
import { useToast } from '@/components/demo/reveal/toast-provider';
import { products as allProducts, type Product } from '@/lib/demo/products';
import { trackAddToCart } from '@/lib/events/track';
import { classifyUtm, resolveUtmMeta } from '@/lib/demo/reveal/campaign-taxonomy';

/**
 * Phase 9F D5 — listing view.
 *
 * Composes the editorial listing-hero (eyebrow + serif headline + lede +
 * your-utm/classified-as panel) and the 6-product grid. Fires the
 * three-toast session-boot cascade on mount per the prototype's timing:
 * session_start at ~700ms, taxonomy_classified at ~1.9s, view_item_list at
 * ~3.6s. Reads `utm_campaign` from `searchParams` (via `useSearchParams`)
 * and falls back to the deterministic default seed.
 */
export function ListingView() {
  const searchParams = useSearchParams();
  const utmMeta = useMemo(
    () => resolveUtmMeta({ utm_campaign: searchParams?.get('utm_campaign') }),
    [searchParams],
  );
  const utmCampaign = utmMeta.value;
  const classification = useMemo(() => classifyUtm(utmCampaign), [utmCampaign]);

  const { addItem } = useCart();
  const { push } = useToast();

  const cascadeFiredRef = useRef(false);

  useEffect(() => {
    if (cascadeFiredRef.current) return;
    cascadeFiredRef.current = true;

    const t1 = setTimeout(() => {
      push({
        event_name: 'session_start',
        detail: `utm_campaign=${utmCampaign}`,
        routing: ['sGTM', 'BigQuery'],
        position: 'viewport-top',
        duration: 2200,
      });
    }, 700);

    const t2 = setTimeout(() => {
      push({
        event_name: 'taxonomy_classified',
        detail: `${utmCampaign}  →  ${classification.bucket}`,
        routing: ['Dataform · stg_classified_sessions'],
        position: 'viewport-top',
        duration: 2600,
      });
    }, 1900);

    const t3 = setTimeout(() => {
      push({
        event_name: 'view_item_list',
        detail: `list_name=all_products  count=${allProducts.length}`,
        routing: ['GA4', 'BigQuery'],
        position: 'viewport-top',
        duration: 2200,
      });
    }, 3600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
    // utmCampaign + classification are derived from searchParams; cascade
    // fires once per mount regardless. Don't re-trigger on search-param
    // changes within the same mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAddToCart(product: Product) {
    trackAddToCart({
      product_id: product.id,
      product_name: product.name,
      product_price: product.price,
      quantity: 1,
    });
    addItem({
      product_id: product.id,
      product_name: product.name,
      product_price: product.price,
      quantity: 1,
    });
    push({
      event_name: 'add_to_cart',
      detail: `item_id=${product.id}  value=${product.price}`,
      routing: ['GA4', 'BigQuery'],
      position: 'near-cart',
      duration: 2000,
    });
  }

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--shop-warm-brown,#5C4A3D)]/70">
          the tuna shop · 6 things
        </div>
        <h1 className="font-display text-[clamp(2.5rem,5vw,4rem)] leading-[1.05] tracking-[-0.015em] text-[var(--shop-warm-brown,#5C4A3D)]">
          the underdog with the{' '}
          <em className="not-italic text-[var(--shop-terracotta,#C4703A)]">overbite.</em>
        </h1>
        <p className="max-w-[640px] text-[17px] leading-[1.55] text-[var(--shop-warm-brown,#5C4A3D)]/80">
          Tuna is a chiweenie with a famous face. This is his shop. Plushes, a calendar, a cameo or
          two. A portion of every order goes to no-kill rescues. Every click you make is also a
          demo: the toasts up top are your browser talking to sGTM, which talks to BigQuery.
        </p>
        <dl
          data-utm-capture=""
          className="grid grid-cols-1 gap-2 rounded border border-[#F3C769]/25 bg-[#0D0B09] p-4 sm:grid-cols-[max-content_1fr] sm:gap-x-6 sm:gap-y-3"
        >
          <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#9E8A6B]">
            {utmMeta.isLive ? 'your utm_campaign' : 'example utm_campaign'}
          </dt>
          <dd className="flex flex-wrap items-center gap-2 font-mono text-xs text-[#EAD9BC]">
            <span>{utmCampaign}</span>
            {utmMeta.isLive ? null : (
              <span className="rounded border border-[#F3C769]/40 px-1.5 py-[1px] text-[9px] uppercase tracking-[0.12em] text-[#F3C769]">
                example · no utm in your url
              </span>
            )}
          </dd>
          <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#9E8A6B]">
            classified as
          </dt>
          <dd className="flex flex-wrap items-center gap-2">
            <span className="rounded border border-[#F3C769]/30 px-2 py-[2px] font-mono text-[10px] tracking-[0.05em] text-[#EAD9BC]">
              {classification.source}
            </span>
            <span className="rounded border border-[#F3C769]/30 px-2 py-[2px] font-mono text-[10px] tracking-[0.05em] text-[#EAD9BC]">
              {classification.medium}
            </span>
            <span className="rounded border border-[#F3C769] bg-[#F3C769]/10 px-2 py-[2px] font-mono text-[10px] tracking-[0.05em] text-[#F3C769]">
              {classification.bucket}
            </span>
          </dd>
        </dl>
      </section>

      <section className="flex flex-col gap-5">
        <ProductListing products={allProducts} onAddToCart={handleAddToCart} />
      </section>
    </div>
  );
}
