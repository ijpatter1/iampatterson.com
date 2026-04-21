'use client';

import Link from 'next/link';

import { trackClickNav } from '@/lib/events/track';

/**
 * Phase 9F demo-scoped footer (product review 2026-04-21 Major #4).
 *
 * Renders at the bottom of every `/demo/ecommerce/*` route, below the
 * page content + any reveal sidebars. Carries the mission paragraph +
 * no-kill rescues brand beat + lowercase back-to-site links.
 *
 * The "this is a demo" eyebrow that used to live here moved to
 * `EcomDemoBanner` at the top of the layout in UAT r2 item 7, the
 * reminder needed to be visible on every page load, not buried in the
 * footer where many visitors never scrolled.
 */
export function EcomFooter() {
  return (
    <footer className="border-t border-[var(--shop-warm-brown,#5C4A3D)]/15 bg-[var(--shop-cream-2,#F5EEDB)] px-6 py-10">
      <div className="mx-auto flex max-w-content flex-col gap-6 md:flex-row md:justify-between">
        <div className="flex flex-col gap-2 md:max-w-[520px]">
          <p className="text-[13px] leading-relaxed text-[var(--shop-warm-brown,#5C4A3D)]/80">
            The tuna shop is a working storefront built to show what a production measurement stack
            looks like end-to-end. Nothing actually ships from here. Every interaction you make is
            traced from click to dashboard. A portion of every real sale goes to no-kill rescues.
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
