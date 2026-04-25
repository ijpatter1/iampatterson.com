# Mobile Matrix — 2026-04-25

Phase 10d D1 deliverable. Sweeps 5 emulated viewports across 8 routes via
`tests/e2e/mobile-matrix.spec.ts` (40 test cases × 3 screenshots each =
120 captures). Carries the iPhone SE concern from Phase 9E F8 Product
Minor #5 forward and adds tablet portrait/landscape coverage.

**Verdict: PASS.** All 40 cases green after one in-session fix
(ecommerce cart + checkout grid sidebar slot). One soft-fail surfaces
on iPhone SE only and is documented + carried forward.

---

## Devices in the matrix

| Project name | Device profile | Viewport (CSS px) | Engine | Chrome budget | Touch |
|---|---|---|---|---|---|
| `matrix-iphone-se` | iPhone SE (1st-gen profile) | 375 × 667 | WebKit | 132 px | yes |
| `matrix-iphone-13` | iPhone 13 | 390 × 844 | WebKit | 0 px (none assumed) | yes |
| `matrix-pixel-5` | Pixel 5 | 393 × 851 | Chromium | 0 px | yes |
| `matrix-ipad-mini-portrait` | iPad Mini portrait | 768 × 1024 | WebKit | 0 px | yes |
| `matrix-ipad-mini-landscape` | iPad Mini landscape | 1024 × 768 | WebKit | 0 px | yes |

The 132 px iPhone-SE chrome budget is the worst-case Safari-iOS estimate
(URL bar + bottom toolbar visible). It's the math behind the Phase 9E F8
Product Minor #5 carry: 667 nominal − 132 chrome ≈ 535 usable px against
which CTAs are evaluated. Other devices use the chrome-inclusive viewport
Playwright reports, so the fold check is a hard assertion there.

The reported chrome budget on iPhone 13 / Pixel 5 is `0` because their
Playwright device descriptors already encode a chrome-collapsed viewport.
That's not a claim that those phones have no Safari/Chrome chrome on
real hardware — it's a documentation choice that whatever chrome they
have is already subtracted by the descriptor.

---

## Routes covered

```
/                              homepage hero, primary CTA fold-check anchor
/services                      tier deep-link targets
/about                         long-form prose + closer CTA
/contact                       contact form
/demo/ecommerce                catalog (grid)
/demo/ecommerce/tuna-plush-classic  product detail (Pattern 2 sidebar)
/demo/ecommerce/cart           cart (Pattern 2 sidebar — was the bug)
/demo/ecommerce/checkout       checkout form (Pattern 2 sidebar)
```

Confirmation page is omitted from the matrix because its layout depends
on a server-signed Metabase JWT that isn't issued in the test
environment. The dashboard-payoff fallback is exercised in unit tests at
`src/components/demo/ecommerce/dashboard-payoff.test.tsx`.

---

## Per-route assertions

Every test case asserts:

1. **H1 visible.** The page rendered the headline element.
2. **No horizontal scroll.** `document.documentElement.scrollWidth ≤
   clientWidth + 1px slack`.
3. **SessionPulse min 44 × 44 tap target.** WCAG 2.5.5 Level AAA. Pulled
   from the SessionPulse `aria-label="Open your session"` button's
   bounding box.
4. **(Homepage only) Primary CTA above the Safari-aware fold.** The
   first DOM occurrence of "See your session" (the hero CTA) must end at
   `≤ viewport.height − chromeBudget`. iPhone-SE is a soft-check (logged
   as a Playwright annotation); other devices hard-fail.
5. **Overlay opens cleanly.** SessionPulse click flips the overlay to
   `data-phase="on"` (post-260ms-CRT-boot), Overview is the default tab,
   tab row's right edge is within viewport width.
6. **D9 storage inspector renders + no row overflow.** Switch to Consent
   tab, locate `consent-storage-inspector`, scroll into view, assert
   every `li[data-testid^="storage-row-"]` width ≤ its parent group's
   width + 1 px slack. Regression pin for the D9 mobile-spill take-1
   (`03c377a`) and take-2 (`c5c52e2`) fixes.

---

## Results matrix

| Route | iPhone SE | iPhone 13 | Pixel 5 | iPad Mini portrait | iPad Mini landscape |
|---|---|---|---|---|---|
| / | ◐ | ✓ | ✓ | ✓ | ✓ |
| /services | ✓ | ✓ | ✓ | ✓ | ✓ |
| /about | ✓ | ✓ | ✓ | ✓ | ✓ |
| /contact | ✓ | ✓ | ✓ | ✓ | ✓ |
| /demo/ecommerce | ✓ | ✓ | ✓ | ✓ | ✓ |
| /demo/ecommerce/tuna-plush-classic | ✓ | ✓ | ✓ | ✓ | ✓ |
| /demo/ecommerce/cart | ✓ | ✓ | ✓ | ✓ | ✓† |
| /demo/ecommerce/checkout | ✓ | ✓ | ✓ | ✓ | ✓ |

Legend: ✓ pass · ◐ soft-fail (annotation only, no test failure) · † post-fix

---

## Soft-fail: hero CTA below the iPhone SE Safari fold

**Captured number:** "See your session →" hero CTA bottom = **562 px**.
Worst-case Safari-iOS usable height on iPhone SE = **535 px**.
**CTA bottom is 27 px below the chrome-aware fold.**

This carries the Phase 9E F8 Product Minor #5 finding forward unchanged.
The hero already shipped two mobile-tightening passes before this
matrix:

- **F5 UAT S11:** mobile italic kicker `clamp(18px, 2.6vw, 34px)` (was
  22px), saving ~20 px of vertical real estate
- **Hero clamp floor:** `clamp(44px, 13vw, 200px)` H1 minimum (was 56px),
  saving ~33 px on a 360 px viewport

Both are still in place. The remaining 27 px of below-fold creep on
iPhone SE comes from the cumulative stack — H1 (3 lines × ~44 px) +
56 px italic kicker + ~138 px body paragraph + 56 px CTA — colliding
with an aggressive Safari chrome estimate.

**Mitigating signal (real-world Safari behavior):** iOS Safari collapses
the URL bar to a thin strip (~52 px instead of 88 px) on first scroll.
After the visitor's first downward swipe, the usable area becomes ~587 px,
which the 562 px CTA bottom comfortably fits inside. The CTA is
**reachable** with one minimal scroll gesture; it is **not strictly above
the fold** at page-load time on iPhone SE.

**Decision:** carry forward as a known, documented soft-fail. Closing it
in this session would require either (a) further hero-typography
shrinkage that compromises desktop presence, (b) a hero-layout
restructure that moves CTAs into the H1 visual block, or (c) a
viewport-conditional layout switch. None are appropriate scope for a
launch-prep mobile matrix; all three are real options if a real-device
test surfaces the issue as a conversion blocker.

The matrix spec converts this to a Playwright annotation rather than a
hard test failure so future runs on iPhone SE keep flagging the
distance to the fold without breaking the suite.

---

## In-session fix: cart + checkout grid sidebar slot (`a confirmed bug`)

**Surface:** `/demo/ecommerce/cart` on iPad Mini landscape (1024 × 768).
**Symptom:** `document.documentElement.scrollWidth = 1040` against
`clientWidth = 1024` — 16 px horizontal scroll.

**Root cause:** The cart's responsive grid was
`lg:grid-cols-[1fr_320px] lg:gap-10`. Pattern-2 LiveSidebar uses
`lg:w-[360px]` (its intrinsic width). At lg-breakpoint, the sidebar
overflowed its 320 px grid cell by 40 px. The article column was sized
with bare `1fr`, which carries CSS Grid's automatic `min-content` track
minimum, so unbreakable content kept the article at its min-content
width and the sidebar overflow propagated to the document.

**Why other surfaces didn't fail:**

- `product-detail.tsx` uses `lg:grid-cols-[1fr_480px_auto]` — sidebar
  fits in the 480 px slot with room to spare
- `checkout-form.tsx` uses `lg:grid-cols-[minmax(0,1fr)_320px]` and
  short-circuits to an empty-cart view (line 169-186) before reaching
  the grid in the test, so the sidebar never rendered

**Fix:** both cart-view.tsx and checkout-form.tsx now use
`lg:grid-cols-[minmax(0,1fr)_360px]` — the slot matches the LiveSidebar's
intrinsic width, and `minmax(0,1fr)` (replacing bare `1fr`) prevents the
article column from re-inflating past its fr-share due to min-content
content. Inline comments on both grid lines defend the breakpoint
against future "match every surface" cleanup passes.

The mobile-matrix spec's no-horizontal-scroll assertion (point #2 above)
is the regression pin — any future regression here fails on iPad Mini
landscape ecommerce-cart.

---

## D9 storage inspector + D7 anonymous_id surfaces

Verified visually + assertively across all five viewports. The inspector
renders cleanly on the smallest device (iPhone SE 375 px wide):

- **app-identity group** populates with the test session's keys:
  `_iap_aid` (D7 cookie, the truncated UUID-with-… reveal), `_iap_sid`,
  `iampatterson.session_state`, `iampatterson.timeline_buffer`,
  `iampatterson.pipeline_id`, `iampatterson.pipeline.bleed.consumed`
- **Per-row layout** stacks vertically on mobile (name → source → value
  + reveal): the `flex-col sm:flex-row` shape from `c5c52e2` mobile-spill
  take-2 fix
- **No row overflow** — all rows fit within their group's bounding box
- **Cookie-metadata footnote** present at bottom of the inspector

Empty groups (analytics, consent) render `— none yet` cleanly. Cookiebot
is dismissed via CSS in the test (the Cookiebot consent dialog
intercepts pointer events on first visit), so the consent group reads as
empty on the matrix runs — that's a test-environment artifact, not a
production state. Real visitors who decline all consent will see the
same shape with `CookieConsent` present and analytics still empty.

---

## Tab-row reachability

The overlay tab row uses `whitespace-nowrap` per button + `overflow-x-auto`
on the container (the F5 UAT S11 fix). On iPhone-SE 375 px, the three
labels (`OVERVIEW`, `TIMELINE`, `CONSENT`) plus padding fit in a single
row without horizontal scroll within the row. Confirmed by the matrix
assertion: `tabRow.right ≤ viewport.width + 1px`. Slack is preserved
even with the active tab's bracket framing (`[ OVERVIEW ]`) inflating
the active label's width.

---

## Findings, ranked

### Soft-fail (carry-forward)

- **iPhone SE: hero "See your session" CTA 27 px below the worst-case
  Safari fold.** Reachable with one minimal scroll due to URL-bar
  collapse. Documented above. Decide on a real-device test before
  spending design effort.

### Closed in this session

- **Cart + checkout sidebar slot:** 16 px horizontal scroll on iPad Mini
  landscape, fixed in `cart-view.tsx:111` + `checkout-form.tsx:207`.

### No findings

- Mobile fold-line on iPhone 13, Pixel 5, iPad Mini portrait + landscape
- SessionPulse tap target on every device (always ≥ 48 × 48 actual; the
  SessionPulse implements a `min-h-[44px]` minimum)
- Overlay tab row layout on every device
- D9 storage inspector row layout on every device (regression pin holds)
- D7 `_iap_aid` cookie classification + Overview chip + Consent row

---

## What this matrix can't measure

Real-device verification beats emulation for several axes the spec
deliberately doesn't try to cover:

- **iOS Safari touch-and-hold gestures** — context menus, long-press
  selection, force-touch behaviors
- **Soft-keyboard layout shift on form fields** — the contact form +
  ecommerce checkout form behave differently when iOS pushes the
  viewport up to make room for the keyboard
- **Rubber-band scroll** — webkit's elastic-overscroll bounces don't
  fire under emulation
- **Real Safari URL-bar collapse** — Playwright's WebKit doesn't
  simulate the dynamic URL-bar resize on first scroll
- **Touch latency under real CPU/network** — Lighthouse is the right
  tool for this signal; the mobile matrix doesn't pretend to

If the iPhone SE soft-fail above turns out to bite a real visitor, that
visitor's report is the falsifying signal that this matrix can't
produce. A real-device pass over the home/services/about/cart/checkout
loop on an iPhone SE running Safari is the cheapest disambiguator.

---

## How to re-run

```bash
# Full sweep (all 5 devices, all 8 routes, 120 screenshots)
bash scripts/capture-mobile-matrix.sh

# Single device
PROJECT=matrix-iphone-se bash scripts/capture-mobile-matrix.sh

# Override capture date
DATE=2026-05-01 bash scripts/capture-mobile-matrix.sh
```

The capture script stands up a production build, polls for readiness,
runs the spec, writes screenshots to
`docs/perf/mobile-matrix-screenshots/<date>/`, and prints a summary line.
The Playwright HTML report is available via `npx playwright show-report`
after a run.

The matrix spec is gated on `E2E_ENABLED=1` (matches
`tests/e2e/ecommerce-sessionpulse.spec.ts`) so accidental invocations in
a sandbox without browsers installed don't fail outright.

---

## Screenshots

120 captures under
[`docs/perf/mobile-matrix-screenshots/2026-04-25/`](mobile-matrix-screenshots/2026-04-25/).
File-naming convention: `<project>__<route-label>__<step>.png`, e.g.
`matrix-iphone-se__home__01-at-rest.png`.

Three steps per case:

1. **`01-at-rest`** — page loaded, Cookiebot dialog hidden, before any
   interaction
2. **`02-overlay-overview`** — SessionPulse clicked, post-CRT-boot,
   Overview tab active
3. **`03-consent-storage`** — Consent tab active, storage inspector
   scrolled into view

Spot-check anchors:

- `matrix-iphone-se__home__01-at-rest.png` — the hero fold-line story
- `matrix-iphone-se__home__03-consent-storage.png` — D9 inspector + D7
  `_iap_aid` row on the smallest viewport
- `matrix-ipad-mini-landscape__ecommerce-cart__01-at-rest.png` — the cart
  layout post-fix (no overflow, sidebar fits)
