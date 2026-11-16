import { Suspense } from 'react';
import type { Metadata } from 'next';

import { ListingView } from '@/components/demo/ecommerce/listing-view';
import { ToastProvider } from '@/components/demo/reveal/toast-provider';

// Rendered per request. ListingView reads the query string with
// useSearchParams() under a Suspense boundary; on a static page that boundary
// falls back to client rendering, so the server HTML would carry no heading
// and no product links for crawlers or no-JS clients (17.1 gate, 2026-11-15).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'The Tuna Shop',
  description:
    'A fully instrumented e-commerce storefront. Browse products, add to cart, and checkout. Every interaction fires events through the full measurement stack.',
};

export default function EcommerceDemoPage() {
  // ToastProvider at the page root (not demo layout) so the three reveal
  // patterns that fire on this route, plus any add_to_cart toasts firing
  // from the grid, land in the same portal host as the cascade. Suspense
  // around ListingView isolates `useSearchParams` so the rest of the page
  // can render without waiting on the query string.
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
