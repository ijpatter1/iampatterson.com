'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

import { useToast } from '@/components/demo/reveal/toast-provider';
import { InlineDiagnostic } from '@/components/demo/reveal/inline-diagnostic';

interface OrderConfirmationProps {
  orderId: string;
  orderTotal: number;
  itemCount: number;
}

/**
 * Phase 9F D9 — confirmation page editorial head + Pattern 3 inline diagnostic.
 *
 * Fires a `purchase` toast on mount and renders:
 *   (a) the editorial order-confirmed block with $total-interpolated
 *       lead paragraph (with zombie-state fallback for missing / zero /
 *       non-finite totals — closes 9B follow-up #5);
 *   (b) the Pattern 3 InlineDiagnostic-wrapped timestamped 6-step
 *       pipeline-journey list (+0ms → +840ms). Per-step timings are
 *       representative; a muted footer inside the diagnostic surfaces
 *       this honestly (UAT r2 item 19).
 *
 * UAT r2 item 20 split: the "Dashboards are not the payoff" closing
 * beat + back-nav used to live inside this component, rendered ABOVE
 * the `DashboardPayoff` Metabase embed. That put the CTA above the
 * payoff, which fought the payoff. The closing beat moved into
 * `ConfirmationCloser` (exported below); the page-level server
 * component renders `<OrderConfirmation /> → <DashboardPayoff /> →
 * <ConfirmationCloser />` so the dashboard is the first thing below
 * the pipeline journey and the CTA lands AFTER it.
 */
export function OrderConfirmation({ orderId, orderTotal, itemCount }: OrderConfirmationProps) {
  const { push } = useToast();
  const firedRef = useRef(false);

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
    ? `Your $${orderTotal.toFixed(2)} order just landed in production BigQuery and is rolling into today's revenue below.`
    : `A real order just landed in production BigQuery and is rolling into today's revenue below.`;

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
          {leadSentence1} The dashboard ops reads in the morning is what you&apos;re looking at.
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

      <InlineDiagnostic tag="WHAT JUST HAPPENED" title="from click to dashboard">
        <ol className="flex flex-col gap-1.5">
          {PIPELINE_JOURNEY.map((step, i) => (
            <li
              key={i}
              className={`flex items-baseline gap-2 text-xs leading-snug ${
                step.tag === 'LIVE' ? 'text-[#F3C769]' : 'text-[#EAD9BC]'
              }`}
            >
              <span className="w-[70px] shrink-0 font-mono text-[#9E8A6B]">{step.t}</span>
              <span aria-hidden="true" className="text-[#F3C769]">
                &gt;
              </span>
              <span className="flex-1">{step.text}</span>
              <span
                className={`shrink-0 rounded border px-1 py-[1px] text-[9px] tracking-[0.1em] ${
                  step.tag === 'OK'
                    ? 'border-[#8FBF7A]/40 text-[#8FBF7A]'
                    : 'border-[#F3C769]/50 text-[#F3C769]'
                }`}
              >
                [{step.tag}]
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
 * Confirmation-page closing beat — "Dashboards are not the payoff"
 * paragraph + services link + back-nav. Split out of `OrderConfirmation`
 * in UAT r2 item 20 so the page-level composition can render it AFTER
 * the `DashboardPayoff` Metabase embed (pre-r2 it rendered above,
 * putting the "dashboards are not the payoff" CTA in conflict with the
 * dashboard-as-payoff framing by appearing first).
 */
export function ConfirmationCloser() {
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4 border-t border-[var(--shop-warm-brown,#5C4A3D)]/12 pt-8">
        <p className="max-w-[640px] font-display text-[20px] leading-snug text-[var(--shop-warm-brown,#5C4A3D)]">
          Dashboards are not the payoff. Answers are. The mart layer is what makes the answers
          trustworthy.
        </p>
        <Link
          href="/services"
          className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--shop-terracotta,#C4703A)] hover:underline"
        >
          read about the services →
        </Link>
      </section>

      <nav className="flex flex-wrap items-center gap-4 border-t border-[var(--shop-warm-brown,#5C4A3D)]/12 pt-6 text-sm">
        <Link
          href="/demo/ecommerce"
          className="text-[var(--shop-warm-brown,#5C4A3D)]/70 hover:text-[var(--shop-terracotta,#C4703A)]"
        >
          ← back to the shop
        </Link>
        <Link href="/" className="text-[var(--shop-terracotta,#C4703A)] hover:underline">
          return to iampatterson.com →
        </Link>
      </nav>
    </div>
  );
}

interface JourneyStep {
  t: string;
  text: string;
  tag: 'OK' | 'LIVE';
}

const PIPELINE_JOURNEY: JourneyStep[] = [
  { t: '+ 0ms', text: 'purchase event fired in browser', tag: 'OK' },
  { t: '+ 84ms', text: 'sGTM received · consent checked · enriched · routed', tag: 'OK' },
  { t: '+ 186ms', text: 'streaming insert · 1 row → iampatterson_raw.events_raw', tag: 'OK' },
  { t: '+ 412ms', text: 'Dataform staging · 4 stitches, 0 null drops', tag: 'OK' },
  { t: '+ 611ms', text: 'marts refreshed · session_events, attribution, ltv', tag: 'OK' },
  { t: '+ 840ms', text: 'dashboard KPIs reflect this order', tag: 'LIVE' },
];
