/**
 * Cookiebot CMP loader.
 *
 * Rendered as a plain `<script>` element inside the root layout's `<head>`
 * rather than via `next/script`. The previous `next/script` +
 * `strategy="beforeInteractive"` shape produced a React-19/Next-16
 * hydration mismatch in dev: server emitted a real `<script src="…" type=
 * "text/javascript" charset="UTF-8">` tag, client hydration replaced it
 * with the `(self.__next_s = …).push([url])` deferred-loader pattern, and
 * React's pending-hydration check flagged the difference. `beforeInteractive`
 * in the App Router is a documented Next.js anti-pattern (the docs scope
 * it to `pages/_document.js`); the App Router has tolerated it with
 * caveats and Next 16 surfaces those caveats as the warning.
 *
 * A plain `<script src>` tag in `<head>` is functionally equivalent —
 * the browser parses + executes it before React hydrates, which is the
 * whole point of `beforeInteractive` for a CMP that needs to gate consent
 * before any tags fire. No deferred-loader machinery, no hydration diff.
 */
export function CookiebotScript() {
  const cbid = process.env.NEXT_PUBLIC_COOKIEBOT_ID;
  if (!cbid) return null;

  // `defer` preserves document-order execution (Cookiebot's
  // `data-blockingmode="auto"` needs to load before the `gtm-script`
  // bootstrap can fire) AND runs before DOMContentLoaded — i.e. before
  // React hydration begins — which matches the original
  // `strategy="beforeInteractive"` ordering contract without the parse-
  // blocking cost of a sync script.
  return (
    <script
      id="Cookiebot"
      src="https://consent.cookiebot.com/uc.js"
      data-cbid={cbid}
      data-blockingmode="auto"
      type="text/javascript"
      defer
    />
  );
}
