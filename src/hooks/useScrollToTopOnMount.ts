import { useLayoutEffect } from 'react';

/**
 * Snap `window` scroll to (0, 0) on component mount, bypassing the
 * global `html { scroll-behavior: smooth }` rule (`src/styles/globals.css`).
 *
 * **Why it exists:** Next.js App Router's default post-navigation
 * behaviour is to call `window.scrollTo(0, 0)` after the new route
 * commits. With `scroll-behavior: smooth` set on `html`, that call
 * animates from the visitor's previous scroll position. The new page
 * paints mid-animation so the visitor lands "halfway down" —
 * originally reported on /demo/ecommerce in UAT r3 B11.
 *
 * **Why a `useLayoutEffect`:** runs after DOM commit but before
 * browser paint, so the scroll snap happens invisibly. A regular
 * `useEffect` would leave a single frame of pre-snap content
 * paintable, producing a brief jump.
 *
 * **The `'instant'` literal:** the CSSOM-View spec's third
 * `ScrollBehavior` value (Chrome 102+ / Firefox 109+ / Safari 16.4+);
 * it overrides `scroll-behavior: smooth` for a single call. The
 * TypeScript DOM lib (`lib.dom.d.ts`) includes the literal as of
 * TS 5.x so no cast is needed.
 *
 * **Tradeoff:** this overrides browser back-nav scroll restoration
 * for routes that use it. A visitor who scrolls mid-page, navigates
 * into a sub-route, and hits back lands at top instead of at their
 * prior scroll position. Acceptable for demo routes where the
 * editorial top-down narrative outweighs scroll preservation;
 * consider before adding to long-form content surfaces.
 *
 * Pinned at: `tests/unit/hooks/useScrollToTopOnMount.test.tsx`.
 */
export function useScrollToTopOnMount() {
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);
}
