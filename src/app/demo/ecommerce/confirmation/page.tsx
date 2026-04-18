import { OrderConfirmation } from '@/components/demo/ecommerce/order-confirmation';
import { Tier3Embeds } from '@/components/demo/ecommerce/tier3-embeds';
import { mintConfirmationEmbedUrls } from '@/lib/metabase/embed';

interface ConfirmationPageProps {
  searchParams: {
    order_id?: string;
    total?: string;
    items?: string;
  };
}

export default function ConfirmationPage({ searchParams }: ConfirmationPageProps) {
  const orderId = searchParams.order_id ?? 'ORD-UNKNOWN';
  const orderTotal = parseFloat(searchParams.total ?? '0');
  const itemCount = parseInt(searchParams.items ?? '0', 10);

  // Secret + card IDs come from env at render time. If either is missing
  // (local dev, preview without the Vercel env wired up), we skip the
  // Tier 3 section rather than crash the page — the order confirmation
  // UX is still the core deliverable.
  const embedUrls = mintConfirmationEmbedUrls({
    secret: process.env.MB_EMBEDDING_SECRET_KEY,
    configRaw: process.env.METABASE_EMBED_CONFIG,
  });

  return (
    <>
      <OrderConfirmation orderId={orderId} orderTotal={orderTotal} itemCount={itemCount} />
      {embedUrls && <Tier3Embeds urls={embedUrls} />}
    </>
  );
}
