'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

import { HERO } from '@/lib/content/hero';
import { REVIEW_PAGE_HREF } from '@/lib/content/review';
import { trackClickCta } from '@/lib/events/track';

import { useScrollToTopOnMount } from '@/hooks/useScrollToTopOnMount';
import { useToast } from '@/components/demo/reveal/toast-provider';
import { InlineDiagnostic } from '@/components/demo/reveal/inline-diagnostic';

interface OrderConfirmationProps {
  orderId: string;
  orderTotal: number;
  itemCount: number;
}

/**
 * Phase 9F D9, confirmation page editorial head + Pattern 3 inline diagnostic.
 *
 * Fires a `purchase` toast on mount and renders:
 *   (a) the editorial order-confirmed block with $total-interpolated
 *       lead paragraph (with zombie-state fallback for missing / zero /
 *       non-finite totals, closes 9B follow-up #5);
 *   (b) the Pattern 3 InlineDiagnostic-wrapped timestamped 3-step
 *       pipeline-journey list (+0ms → +186ms), ending at the BigQuery row
 *       (Dataform runs nightly, so it is not a step). Per-step timings are
 *       representative; a muted footer inside the diagnostic surfaces
 *       this honestly (UAT r2 item 19).
 *
 * UAT r2 item 20 split: the closing links live in `ConfirmationCloser`
 * (exported below), which the page renders after this component. A
 * Metabase dashboard embed sat between the two until 17.1 removed it,
 * and the dashboard copy went before Metabase was retired (18.3).
 */
export function OrderConfirmation({ orderId, orderTotal, itemCount }: OrderConfirmationProps) {
  const { push } = useToast();
  const firedRef = useRef(false);

  // UAT r3 B11: snap to top on mount so the order-confirmed editorial
  // head is what the visitor sees after the checkout redirect, not a
  // mid-page scroll inherited from the prior route.
  useScrollToTopOnMount();

  // One-shot `purchase` toast on mount. The `firedRef` guards against
  // React 18 Strict-Mode double-invocation in dev; the effect-level
  // cleanup clears the pending setTimeout if the page unmounts before
  // the 500ms delay elapses. `[orderId, push]` are listed in the dep
  // array for exhaustive-deps compliance, but the parent page reads
  // `orderId` once from Server-Component searchParams and never
  // re-renders with a changed value in practice, the ref-guard is
  // belt-and-braces against a future client-side re-render, not the
  // primary correctness mechanism.
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    const t = setTimeout(() => {
      push({
        event_name: 'purchase',
        detail: `order_id=${orderId}`,
        routing: ['GA4', 'BigQuery'],
        position: 'viewport-top',
        duration: 2200,
      });
    }, 500);
    return () => clearTimeout(t);
  }, [orderId, push]);

  const hasFiniteTotal = Number.isFinite(orderTotal) && orderTotal > 0;
  const leadSentence1 = hasFiniteTotal
    ? `Your $${orderTotal.toFixed(2)} order just landed in production BigQuery.`
    : `A real order just landed in production BigQuery.`;

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--shop-warm-brown,#5C4A3D)]/70">
          order confirmed · <span className="font-mono">{orderId}</span> · tuna is proud
        </div>
        <h1 className="font-display text-[clamp(2.5rem,5vw,4rem)] leading-[1.05] tracking-[-0.015em] text-[var(--shop-warm-brown,#5C4A3D)]">
          Thanks. The event made it all the way through.
        </h1>
        <p className="max-w-[640px] text-[15px] leading-relaxed text-[var(--shop-warm-brown,#5C4A3D)]/80">
          {leadSentence1}
        </p>
        <div className="flex flex-wrap gap-6 text-xs text-[var(--shop-warm-brown,#5C4A3D)]/80">
          <span>
            <span className="text-[var(--shop-warm-brown,#5C4A3D)]/60">items · </span>
            {itemCount}
          </span>
          {hasFiniteTotal ? (
            <span>
              <span className="text-[var(--shop-warm-brown,#5C4A3D)]/60">total · </span>$
              {orderTotal.toFixed(2)}
            </span>
          ) : null}
          <span>
            <span className="text-[var(--shop-warm-brown,#5C4A3D)]/60">gives back · </span>a portion
            to no-kill rescues
          </span>
        </div>
      </section>

      <InlineDiagnostic tag="WHAT JUST HAPPENED" title="from click to BigQuery">
        <ol className="flex flex-col gap-1.5">
          {PIPELINE_JOURNEY.map((step, i) => (
            <li key={i} className="flex items-baseline gap-2 text-xs leading-snug text-[#EAD9BC]">
              <span className="w-[70px] shrink-0 font-mono text-[#9E8A6B]">{step.t}</span>
              <span aria-hidden="true" className="text-[#F3C769]">
                &gt;
              </span>
              <span className="flex-1">{step.text}</span>
              <span className="shrink-0 rounded border border-[#8FBF7A]/40 px-1 py-[1px] text-[9px] tracking-[0.1em] text-[#8FBF7A]">
                [OK]
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[#9E8A6B]">
          representative cadence · real latency varies with pipeline load
        </p>
      </InlineDiagnostic>
    </div>
  );
}

/**
 * The end of the shop demo: the way back to the shop and the site's one
 * call to action, the homepage's "Start with a review". Split out of
 * `OrderConfirmation` in UAT r2 item 20; the page renders it last.
 */
export function ConfirmationCloser() {
  return (
    <div className="flex flex-col gap-10">
      <nav className="flex flex-wrap items-center gap-4 border-t border-[var(--shop-warm-brown,#5C4A3D)]/12 pt-6 text-sm">
        <Link
          href="/demo/ecommerce"
          className="text-[var(--shop-warm-brown,#5C4A3D)]/70 hover:text-[var(--shop-terracotta,#C4703A)]"
        >
          ← back to the shop
        </Link>
        <Link
          href={REVIEW_PAGE_HREF}
          onClick={() => trackClickCta(HERO.primaryCta, 'shop_confirmation_review')}
          className="text-[var(--shop-terracotta,#C4703A)] hover:underline"
        >
          {HERO.primaryCta} <span aria-hidden="true">→</span>
        </Link>
      </nav>
    </div>
  );
}

interface JourneyStep {
  t: string;
  text: string;
}

const PIPELINE_JOURNEY: JourneyStep[] = [
  { t: '+ 0ms', text: 'purchase event fired in browser' },
  { t: '+ 84ms', text: 'sGTM received · consent checked · enriched · routed' },
  { t: '+ 186ms', text: 'streaming insert · 1 row → iampatterson_raw.events_raw' },
];
