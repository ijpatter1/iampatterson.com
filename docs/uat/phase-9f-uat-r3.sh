#!/usr/bin/env bash
#
# Phase 9F, UAT Round 3
#
# UAT rounds 1 + 2 closed in session-2026-04-21-003 and session-2026-04-21-004
# respectively (feedback captured in `docs/uat/phase-9f-uat-feedback.md` and
# `phase-9f-uat-feedback-r2.md`, all items resolved). Round 3 is optional,
# focused on verifying the 2026-04-22 → 2026-04-23 session's new work:
#   - Phase 9F D9 ship-gate closure via three-layer Metabase warmup stack
#   - `remove_from_cart` GTM trigger+tag pair (honesty fix, live to container v8)
#   - Metabase URL-map `/app/*` fix (anonymous embed now serves JS bundles)
#   - Keep-warm module observability warns
#   - Compressed sweep over the 12 Phase 9F deliverables at ship-ready state
#
# 8 scenarios: 4 session-specific + 4 ship-readiness sanity checks.
# Scenarios marked [devtools] require operator DevTools action.
# Scenarios marked [prod] require the Vercel deploy to be live
# (some can be substituted with local `npm run dev` but cold-start probe
# and Vercel logs specifically need production).
#
# Usage:
#   bash docs/uat/phase-9f-uat-r3.sh                 # local dev (skips [prod])
#   BASE_URL=https://iampatterson.com \
#     bash docs/uat/phase-9f-uat-r3.sh               # production
#
# Prerequisites:
#   - Dev server running (`npm run dev` on port 3000) OR production URL set
#   - Desktop browser with DevTools (Chromium-family recommended)
#   - Incognito / private browsing capability for the cold-start probe
#   - For [prod] scenarios: Vercel dashboard access for log inspection

set -u

BASE_URL="${BASE_URL:-http://localhost:3000}"
IS_PROD=0
if [[ "$BASE_URL" != *localhost* && "$BASE_URL" != *127.0.0.1* ]]; then
  IS_PROD=1
fi

PASS=0
FAIL=0
SKIP=0
FAILED_SCENARIOS=()
CURRENT_SCENARIO=""

# ────────────────────────────────────────────────────────────────────────
# Helpers

hr() { echo ""; echo "════════════════════════════════════════════════════════════"; echo ""; }

section() {
  hr
  echo "  $1"
  echo ""
}

scenario() {
  CURRENT_SCENARIO="$1"
  hr
  echo "  SCENARIO: $1"
  echo ""
  echo "  Validates: $2"
  echo ""
}

setup() {
  echo "  SETUP:"
  while [ $# -gt 0 ]; do echo "    • $1"; shift; done
  echo ""
  read -p "  Press ENTER when setup is complete (or Ctrl-C to abort)… " _
  echo ""
}

do_step() {
  echo "  STEP: $1"
  echo ""
}

expect() {
  while [ $# -gt 0 ]; do echo "    → $1"; shift; done
  echo ""
}

confirm() {
  local prompt="$1"
  echo ""
  echo "  CHECK: $prompt"
  read -p "  Pass? [Y/n] " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Nn]$ ]]; then
    echo "  ✗ FAIL"
    ((FAIL++))
    FAILED_SCENARIOS+=("$CURRENT_SCENARIO")
  else
    echo "  ✓ PASS"
    ((PASS++))
  fi
  echo ""
}

skip_if_not_prod() {
  if [ "$IS_PROD" -eq 0 ]; then
    echo "  ⊘ SKIP (requires production URL via BASE_URL env var)"
    ((SKIP++))
    return 0
  fi
  return 1
}

# ════════════════════════════════════════════════════════════════════════
# Scenarios

section "PHASE 9F UAT ROUND 3, session-2026-04-22 → 2026-04-23 verification"

# ────────────────────────────────────────────────────────────────────────
scenario "1. Ship-gate: cold-start Metabase embed loads under 10s first paint" \
  "Phase 9F D9 three-layer warmup stack end-to-end"

if skip_if_not_prod; then :; else
  setup \
    "Wait ≥15 minutes since last visit to the site (Metabase goes idle, BQ cache window bounded by 24h TTL)." \
    "Have a stopwatch or use the DevTools Performance tab."

  do_step "Open a fresh incognito window."
  do_step "Navigate to ${BASE_URL}/demo/ecommerce/confirmation?order_id=TEST&total=26.00&items=1"
  expect \
    "Confirmation page head renders immediately (toast + narrative text)" \
    "Metabase iframe appears inside the InlineDiagnostic wrapper within 10 seconds" \
    "Dashboard visualizations render to interactive within 15 seconds"

  confirm "First paint of the Metabase iframe was under 10 seconds"
  confirm "Dashboard fully interactive (all 6 cards rendered) within 15 seconds"
fi

# ────────────────────────────────────────────────────────────────────────
scenario "2. remove_from_cart GTM honesty: event reaches GA4 + BQ" \
  "Commit 12b2461, live-deployed trigger 114 + tag 115 on web container v8"

setup \
  "Open Chrome DevTools → Network tab, filter to 'analytics' or 'google' for GA4 hits." \
  "Open GTM Tag Assistant (chrome extension) if available — easier to verify trigger firing."

do_step "Navigate to ${BASE_URL}/demo/ecommerce and add 2 of any product to cart."
do_step "Navigate to ${BASE_URL}/demo/ecommerce/cart"
do_step "Click the 'remove' link on the line item, OR decrement quantity from 2 → 1 → 0."
expect \
  "A near-cart toast appears reading 'remove_from_cart · <product_id> · ×<qty>' with routing ['GA4', 'BigQuery']" \
  "GTM Tag Assistant (if open) shows 'GA4 - remove_from_cart' tag fired on 'ce - remove_from_cart' trigger" \
  "Network tab shows a POST to https://io.iampatterson.com/... or similar sGTM endpoint with event_name=remove_from_cart"

confirm "Toast rendered correctly with expected routing annotation"
confirm "GA4 tag fired (either visible in Tag Assistant or a POST with event_name=remove_from_cart in Network tab)"

# ────────────────────────────────────────────────────────────────────────
scenario "3. Metabase URL-map /app/* fix: anonymous embed serves JS bundles" \
  "Session 2026-04-22 live URL-map edit; fixes Path D diagnostic from task-2026-04-21-006.md"

if skip_if_not_prod; then :; else
  setup \
    "Sign out of any existing Google / IAP session (or use a fresh incognito window)." \
    "Open DevTools → Network tab, filter to 'bi.iampatterson.com'."

  do_step "Navigate to ${BASE_URL}/demo/ecommerce/confirmation?order_id=TEST&total=26.00&items=1"
  expect \
    "Network tab shows a 200 for /embed/dashboard/<jwt>" \
    "Network tab shows 200 responses (not 302s) for /app/dist/*.js and /app/dist/*.css requests" \
    "No X-Goog-IAP-Generated-Response: true headers on /app/* responses" \
    "Dashboard content renders inside the iframe (not blank white)"

  confirm "All /app/* requests returned 200 (no IAP 302 redirects)"
  confirm "Dashboard rendered visible content, not a blank white iframe"
fi

# ────────────────────────────────────────────────────────────────────────
scenario "4. Keep-warm observability: cold visit should not warn" \
  "src/lib/metabase/keep-warm.ts console.warn pattern"

if skip_if_not_prod; then :; else
  setup \
    "Open Vercel dashboard → Deployments → current deployment → Logs." \
    "Ensure no [metabase/keep-warm] entries in the last 5 minutes."

  do_step "In a fresh incognito tab, navigate to ${BASE_URL}/ (homepage)"
  do_step "Wait 10 seconds for the fire-and-forget chain to complete."
  do_step "Refresh the Vercel logs panel."
  expect \
    "No '[metabase/keep-warm] upstream fetch failed' entries" \
    "No '[metabase/keep-warm] all card fan-out fetches failed' entries"

  confirm "No [metabase/keep-warm] warnings in the logs (upstream is healthy)"
fi

# ────────────────────────────────────────────────────────────────────────
scenario "5. Full demo flow, end-to-end (condensed sweep of D1–D11)" \
  "All 4 pattern primitives + 5 per-page reveals + SessionPulse reachability"

setup \
  "Fresh incognito window." \
  "DevTools → Console cleared."

do_step "Navigate to ${BASE_URL}/demo/ecommerce?utm_source=meta&utm_medium=paid_social&utm_campaign=spring_launch"
expect \
  "Three-toast cascade fires on hydration: session_start → taxonomy_classified → view_item_list" \
  "Listing hero shows your-utm / classified-as editorial panel" \
  "Mobile: horizontal swipe carousel; desktop: 3-col grid"

do_step "Click any product."
expect \
  "product_view toast fires near the product card" \
  "Live sidebar (right side on desktop) opens with staging-layer readout" \
  "Walkthrough blurb above sidebar explains 'see the stack ↓'"

do_step "Click 'Add to cart'."
expect \
  "add_to_cart toast fires with routing ['GA4', 'BigQuery']"

do_step "Navigate to /cart."
expect \
  "view_cart toast fires" \
  "Data-quality sidebar shows 6/6 assertions passing + pipeline-health ASCII meter"

do_step "Click 'Checkout'."
expect \
  "begin_checkout toast fires" \
  "Warehouse-write sidebar shows 21 of 51 columns preview with real iampatterson_raw.events_raw destination" \
  "Cart-reactive columns (cart_value, items) update live when editing cart from another tab (skip if no time)"

do_step "Fill form and submit."
expect \
  "Full-page diagnostic moment appears with 7-line typed sequence (~1.9s)" \
  "Transitions to /confirmation" \
  "Confirmation page: purchase toast + inline diagnostic (6 timestamped steps) + full Metabase dashboard embed"

do_step "Click SessionPulse (top-right) from anywhere."
expect \
  "Overlay opens to Overview tab by default" \
  "demo_progress.ecommerce reflects the funnel stages traversed (should show 100%)"

confirm "All reveal patterns fired across the flow (toast / sidebar / inline diagnostic / full-page moment)"
confirm "Confirmation page dashboard rendered inside the iframe (cold-path if this is the first confirmation visit in ≥24h)"
confirm "SessionPulse + Overview tab reachable from the demo routes and reflect event coverage"

# ────────────────────────────────────────────────────────────────────────
scenario "6. Mobile viewport at 360px (UAT r2 item re-check)" \
  "EcomDemoBanner, swipe carousel, cart overflow, walkthrough blurbs"

setup \
  "DevTools → Toggle device toolbar → iPhone SE (375x667) or custom 360x800." \
  "Throttle to Fast 3G if available (optional)."

do_step "Navigate to ${BASE_URL}/demo/ecommerce (listing)."
expect \
  "'this is a demo' banner visible at top of page with amber dot pulse" \
  "Product grid is a horizontal swipe carousel (CSS snap), not a vertical stack" \
  "EcomSubNav shop/cart wayfinding visible + cart badge visible"

do_step "Add 3 products, navigate to /cart."
expect \
  "Cart line items are stacked (flex-col on mobile), no horizontal overflow past 360px" \
  "Total + checkout CTA visible without horizontal scroll"

do_step "Navigate to /demo/ecommerce/<any-product> on mobile."
expect \
  "'see the stack ↓' chip visible when walkthrough blurb is collapsed" \
  "Tapping the chip smooth-scrolls to [data-live-sidebar]"

confirm "Banner + carousel + cart all render correctly at 360px without horizontal overflow"
confirm "Walkthrough 'see the stack ↓' chip scrolls to sidebar on tap"

# ────────────────────────────────────────────────────────────────────────
scenario "7. UAT r2 item 6 re-verify: random UTM seed on demo entry" \
  "Demos-section CTA navigates with randomized utm_campaign / source / medium"

setup "Clear any existing demo session state (close all tabs to the site)."

do_step "Navigate to ${BASE_URL}/ and scroll to the Demos section."
do_step "Click the 'Enter the demo →' CTA three times (new tab each time, or back-nav in between)."
expect \
  "Each navigation to /demo/ecommerce has a different utm_campaign value" \
  "utm_source + utm_medium match the taxonomy seed for the picked campaign (not random combinations)" \
  "The listing-hero classified-as panel reflects the right bucket per the campaign"

confirm "Three separate clicks produced three different UTM param combinations"
confirm "Each classified-as readout matched its UTM (e.g. meta_prospecting_* → paid_social / meta)"

# ────────────────────────────────────────────────────────────────────────
scenario "8. Regression canary: Phase 9E overlay + pipeline still work" \
  "9E deliverables D1–D9 at ship-ready state (joint 9E+9F release)"

setup "Fresh incognito."

do_step "Navigate to ${BASE_URL}/"
expect \
  "SessionPulse visible in header (top-right desktop)" \
  "NavHint appears on first visit after a few seconds (or never, if already dismissed)"

do_step "Click SessionPulse or press the configured key binding."
expect \
  "Overlay opens, Overview is the default tab" \
  "Overview shows portals + event coverage chips + threshold CTA at top" \
  "Event coverage denominator is N/20 (RENDERABLE_EVENT_NAMES count), NOT N/24"

do_step "Navigate to any page to trigger the pipeline-section bleed reveal."
expect \
  "Pipeline section reveals once on scroll; doesn't re-bleed on subsequent scroll after overlay-open"

do_step "Press Escape."
expect \
  "Overlay closes"

do_step "Click outside the overlay (background)."
expect \
  "Overlay closes on background click"

confirm "All Phase 9E behaviors hold (overlay, tabs, Overview content, pipeline bleed, keyboard/background close)"

# ════════════════════════════════════════════════════════════════════════
# Results summary
hr
echo "  PHASE 9F UAT r3 RESULTS"
echo ""
echo "    PASS: $PASS"
echo "    FAIL: $FAIL"
echo "    SKIP: $SKIP"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "  FAILED SCENARIOS:"
  for s in "${FAILED_SCENARIOS[@]}"; do
    echo "    ✗ $s"
  done
  echo ""
  echo "  VERDICT: FAIL, address the failed scenarios before joint 9E+9F release cut."
  exit 1
fi

if [ "$SKIP" -gt 0 ]; then
  echo "  VERDICT: INCOMPLETE, $SKIP scenario(s) skipped (likely require production URL)."
  echo "           Re-run on production (BASE_URL=https://iampatterson.com) before release cut."
  exit 0
fi

echo "  VERDICT: PASS, Phase 9F is UAT-accepted at round 3."
echo "           Joint 9E+9F release cut is cleared from the UAT axis."
echo ""
