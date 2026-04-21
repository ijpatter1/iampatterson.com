import type { HTMLAttributes } from 'react';

/**
 * Persistent "this is a demo" banner (UAT r2 item 7).
 *
 * Rendered at the very top of every `/demo/ecommerce/*` route, above
 * EcomSubNav. Previously the same reminder lived only in EcomFooter, 
 * visitors who skipped the footer never saw the disclaimer. Moving it
 * to the top ensures the framing is the first thing they see on every
 * demo page load.
 *
 * Terminal palette (amber on near-black) deliberately matches the
 * under-the-hood reveal surfaces, the visible demo-scaffolding at the
 * top is itself a small "you're looking at infrastructure" moment,
 * which is the whole pitch of the site.
 */
export function EcomDemoBanner(props: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-ecom-demo-banner=""
      className="w-full border-b border-[#F3C769]/25 bg-[#0D0B09]"
      {...props}
    >
      <div className="mx-auto flex max-w-content items-center justify-center gap-2 px-6 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#F3C769]">
        <span
          aria-hidden="true"
          className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#8FBF7A]"
        />
        <span>this is a demo · nothing ships from here</span>
      </div>
    </div>
  );
}
