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

function sanitizeNumber(raw: string | undefined, fallback: number, parse: (s: string) => number) {
  if (!raw) return fallback;
  const parsed = parse(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export default function ConfirmationPage({ searchParams }: ConfirmationPageProps) {
  const orderId = firstValue(searchParams.order_id) ?? 'ORD-UNKNOWN';
  // Sanitize numeric params at the page boundary. parseFloat('abc') is NaN,
  // and malicious URLs can supply Infinity — both render as "$NaN" / "$Infinity"
  // in the receipt without this guard. Downstream components can trust they
  // get finite non-negative numbers.
  const orderTotal = sanitizeNumber(firstValue(searchParams.total), 0, parseFloat);
  const itemCount = sanitizeNumber(firstValue(searchParams.items), 0, (s) => parseInt(s, 10));

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
