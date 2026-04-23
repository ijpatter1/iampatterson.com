import { METABASE_BASE_URL, mintConfirmationDashboardUrl } from './embed';

/**
 * Organic Metabase dashboard keep-warm (Phase 9F D9 → 10a D2).
 *
 * Invoked server-side from the homepage (`/`) and ecommerce demo entry
 * (`/demo/ecommerce`) Server Components via `after()` from `next/server`,
 * which on Vercel defers the 5–15s BigQuery card fan-out until after the
 * response is flushed but before the Lambda freezes (closes the 9F D9
 * Pass-2 Tech Important fire-and-forget durability gap). Fires a
 * lightweight warmup sequence against `bi.iampatterson.com` so Metabase's
 * card cache + BigQuery's 24h query cache are primed before a visitor
 * reaches `/demo/ecommerce/confirmation`.
 *
 * Warmup sequence:
 *   1. GET `/embed/dashboard/:jwt`        (warms Metabase session + JWT validation)
 *   2. GET `/api/embed/dashboard/:jwt`    (warms dashboard metadata lookup)
 *   3. parse `dashcards` (modern Metabase, v0.47+) with fallback to
 *      `ordered_cards` (pre-0.47 legacy) from (2), fan-out:
 *      GET `/api/embed/dashboard/:jwt/dashcard/:dashcard-id/card/:card-id`
 *      (executes the card's BigQuery query, populating Metabase's card
 *       cache and BigQuery's 24h result cache for subsequent real visitors).
 *      The fallback is defensive; the project runs Metabase v0.59.6 which
 *      emits `dashcards`, and `infrastructure/metabase/dashboards/apply.sh`
 *      writes dashboards using the same modern field.
 *
 * Module-scope 30-min debounce prevents N concurrent visitors from
 * N-multiplying warmup fetches. Debounce resets on Vercel function
 * cold-start (one fresh warmup per cold Next.js instance, acceptable).
 *
 * Never rethrows: upstream failures surface via `console.warn` for
 * observability but are swallowed so `after()` callbacks stay non-fatal.
 */

export const DEBOUNCE_MS = 30 * 60 * 1000; // 30 minutes

export interface KeepWarmDeps {
  /** Returns the signed `/embed/dashboard/:jwt` URL, or null if env is missing. */
  mintUrl?: () => string | null;
  /** Injectable for tests. */
  fetchFn?: typeof fetch;
  /** Injectable clock for tests. */
  now?: () => number;
}

// `-Infinity` so the very first call always passes the debounce gate
// regardless of what clock `now` returns in tests or production.
let lastFireAt = -Infinity;

/**
 * Returns a Promise that resolves when the warmup chain completes (or
 * immediately if debounced / misconfigured). Callers invoke this via
 * `after()` from `next/server` so Vercel defers the 5–15s BigQuery
 * card fan-out until after the response is flushed but before the
 * Lambda freezes.
 */
export async function warmMetabaseDashboard(deps: KeepWarmDeps = {}): Promise<void> {
  const now = (deps.now ?? Date.now)();
  if (now - lastFireAt < DEBOUNCE_MS) return;
  lastFireAt = now;

  const mintUrl = deps.mintUrl ?? defaultMintUrl;
  const url = mintUrl();
  if (!url) return;

  const token = extractToken(url);
  if (!token) return;

  const fetchFn = deps.fetchFn ?? fetch;
  const metadataUrl = `${METABASE_BASE_URL}/api/embed/dashboard/${token}`;

  // HTML + metadata in parallel. Both are cheap. The HTML fetch warms
  // Metabase's embed-renderer path; the metadata fetch gives us the
  // dashcard list so we can fan out to the expensive card queries.
  const [htmlResult, metadataResult] = await Promise.allSettled([
    fetchFn(url),
    fetchFn(metadataUrl).then((r) => r.json()),
  ]);

  // Observability: a single warn on the first upstream failure so Vercel
  // logs surface warmup breakage (e.g. LB regression on the non-IAP
  // backend, expired secret, Metabase unreachable). Silent otherwise to
  // keep warmup non-intrusive when everything is healthy.
  if (htmlResult.status === 'rejected' || metadataResult.status === 'rejected') {
    const reason = (
      htmlResult.status === 'rejected'
        ? (htmlResult as PromiseRejectedResult).reason
        : (metadataResult as PromiseRejectedResult).reason
    ) as Error | unknown;
    console.warn(
      '[metabase/keep-warm] upstream fetch failed:',
      (reason as Error)?.message ?? reason,
    );
  }

  if (metadataResult.status !== 'fulfilled') return;

  const dashcards = parseDashcards(metadataResult.value);
  if (dashcards.length === 0) return;

  // Card fan-out in parallel. Each hits Metabase's card-result endpoint,
  // which executes the card's BigQuery query on cold path. Populates
  // Metabase's card cache (24h TTL via admin config) and BigQuery's
  // 24h query result cache for subsequent real visitors.
  const cardResults = await Promise.allSettled(
    dashcards.map((c) =>
      fetchFn(
        `${METABASE_BASE_URL}/api/embed/dashboard/${token}/dashcard/${c.id}/card/${c.cardId}`,
      ),
    ),
  );

  // If every card request failed (e.g. IAP regressed onto the
  // `/api/embed/.../dashcard/...` path), the embed/metadata warn above
  // may not fire, but the fan-out is the *expensive* layer that
  // actually populates BQ's cache. Surface an explicit warn so the
  // ship-gate probe failure isn't the first signal.
  const allFailed = cardResults.length > 0 && cardResults.every((r) => r.status === 'rejected');
  if (allFailed) {
    const firstReason = (cardResults[0] as PromiseRejectedResult).reason as Error | unknown;
    console.warn(
      '[metabase/keep-warm] all card fan-out fetches failed:',
      (firstReason as Error)?.message ?? firstReason,
    );
  }
}

/** Reset the module-scope debounce. Exported only for tests. */
export function _resetDebounceForTests(): void {
  lastFireAt = -Infinity;
}

function extractToken(embedUrl: string): string | null {
  const match = embedUrl.match(/\/embed\/dashboard\/([^/#?]+)/);
  return match?.[1] ?? null;
}

function defaultMintUrl(): string | null {
  return mintConfirmationDashboardUrl({
    secret: process.env.MB_EMBEDDING_SECRET_KEY,
    configRaw: process.env.METABASE_EMBED_CONFIG,
  });
}

interface Dashcard {
  id: number;
  cardId: number;
}

function parseDashcards(metadata: unknown): Dashcard[] {
  if (typeof metadata !== 'object' || metadata === null) return [];
  const m = metadata as Record<string, unknown>;
  // Modern Metabase (v0.47+) emits `dashcards`; pre-0.47 used
  // `ordered_cards`. Accept either so the warmup tolerates a
  // cross-version upgrade without silently no-op'ing the fan-out.
  const raw = Array.isArray(m.dashcards)
    ? m.dashcards
    : Array.isArray(m.ordered_cards)
      ? m.ordered_cards
      : null;
  if (!raw) return [];
  const out: Dashcard[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.id !== 'number') continue;
    const card = e.card;
    if (typeof card !== 'object' || card === null) continue;
    const cid = (card as Record<string, unknown>).id;
    if (typeof cid !== 'number') continue;
    out.push({ id: e.id, cardId: cid });
  }
  return out;
}
