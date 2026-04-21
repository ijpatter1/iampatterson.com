'use client';

import Link from 'next/link';

import { trackClickNav } from '@/lib/events/track';

/**
 * Phase 9F demo-scoped footer (product review 2026-04-21 Major #4).
 *
 * Renders at the bottom of every `/demo/ecommerce/*` route, below the
 * page content + any reveal sidebars. Carries the prototype's EcomFooter
 * block: "this is a demo" framing + the no-kill rescues mission line +
 * lowercase back-to-site links. The no-kill rescues mention lives here
 * (as the brand voice rules require) even though it also appears on
 * product detail + confirmation — footer surface is the closing brand
 * beat on every demo page.
 */
export function EcomFooter() {
  return (
    <footer className="border-t border-[var(--shop-warm-brown,#5C4A3D)]/15 bg-[var(--shop-cream-2,#F5EEDB)] px-6 py-10">
      <div className="mx-auto flex max-w-content flex-col gap-6 md:flex-row md:justify-between">
        <div className="flex flex-col gap-2 md:max-w-[520px]">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--shop-warm-brown,#5C4A3D)]/60">
            this is a demo
          </div>
          <p className="text-[13px] leading-relaxed text-[var(--shop-warm-brown,#5C4A3D)]/80">
            the tuna shop is a working storefront built to show what my tier 1–3 measurement stack
            looks like in production. nothing actually ships from here. every interaction you make
            is traced end-to-end. a portion of every real sale goes to no-kill rescues.
          </p>
        </div>
        <nav
          aria-label="Back to consulting site"
          className="flex flex-col gap-2 font-mono text-[11px] uppercase tracking-[0.12em]"
        >
          <Link
            href="/"
            onClick={() => trackClickNav('back to iampatterson.com', '/')}
            className="text-[var(--shop-warm-brown,#5C4A3D)]/70 hover:text-[var(--shop-terracotta,#C4703A)]"
          >
            ← back to iampatterson.com
          </Link>
          <Link
            href="/services"
            onClick={() => trackClickNav('services', '/services')}
            className="text-[var(--shop-warm-brown,#5C4A3D)]/70 hover:text-[var(--shop-terracotta,#C4703A)]"
          >
            services
          </Link>
          <Link
            href="/contact"
            onClick={() => trackClickNav('contact', '/contact')}
            className="text-[var(--shop-warm-brown,#5C4A3D)]/70 hover:text-[var(--shop-terracotta,#C4703A)]"
          >
            contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}
