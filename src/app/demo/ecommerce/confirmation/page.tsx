import { OrderConfirmation } from '@/components/demo/ecommerce/order-confirmation';
import { Tier3Embeds } from '@/components/demo/ecommerce/tier3-embeds';
import { mintConfirmationEmbedUrls } from '@/lib/metabase/embed';

interface ConfirmationPageProps {
  // Next.js App Router types searchParams values as string | string[] | undefined.
  // Duplicate query params (?total=1&total=2) yield string[]; we normalize to the
  // first value below so parseFloat/parseInt work regardless of input shape.
  searchParams: Record<string, string | string[] | undefined>;
}

function firstValue(param: string | string[] | undefined): string | undefined {
  if (Array.isArray(param)) return param[0];
  return param;
}

export default function ConfirmationPage({ searchParams }: ConfirmationPageProps) {
  const orderId = firstValue(searchParams.order_id) ?? 'ORD-UNKNOWN';
  const orderTotal = parseFloat(firstValue(searchParams.total) ?? '0');
  const itemCount = parseInt(firstValue(searchParams.items) ?? '0', 10);

  // Secret + card IDs come from env at render time. If either is missing
  // (local dev, preview without the Vercel env wired up), mintConfirmationEmbedUrls
  // returns null and Tier3Embeds renders a visible fallback pointing visitors
  // at the live Metabase instance — never a silent empty state.
  const embedUrls = mintConfirmationEmbedUrls({
    secret: process.env.MB_EMBEDDING_SECRET_KEY,
    configRaw: process.env.METABASE_EMBED_CONFIG,
  });

  return (
    <>
      <OrderConfirmation orderId={orderId} orderTotal={orderTotal} itemCount={itemCount} />
      <Tier3Embeds urls={embedUrls} orderTotal={orderTotal} />
    </>
  );
}
