'use client';

import Link from 'next/link';

import { trackClickNav } from '@/lib/events/track';

/**
 * Cross-demo "Also explore" navigation is removed in Phase 9E, with only
 * the ecommerce demo on the site, there is nothing to cross-link to. Per
 * UX_PIVOT_SPEC §3.7 this simplifies to a single "back to homepage"
 * affordance; the component is retained (not deleted) so the demo layout
 * can still route visitors back to `/#demos` without the layout needing
 * to know about cross-demo geometry.
 */
export function DemoFooterNav() {
  return (
    <nav className="border-t border-border bg-surface-alt px-6 py-8">
      <div className="mx-auto flex max-w-content items-center justify-center">
        <Link
          href="/#demos"
          className="text-sm font-medium text-content-secondary transition-colors hover:text-content"
          onClick={() => trackClickNav('Back to demos', '/#demos')}
          aria-label="Back to demos"
        >
          &larr; Back to demos
        </Link>
      </div>
    </nav>
  );
}
