import {
  ConfirmationCloser,
  OrderConfirmation,
} from '@/components/demo/ecommerce/order-confirmation';
import { ToastProvider } from '@/components/demo/reveal/toast-provider';

interface ConfirmationPageProps {
  // Next.js App Router types searchParams values as string | string[] | undefined.
  // Duplicate query params (?total=1&total=2) yield string[]; we normalize to the
  // first value below so parseFloat/parseInt work regardless of input shape.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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

/**
 * Phase 9F D9, confirmation page.
 *
 * Server Component renders the order-confirmation surface (editorial
 * header + Pattern 3 inline diagnostic pipeline-journey list) and the
 * closing beat. 17.1 removed the Metabase dashboard embed that sat
 * between them. Numeric query params are sanitized at this boundary
 * so downstream components can trust finite non-negative inputs. The
 * page is wrapped in `ToastProvider` so the `purchase` toast fired by
 * `OrderConfirmation` on mount has a portal to land in.
 *
 * `orderTotal` missing / zero / non-finite renders the generic-but-coherent
 * lead paragraph per the doc spec (closes 9B follow-up #5 zombie-state drift).
 */
export default async function ConfirmationPage(props: ConfirmationPageProps) {
  const searchParams = await props.searchParams;
  const orderId = firstValue(searchParams.order_id) ?? 'ORD-UNKNOWN';
  const orderTotal = sanitizeNumber(firstValue(searchParams.total), 0, parseFloat);
  const itemCount = sanitizeNumber(firstValue(searchParams.items), 0, (s) => parseInt(s, 10));

  return (
    <ToastProvider>
      <main className="mx-auto flex max-w-[1200px] flex-col gap-12 px-6 py-12">
        <OrderConfirmation orderId={orderId} orderTotal={orderTotal} itemCount={itemCount} />
        <ConfirmationCloser />
      </main>
    </ToastProvider>
  );
}
