import { Suspense } from 'react';
import type { Metadata } from 'next';
import { after } from 'next/server';

import { ListingView } from '@/components/demo/ecommerce/listing-view';
import { ToastProvider } from '@/components/demo/reveal/toast-provider';
import { warmMetabaseDashboard } from '@/lib/metabase/keep-warm';

export const metadata: Metadata = {
  title: 'The Tuna Shop',
  description:
    'A fully instrumented e-commerce storefront. Browse products, add to cart, and checkout. Every interaction fires events through the full measurement stack.',
};

// Force dynamic rendering (Phase 9F D9). Previously static (○ in the
// build output), which caused the warmup hook below to fire once at
// build time instead of per-visitor. Dynamic rendering ensures the
// 30-min module-scope debounce gates by real visit cadence, and keeps
// `after()` eligible (it only fires on dynamic requests).
export const dynamic = 'force-dynamic';

export default function EcommerceDemoPage() {
  // Organic Metabase warmup (Phase 9F D9 → 10a D2). Stronger intent signal
  // than the homepage hook — a visitor on the demo listing is ~1–2 min
  // away from the confirmation page. `after()` defers the 5–15s BigQuery
  // card fan-out until after the response flushes so Vercel's post-flush
  // freeze doesn't truncate it mid-flight. The 30-min module-scope
  // debounce inside warmMetabaseDashboard coalesces with the homepage
  // fire when both are visited in the same session.
  after(() => warmMetabaseDashboard());
  // ToastProvider at the page root (not demo layout) so the three reveal
  // patterns that fire on this route, plus any add_to_cart toasts firing
  // from the grid, land in the same portal host as the cascade. Suspense
  // around ListingView isolates `useSearchParams` so the client bundle
  // stays narrow around it even though the surrounding page is dynamic.
  return (
    <ToastProvider>
      <main className="mx-auto max-w-content px-6 py-12">
        <Suspense fallback={null}>
          <ListingView />
        </Suspense>
      </main>
    </ToastProvider>
  );
}
