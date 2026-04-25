'use client';

import Link from 'next/link';
import type { HTMLAttributes } from 'react';

import { trackClickNav } from '@/lib/events/track';

/**
 * Persistent "this is a demo" banner (UAT r2 item 7).
 *
 * Rendered at the very top of every `/demo/ecommerce/*` route, above
 * EcomSubNav. Previously the same reminder lived only in EcomFooter,
 * visitors who skipped the footer never saw the disclaimer. Moving it
 * to the top ensures the framing is the first thing they see on every
 * demo page load.
 *
 * Phase 10d D8.g added a "back to homepage" link. On mobile (<md) the
 * layout stacks vertically (link row + message row) so the full
 * "nothing ships from here" honesty clause is preserved — dropping the
 * tail on small viewports would lose the brand-promise at the exact
 * moment a distracted first-touch visitor needs it most. On md+ the
 * layout collapses to a 3-column grid (`auto_1fr_auto`) with the link
 * on the left, message centred, and a balancing spacer on the right.
 *
 * Terminal palette (amber on near-black) deliberately matches the
 * under-the-hood reveal surfaces, the visible demo-scaffolding at the
 * top is itself a small "you're looking at infrastructure" moment,
 * which is the whole pitch of the site.
 */
export function EcomDemoBanner({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  // Extract caller `className` before the spread + compose with the
  // palette classes so a caller-provided className appends rather than
  // replaces (Pass-3 tech-evaluator Minor #3). Any other forwarded
  // HTMLAttributes still pass through unchanged.
  const palette = 'w-full border-b border-[#F3C769]/25 bg-[#0D0B09]';
  const composed = className ? `${palette} ${className}` : palette;
  return (
    <div data-ecom-demo-banner="" className={composed} {...props}>
      <div className="mx-auto flex max-w-content flex-col items-stretch gap-1 px-6 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#F3C769] md:grid md:grid-cols-[auto_1fr_auto] md:items-center md:gap-3">
        <Link
          href="/"
          onClick={() => trackClickNav('back to homepage', '/')}
          className="self-start text-[#F3C769]/75 transition-colors hover:text-[#F3C769] md:justify-self-start"
        >
          ← back to homepage
        </Link>
        <span className="flex items-center gap-2 md:justify-center">
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#8FBF7A]"
          />
          <span>this is a demo · nothing ships from here</span>
        </span>
        <span aria-hidden="true" className="hidden md:block md:justify-self-end" />
      </div>
    </div>
  );
}
