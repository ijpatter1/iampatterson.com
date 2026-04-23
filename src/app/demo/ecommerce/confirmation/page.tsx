import {
  ConfirmationCloser,
  OrderConfirmation,
} from '@/components/demo/ecommerce/order-confirmation';
import { DashboardPayoff } from '@/components/demo/ecommerce/dashboard-payoff';
import { ToastProvider } from '@/components/demo/reveal/toast-provider';
import { mintConfirmationDashboardUrl, readConfirmationDashboardId } from '@/lib/metabase/embed';

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
 * header + Pattern 3 inline diagnostic pipeline-journey list) plus the
 * Pattern 3 `DashboardPayoff` which embeds the full Metabase dashboard
 * via a single server-signed JWT (replaces 9B's three question-level
 * iframe embeds). Numeric query params are sanitized at this boundary
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

  // If either env is missing (local dev / preview without Vercel env wired),
  // mintConfirmationDashboardUrl returns null and DashboardPayoff renders
  // a visible fallback linking to the IAP-gated dashboard. No silent empty.
  const configRaw = process.env.METABASE_EMBED_CONFIG;
  const dashboardUrl = mintConfirmationDashboardUrl({
    secret: process.env.MB_EMBEDDING_SECRET_KEY,
    configRaw,
  });
  // Thread the canonical dashboardId (from the same env config) into
  // DashboardPayoff so its mobile deep-link + fallback text track the env
  // contract rather than hardcoding `2`. Undefined falls back to the
  // pinned default in the component.
  const dashboardId = readConfirmationDashboardId(configRaw) ?? undefined;

  // UAT r2 item 20, dashboard must land above the "Dashboards are not
  // the payoff" closing beat. Order is: editorial head + pipeline
  // journey → DashboardPayoff embed → closing beat + back nav. Pre-r2
  // the closing beat was baked into `OrderConfirmation`, which put it
  // above the dashboard and fought the payoff framing.
  return (
    <ToastProvider>
      <main className="mx-auto flex max-w-[1200px] flex-col gap-12 px-6 py-12">
        <OrderConfirmation orderId={orderId} orderTotal={orderTotal} itemCount={itemCount} />
        <DashboardPayoff dashboardUrl={dashboardUrl} dashboardId={dashboardId} />
        <ConfirmationCloser />
      </main>
    </ToastProvider>
  );
}
