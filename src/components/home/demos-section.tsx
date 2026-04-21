'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { trackClickCta } from '@/lib/events/track';
import { randomUtmSeedParams } from '@/lib/demo/reveal/campaign-taxonomy';

// Phase 9E D6: the three-card horizontal-scroll track is replaced by a
// single full-width section dedicated to the ecommerce demo. Subscription
// and lead gen demos were removed from the site in D7; the one-coherent-
// demo framing is the point — see UX_PIVOT_SPEC §1 ("one world in two
// states") and §3.7 for the Demos-section rebuild target.

// When a visitor is 301-redirected from `/demo/subscription/*` or
// `/demo/leadgen/*` (wired in `next.config.mjs`), the `rebuild` query
// param surfaces a one-line honesty banner. The label mapping is a
// closed allowlist so unknown values (URL tampering, future redirect
// sources) don't produce misleading copy.
//
// Built via `Object.create(null)` so the lookup doesn't fall through
// to `Object.prototype` for keys like `toString`, `__proto__`, or
// `hasOwnProperty`. A URL like `?rebuild=toString` against a plain
// object literal would return a Function reference, which is truthy
// and non-nullish, and rendering it as a React child would crash the
// homepage with "Objects are not valid as a React child."
const REBUILD_LABELS: Record<string, string> = Object.assign(Object.create(null) as object, {
  subscription: 'subscription',
  leadgen: 'lead gen',
}) as Record<string, string>;

/**
 * `useSearchParams()` forces a client-side rendering bailout on the
 * page it's called from. Isolating the read into this leaf and
 * wrapping it in <Suspense> means the outer DemosSection can still
 * be statically generated; only this leaf defers to runtime. The
 * Suspense fallback is null — an absent banner during SSG is the
 * correct behavior since the visitor's `?rebuild` is only observable
 * post-hydration anyway.
 *
 * Dismissal persists to sessionStorage keyed by the rebuild label so a
 * visitor who dismisses and navigates away doesn't see the banner
 * re-appear on return within the same tab. The key includes the label
 * so a visitor who lands from subscription and dismisses, then later
 * lands from leadgen, still sees the leadgen banner — each removed
 * demo's honesty note is an independent dismissal.
 */
const REBUILD_BANNER_DISMISSED_STORAGE_PREFIX = 'iampatterson.rebuild_banner_dismissed.';

function isRebuildBannerDismissed(label: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(REBUILD_BANNER_DISMISSED_STORAGE_PREFIX + label) === '1';
  } catch {
    return false;
  }
}

function markRebuildBannerDismissed(label: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(REBUILD_BANNER_DISMISSED_STORAGE_PREFIX + label, '1');
  } catch {
    // Strict-privacy sessionStorage can throw — fall back to
    // component-local dismissal only (banner re-appears on
    // navigation, which is the pre-fix behavior).
  }
}

function RebuildBanner() {
  const searchParams = useSearchParams();
  const rebuildParam = searchParams?.get('rebuild') ?? null;
  const rebuildLabel =
    rebuildParam && Object.hasOwn(REBUILD_LABELS, rebuildParam)
      ? REBUILD_LABELS[rebuildParam]
      : null;

  // Two-pass SSR-safe dismissal state (F4 UAT fix). Pre-F4 the initializer
  // called `isRebuildBannerDismissed()` synchronously, which reads
  // sessionStorage — that read returns different values between server
  // (no window, falls through to false) and client hydration (real
  // storage), producing a hydration mismatch inside the Suspense boundary
  // on deep-link redirects (UAT S5.3: /demo/subscription/account/settings
  // → redirect → "There was an error while hydrating this Suspense
  // boundary. Switched to client rendering.").
  //
  // Tri-state encodes the pre-resolution period: null = "haven't read
  // sessionStorage yet, don't render anything"; boolean = resolved. The
  // banner stays hidden until the effect runs so first paint matches
  // server output (null) regardless of whether the storage key exists.
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!rebuildLabel) {
      setDismissed(false);
      return;
    }
    setDismissed(isRebuildBannerDismissed(rebuildLabel));
  }, [rebuildLabel]);

  if (rebuildLabel === null || dismissed === null || dismissed === true) return null;

  const dismiss = () => {
    markRebuildBannerDismissed(rebuildLabel);
    setDismissed(true);
  };

  return (
    <div
      data-testid="rebuild-banner"
      role="status"
      className="mb-10 flex items-start justify-between gap-4 border border-rule-soft bg-paper-alt px-5 py-4 font-mono text-[11px] uppercase tracking-widest text-ink-2"
    >
      <span>{rebuildLabel} demo · returning soon</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="flex-shrink-0 text-ink-3 transition-colors hover:text-ink"
      >
        ×
      </button>
    </div>
  );
}

export function DemosSection() {
  const router = useRouter();

  // UAT r2 item 6 — stamp the "Enter the demo" deep-link with a random
  // seed utm_campaign + matching source/medium on every click. The
  // listing page already runs the URL-provided campaign through
  // `classifyUtm` and surfaces the classified source / medium / bucket
  // in the listing-hero UTM panel; stamping random seeds at click time
  // means every enter-the-demo visit shows a different classification,
  // which demonstrates the pipeline step honestly.
  //
  // Middle-click / ctrl-click (open-in-new-tab) bypasses onClick in most
  // browsers, so the `href="/demo/ecommerce"` is the fallback — visitors
  // who open in a new tab land on the plain URL and see the default seed
  // with the "example · no utm in your url" honesty badge. That's the
  // correct behavior: the randomiser only fires for an intentional
  // primary-button click.
  const handleEnterDemo = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    trackClickCta('Enter the ecommerce demo', 'demo_card_ecommerce');
    const params = randomUtmSeedParams();
    const qs = new URLSearchParams(params).toString();
    router.push(`/demo/ecommerce?${qs}`);
  };

  return (
    <section
      id="demos"
      data-testid="demos-section"
      className="scroll-mt-24 border-t border-rule-soft bg-paper py-20 md:py-28"
    >
      <div className="mx-auto max-w-content px-5 md:px-10">
        <Suspense fallback={null}>
          <RebuildBanner />
        </Suspense>

        {/* F5 UAT S11 — hide the second-line tagline on mobile. The
            `uppercase tracking-widest` treatment + 32ch max-width pushed
            the eyebrow block to 7–8 lines on 360px. Desktop keeps the
            two-part editorial framing. */}
        <div className="mb-10 flex flex-wrap items-end justify-between gap-5 border-b border-rule-soft pb-5">
          <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3">
            Demo · Ecommerce · Tiers 2 + 3
          </span>
          <p className="hidden max-w-[32ch] font-mono text-[11px] uppercase tracking-widest text-ink-3 md:block">
            One demo. The measurement is on screen as it happens.
          </p>
        </div>

        <div className="grid gap-10 md:grid-cols-[1.3fr_1fr] md:gap-16">
          <div>
            <h2
              className="font-display font-normal text-ink"
              style={{
                fontSize: 'clamp(40px, 6vw, 80px)',
                lineHeight: '1',
                letterSpacing: '-0.02em',
                maxWidth: '14ch',
              }}
            >
              Shop a little. Watch the events land in{' '}
              <em className="text-accent-current">BigQuery</em>.
            </h2>
            <p className="mt-8 max-w-[42ch] text-[17px] leading-[1.55] text-ink-2">
              Browse, add a plush to cart, check out with a test card. Every interaction fires a
              real GTM event through server-side GTM into BigQuery. The cart and checkout pages show
              the staging-layer transforms and data-quality checks running against your own session.
            </p>
            <p className="mt-4 max-w-[42ch] text-[17px] leading-[1.55] text-ink-2">
              The confirmation page loads a Metabase dashboard built from the events you just fired.
            </p>
            <div className="mt-10">
              <Link
                href="/demo/ecommerce"
                onClick={handleEnterDemo}
                className="group inline-flex items-center gap-3 border border-ink bg-ink px-6 py-4 font-mono text-[11px] uppercase tracking-widest text-paper transition-all hover:border-accent-current hover:bg-accent-current"
              >
                Enter the demo
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </div>
          </div>

          {/* Preview column — desktop only (UAT r2 item 5).
              Pre-r2 this was a terminal-styled sample-event pre-block.
              Two problems the user flagged: the box read as pointless
              filler ("preview sample event"), and stacked on mobile it
              pushed the section too long. The mobile side is solved by
              hiding this column entirely below md; the desktop side is
              solved by swapping the pre-block for a palette-tile hero
              composed from the Tuna Plush Classic palette (cream /
              warm-brown / near-black), mirroring the product-detail
              hero treatment so the homepage preview matches what the
              visitor will see when they enter the demo.

              No real product photography exists yet — when it does, the
              palette-tile composition becomes the one place to swap in
              a photography-on-cream asset. */}
          <div
            data-demos-section-hero=""
            className="relative hidden aspect-square w-full overflow-hidden rounded-lg md:block"
            style={{ background: '#E8D8BD' }}
            aria-hidden="true"
          >
            <div
              className="absolute inset-x-16 top-1/2 h-1/2 -translate-y-1/2 rounded"
              style={{ background: '#8A6A4A' }}
            />
            <div
              className="absolute right-10 top-10 h-16 w-16 rounded-full"
              style={{ background: '#3B2A1E' }}
            />
            <div className="absolute bottom-5 left-5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/70">
              Product · Tuna Plush · Classic · 12in
            </div>
          </div>
        </div>

        {/* F8 close-out Minor: the pre-F8 "Subscription and lead gen
            demos · returning soon" tail line sat below the ecommerce
            card with no action. The `RebuildBanner` at the top of this
            section already surfaces the returning-soon message for
            308-redirected traffic from the removed /demo/subscription +
            /demo/leadgen URLs, so the tail line added nothing for a
            direct visitor and read as a dangling footnote. Removed. */}
      </div>
    </section>
  );
}
