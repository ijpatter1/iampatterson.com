import type { Metadata } from 'next';

import { DashboardPreview } from '@/components/demo/dashboard/dashboard-preview';
import { ProductListing } from '@/components/demo/ecommerce/product-listing';
import { ecommerceDashboardData } from '@/lib/demo/dashboard-data';

export const metadata: Metadata = {
  title: 'The Tuna Shop',
  description:
    'A fully instrumented e-commerce storefront. Browse products, add to cart, and checkout. Every interaction fires events through the full measurement stack.',
};

export default function EcommerceDemoPage() {
  return (
    <main className="mx-auto max-w-content px-6 py-12">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold tracking-tight text-content sm:text-3xl">
          The Tuna Shop
        </h1>
        <p className="mt-2 text-base text-content-secondary">
          A fully instrumented e-commerce storefront. Browse, add to cart, and checkout. Every
          interaction generates events that flow through the full measurement stack.
        </p>
      </div>
      <ProductListing />
      <DashboardPreview
        kpis={ecommerceDashboardData.kpis.slice(0, 3)}
        narrative="Every product view, add-to-cart, and purchase you generate in this demo feeds the same pipeline that produces these business metrics. 18 months of simulated traffic show revenue trending up 12% with a 3.2% conversion rate across channels."
        analyticsHref="/demo/ecommerce/analytics"
      />
    </main>
  );
}
