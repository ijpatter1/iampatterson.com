#!/usr/bin/env bash
#
# Phase 10a, UAT — Framework Currency (Next.js 14 → 16)
#
# Verifies the 7 Phase 10a deliverables from a visitor's perspective:
#   D1: Next.js 14.2.35 → 15.5.15 + React 18 → 19 hop
#   D2: `after()` migration for Metabase keep-warm (closes 9F D9 Pass-2
#       Tech Important on Vercel Lambda durability)
#   D3: Next 15 → 16.2.4 + ESLint 9 flat config + React-Compiler
#       preflight cleanup (3 new shared hooks + refactors + justified
#       disables; all 31 violations cleared)
#   D4: React 19 dependency audit (no ERESOLVE; deduped across consumers)
#   D5: Test-suite stabilization (1164 → 1187 tests, +23 net)
#   D6: Build + smoke gate (build clean + HTTP-surface smoke +
#       Playwright Chromium interactive smoke)
#   D7: Doc currency (CLAUDE.md / ARCHITECTURE.md / PHASE_STATUS.md)
#
# 13 scenarios: 10 primary + 3 edge cases.
#   Scenarios marked [devtools] require operator DevTools action.
#   Scenarios marked [prod] require the Vercel deploy to be live.
#   Scenarios marked [prod-cold] specifically need cold Lambda +
#   cold Metabase cache state (≥30 min idle).
#
# Usage:
#   bash docs/uat/phase-10a-uat.sh                   # local dev (skips [prod*])
#   BASE_URL=https://iampatterson.com \
#     bash docs/uat/phase-10a-uat.sh                 # production
#
# Prerequisites:
#   - Dev server running (`npm run dev` on port 3000) OR prod URL set
#   - Desktop browser with DevTools (Chromium-family recommended for
#     Application tab + Rendering tab reduced-motion emulator)
#   - Browser with reduced-motion toggle (macOS System Settings →
#     Accessibility → Display → Reduce motion, OR Chrome DevTools →
#     Rendering → "Emulate CSS media feature prefers-reduced-motion")
#   - Incognito / private browsing capability
#   - For [prod-cold] scenario: ability to wait ≥30 minutes without
#     hitting `/` or `/demo/ecommerce` or `/demo/ecommerce/confirmation`
#     to guarantee cold Lambda + cold Metabase cache

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
# Helpers (match phase-9f-uat-r3.sh conventions)

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

open_url() {
  if command -v open >/dev/null 2>&1; then
    open "$1" 2>/dev/null || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$1" 2>/dev/null || true
  fi
}

# ════════════════════════════════════════════════════════════════════════

section "PHASE 10A UAT — Framework Currency (Next 14 → 16 + React 18 → 19 + D3 preflight)"

echo "  Target: $BASE_URL"
echo "  Mode:   $([ "$IS_PROD" -eq 1 ] && echo 'production' || echo 'local dev')"
echo ""
echo "  Automated coverage (already green as of session-2026-04-23-003):"
echo "    • 1187 jest tests, 109 suites"
echo "    • Playwright D6 smoke: 4/4 Chromium tests green"
echo "    • Lint: 0/0 at default severity"
echo "    • Build: clean on Next 16.2.4"
echo ""
echo "  This UAT complements automation with human observations the"
echo "  tests can't cover: subjective animation timing, cold-cache"
echo "  Lambda durability (prod-only), reduced-motion honouring,"
echo "  cross-consumer session identity coherence, console health."
echo ""
read -p "  Press ENTER to begin scenarios… " _

# ────────────────────────────────────────────────────────────────────────
scenario "1. Public-site walkthrough — subjective feel check" \
  "D1 Next 15+React 19 hop, D3 preflight, overall render-model parity"

setup \
  "Dev server or prod build running at $BASE_URL." \
  "Desktop viewport." \
  "Reduced-motion OFF (OS setting + DevTools Rendering tab both default)."

do_step "Open $BASE_URL in a fresh browser tab."
open_url "$BASE_URL/"
expect \
  "Page settles within ~3 seconds" \
  "No flash of unstyled content (FOUC)" \
  "Typography loads without layout shift"

do_step "Scroll top-to-bottom slowly. Observe pipeline-editorial rotation, section transitions."

do_step "Click through: Services → About → Contact → Home."
expect \
  "Navigation feels instant, no flicker between pages" \
  "No double-render artefact from React 19 concurrent mode"

do_step "Resize the window: 1440 → 800 → 1440."
expect \
  "Layout reflows smoothly at each breakpoint"

confirm "Homepage pipeline animation runs smoothly without visible frame drops?"
confirm "Navigation between pages feels instant with no flicker or FOUC?"
confirm "Typography and layout feel polished and identical to pre-upgrade?"

# ────────────────────────────────────────────────────────────────────────
scenario "2. SessionPulse overlay — boot → cycle → close → reopen (hasBooted state verification)" \
  "D3 hasBooted ref→state conversion in overlay-view.tsx"

setup \
  "On homepage ($BASE_URL/) with reduced-motion OFF."

do_step "Locate the SessionPulse affordance (amber pulsing pill in the header)."
do_step "Click it. Observe the boot animation on FIRST open."
expect \
  "Full boot animation plays (brief reveal/fade, then tab view settles)"

do_step "Cycle through all overlay tabs: Overview → Timeline → Consent → back to Overview."

do_step "Press Escape or click the close affordance."
expect \
  "Overlay dismisses cleanly, returns to ambient site chrome"

do_step "Wait ~2 seconds."

do_step "Click the SessionPulse affordance again (SECOND open)."
expect \
  "Overlay re-opens INSTANTLY to the tab-level view" \
  "NO boot animation replay on second open" \
  "hasBooted state remembers the first open"

confirm "First-open boot animation played fully?"
confirm "Second-open skipped the boot animation and landed on the tab view instantly?"
confirm "Cycling all three tabs (Overview/Timeline/Consent) worked smoothly with no flicker?"
confirm "Close and reopen left no stale UI state?"

# ────────────────────────────────────────────────────────────────────────
scenario "3. Ecommerce funnel — listing to confirmation with animation timing" \
  "D3 checkout-form orderId lazy init, D2 confirmation warmup fires"

setup \
  "Cookies fresh or cleared. Reduced-motion OFF. Cart empty."

do_step "Open $BASE_URL/demo/ecommerce"
open_url "$BASE_URL/demo/ecommerce"

do_step "Click any product tile to reach the product detail page."

do_step "Click 'Add to cart'. Observe the toast."
expect \
  "Toast slides in cleanly (amber pill, 'add_to_cart' event name)" \
  "No jank, no double-render"

do_step "Navigate to the cart (cart icon or /demo/ecommerce/cart)."

do_step "Click 'Checkout' to reach /demo/ecommerce/checkout."

do_step "Fill the checkout form fields (email, name, card — simulated, any values)."

do_step "Click 'Place order'. Watch the diagnostic sequence."
expect \
  "Full-page diagnostic reveals ~7 lines with typing animation" \
  "Total duration: ~3.2 seconds" \
  "Pacing feels readable, not rushed or sluggish"

do_step "Land on /demo/ecommerce/confirmation?order_id=..."
expect \
  "Order summary shows the correct total + item count" \
  "Metabase iframe begins loading within 2 seconds" \
  "Metabase dashboard interactive within 10 seconds"

confirm "Add-to-cart toast animation played smoothly?"
confirm "Diagnostic sequence timing felt right (~3.2s, readable, deliberate pacing)?"
confirm "Confirmation page Metabase dashboard reached interactive within 10 seconds?"
confirm "No console errors across the whole funnel?"

# ────────────────────────────────────────────────────────────────────────
scenario "4. [prod-cold] Cold-cache Metabase embed — D2 after() durability" \
  "D2 after() migration — the ONE visible behavioural change in Phase 10a"

if skip_if_not_prod; then :; else
  setup \
    "MUST have waited ≥30 minutes without hitting / or /demo/ecommerce or /demo/ecommerce/confirmation" \
    "Fresh incognito window ready" \
    "DevTools Network tab open, 'Disable cache' checked, recording cleared"

  do_step "Confirm cold-state precondition (check deployment logs OR confirm idle ≥30 min)."

  do_step "Open fresh incognito window. Open DevTools → Network tab."

  do_step "Start stopwatch. Navigate directly to:"
  do_step "  $BASE_URL/demo/ecommerce/confirmation?order_id=test-cold-cache&total=99.99&items=1"
  open_url "$BASE_URL/demo/ecommerce/confirmation?order_id=test-cold-cache&total=99.99&items=1"

  do_step "Record time to Metabase iframe first paint (structure visible)."
  do_step "Record time to Metabase interactive (chart data populated)."

  do_step "In Network tab, locate the Metabase warmup request."
  expect \
    "Warmup request fires AFTER the main page response completes (this is after() working)" \
    "No 504 / timeout errors from warmup"

  do_step "Return to the same URL within 30 seconds (warm-cache re-hit)."
  expect \
    "Metabase iframe loads near-instantly on the warm path"

  confirm "Cold-cache confirmation page Metabase dashboard loaded interactively within 10 seconds?"
  confirm "Network tab showed a background warmup request AFTER the page response?"
  confirm "Revisit within 30s showed a warm-cache fast load?"
fi

# ────────────────────────────────────────────────────────────────────────
scenario "5. Reduced-motion honouring — ON state" \
  "D3 usePrefersReducedMotion adoption across components"

setup \
  "Reduced-motion ENABLED:" \
  "  - macOS: System Settings → Accessibility → Display → Reduce motion" \
  "  - OR Chrome DevTools → Rendering tab → 'Emulate CSS media feature prefers-reduced-motion: reduce'" \
  "Fresh cookies."

do_step "Verify reduced-motion toggle is ON."

do_step "Reload $BASE_URL/. Observe the homepage pipeline."
expect \
  "Pipeline rotation is STATIC or near-static (NOT rotating continuously)"

do_step "Navigate through Services / About / Contact."
expect \
  "No scroll-triggered animations, or motion significantly reduced"

do_step "Go to /demo/ecommerce, add a product to cart."
expect \
  "Toast appears instantly (no slide-in) OR fades in with reduced intensity"

do_step "Checkout → Place order. Observe the diagnostic sequence."
expect \
  "Diagnostic sequence short-circuits (instant reveal of all lines, NOT the 3.2s animated typing)"

do_step "Back to /. Click SessionPulse."
expect \
  "Overlay snaps directly to tab view, NO boot animation"

confirm "Pipeline animation stopped or significantly reduced?"
confirm "Toast, diagnostic, and overlay-boot animations all short-circuited / instant?"
confirm "All content remained readable and all flows completable?"

# ────────────────────────────────────────────────────────────────────────
scenario "6. Reduced-motion OFF — regression canary" \
  "D3 usePrefersReducedMotion gate must not accidentally short-circuit motion for non-opt-in users"

setup \
  "Reduced-motion DISABLED (OS setting + DevTools emulation both OFF)." \
  "Fresh cookies."

do_step "Verify reduced-motion is OFF (DevTools Rendering: 'No emulation')."

do_step "Reload $BASE_URL/. Observe the pipeline rotation."
expect \
  "Pipeline rotates fully (loop animation active)"

do_step "/demo/ecommerce → add product → see toast slide-in."
expect \
  "Toast slides in with full motion"

do_step "Checkout → Place order → full diagnostic sequence."
expect \
  "Diagnostic sequence plays full ~3.2s typing reveal"

do_step "SessionPulse → full boot animation."
expect \
  "Overlay boot reveal plays in full"

confirm "All animations played at full fidelity (pipeline, toast, diagnostic, overlay-boot)?"
confirm "Motion behaviour feels identical to pre-upgrade baseline?"

# ────────────────────────────────────────────────────────────────────────
scenario "7. [devtools] Browser console health — full-arc sweep" \
  "D1 hydration clean, D3 preflight clean, D4 React 19 deps clean"

setup \
  "DevTools Console open, cleared, filter = 'All levels' (Errors + Warnings + Info)." \
  "Network tab: 'Disable cache' checked." \
  "Reduced-motion OFF."

do_step "Clear console. Hard-reload $BASE_URL/."

do_step "Walk:"
do_step "  / → Services → About → Contact"
do_step "  → /demo/ecommerce → product page → cart → checkout → place order → confirmation"

do_step "On /, open SessionPulse, cycle all tabs, close, reopen."

do_step "Inspect the console. Zero tolerance for:"
expect \
  "Hydration warnings ('Hydration failed' / 'Text content did not match' / 'server rendered HTML')" \
  "'Cannot update a component while rendering a different component' errors" \
  "'useSyncExternalStore' warnings or getSnapshot-returning-different-value warnings" \
  "Fast Refresh errors or re-mount loops" \
  "React 19-specific warnings (use() misuse, deprecated APIs, ref-as-prop)" \
  "Next 16 Turbopack errors or module resolution warnings"

do_step "Acceptable noise (document but do NOT fail):"
expect \
  "Pre-existing Recharts width(-1)/height(-1) on /demo/ecommerce/analytics" \
  "Cookiebot / GTM noise if dev server doesn't suppress CMP"

confirm "Console showed zero hydration warnings across the full walk?"
confirm "Console showed zero React 19 / Next 16 specific errors or warnings?"
confirm "Only acceptable noise was Recharts + Cookiebot (pre-existing)?"

# ────────────────────────────────────────────────────────────────────────
scenario "8. [devtools] Session identity coherence — SessionPulse and LiveStrip agree" \
  "D3 SessionPulse migration to useSessionId (Pass-2 fix) — both consumers share the subscription channel"

setup \
  "DevTools Application tab open." \
  "Clear all cookies + storage for the site's origin."

do_step "Hard-reload $BASE_URL/. Wait ~2 seconds for session minting."

do_step "Application tab → Cookies → locate '_iap_sid' cookie."
do_step "Note its last 6 characters (e.g. if value is 'sess_abc-20260423_a1b2c3', suffix is 'a1b2c3')."

do_step "Click SessionPulse. Read the displayed identifier (typically last-6-chars)."

do_step "Locate LiveStrip (the ticker/chrome strip showing session info)."
do_step "Compare LiveStrip's displayed suffix against SessionPulse's."

expect \
  "Cookie '_iap_sid' value exists after first interaction" \
  "SessionPulse's suffix MATCHES the cookie suffix exactly" \
  "LiveStrip's suffix MATCHES SessionPulse's exactly" \
  "Both consumers show the SAME identifier on the SAME render tick"

confirm "SessionPulse and LiveStrip display the identical 6-char session suffix?"
confirm "Both suffixes match the _iap_sid cookie value?"

# ────────────────────────────────────────────────────────────────────────
scenario "9. [devtools] Session rotation — live cookie update propagates" \
  "D3 session.ts listener architecture + Pass-3 same-value notify suppression"

setup \
  "Continuation of Scenario 8 (session minted, both consumers showing the same suffix)."

do_step "Note current session suffix displayed in SessionPulse + LiveStrip."

do_step "DevTools Application tab → Cookies → delete '_iap_sid'."

do_step "Hard-refresh the page (triggers re-mint)."

do_step "Immediately observe SessionPulse and LiveStrip."

do_step "Application tab → confirm new '_iap_sid' cookie has a different value."

expect \
  "New '_iap_sid' minted with different value" \
  "SessionPulse shows the NEW 6-char suffix" \
  "LiveStrip shows the NEW 6-char suffix on the SAME render tick" \
  "Both suffixes match each other AND match the new cookie" \
  "NO race condition where one consumer lags behind the other"

confirm "After rotation, SessionPulse and LiveStrip updated to the new suffix on the same tick?"
confirm "No visible staleness where one consumer lagged behind the other?"

# ────────────────────────────────────────────────────────────────────────
scenario "10. Ecommerce funnel under reduced-motion — diagnostic still completes" \
  "D3 reduced-motion gate must NOT break the funnel flow; D2 confirmation warmup still fires"

setup \
  "Reduced-motion ENABLED." \
  "Fresh cart."

do_step "Verify reduced-motion is ON."

do_step "/demo/ecommerce → add product → cart → checkout."

do_step "Fill the form, click 'Place order'."

do_step "Observe the diagnostic reveal."
expect \
  "Diagnostic completes in <1s (short-circuit path), NOT the ~3.2s animated default"

do_step "Confirm you still land on /demo/ecommerce/confirmation?order_id=..."

do_step "Confirm Metabase iframe loads normally."

confirm "Diagnostic sequence short-circuited but funnel still reached confirmation?"
confirm "Confirmation page + Metabase rendered normally under reduced-motion?"

# ════════════════════════════════════════════════════════════════════════

section "EDGE CASES"

# ────────────────────────────────────────────────────────────────────────
scenario "A. [devtools] Rebuild-banner tri-state via redirect URL" \
  "D3 useClientMount gate on rebuild banner + storage persistence"

setup \
  "Cookies + localStorage + sessionStorage cleared." \
  "DevTools Application tab open."

do_step "Clear all storage for the origin."

do_step "Navigate directly to $BASE_URL/?rebuild=subscription#demos"
open_url "$BASE_URL/?rebuild=subscription#demos"

do_step "Observe initial render. Check for banner-flash or layout shift."

do_step "Application tab → inspect Local Storage + Session Storage for rebuild-banner keys."

do_step "Dismiss the banner (X or dismissal CTA)."

do_step "Note the storage state after dismissal."

do_step "Hard-refresh the page with '?rebuild=subscription#demos' still in URL."

do_step "Observe whether the banner re-appears."

do_step "Close tab, open new tab, navigate to $BASE_URL/?rebuild=subscription#demos"

expect \
  "First load: NO flash of banner-then-gone (useClientMount prevents SSR/client mismatch)" \
  "Banner renders in the subscription-rebuild variant state" \
  "Dismissal persists to the expected storage mechanism" \
  "Post-refresh: banner respects dismissal (if localStorage-based persistence)" \
  "Scroll anchor #demos scrolls to the demos section" \
  "NO hydration warnings across any step"

confirm "Rebuild banner rendered without flash on initial load?"
confirm "Dismissal persisted correctly across refresh?"
confirm "Hash anchor #demos scrolled to the right section?"
confirm "Console stayed clean (no hydration warnings during the redirect flow)?"

# ────────────────────────────────────────────────────────────────────────
scenario "B. Incognito / private tab cold hydration" \
  "D3 useClientMount + useSessionId + useSessionContext with empty storage"

setup \
  "Browser with incognito / private mode." \
  "DevTools openable in that window."

do_step "Open fresh incognito window."

do_step "Open DevTools → Console (cleared) + Application tab."

do_step "Navigate to $BASE_URL/."

do_step "Verify Application tab shows: sessionStorage empty, localStorage empty, no '_iap_sid' cookie initially."

do_step "Watch the page render. Observe any flash of pre-hydration content."

do_step "After render settles (~2s), re-check Application tab for '_iap_sid' cookie."

do_step "Open SessionPulse to verify session identity propagates."

do_step "Add a product to the ecommerce demo, verify '_iap_sid' holds through the interaction."

do_step "Close incognito window entirely. Open a NEW incognito window. Navigate to $BASE_URL/ again."

expect \
  "Initial render has no FOUC or hydration flicker despite empty storage" \
  "'_iap_sid' cookie minted on first client tick" \
  "SessionPulse shows a valid session ID with 6-char suffix" \
  "LiveStrip matches SessionPulse" \
  "NO hydration warnings in console" \
  "Second incognito window: brand-new session ID (NOT inherited — incognito sandbox)"

confirm "First incognito load hydrated cleanly with no FOUC / hydration warnings?"
confirm "Session ID minted and propagated to SessionPulse + LiveStrip?"
confirm "Second fresh incognito window got a different session ID (as expected)?"

# ────────────────────────────────────────────────────────────────────────
scenario "C. Returning visitor — useSessionId reads existing cookie without re-minting" \
  "D3 useSessionId getSnapshot purity (Pass-1 fix); Pass-3 same-value notify suppression"

setup \
  "DevTools Application tab open." \
  "Ability to manually set a cookie."

do_step "Clear all cookies for the origin."

do_step "Application tab → Cookies → add new cookie:"
do_step "  Name: _iap_sid"
do_step "  Value: sess_20260101_preexist-abc123"
do_step "  Domain: $([ "$IS_PROD" -eq 1 ] && echo 'iampatterson.com' || echo 'localhost')"
do_step "  Path: /"
do_step "  Expires: ~1 year from now"

do_step "Verify cookie shows in cookies list BEFORE any page render."

do_step "Hard-refresh $BASE_URL/."

do_step "Observe SessionPulse + LiveStrip displayed suffix."
expect \
  "Both should show suffix 'abc123' (last 6 chars of your pre-set value)"

do_step "Re-check Application tab: '_iap_sid' cookie value."
expect \
  "Value STILL matches your pre-set value (NOT overwritten to a newly-minted one)"

do_step "Walk: home → services → home → open SessionPulse."

do_step "Re-check cookie value after the walk."
expect \
  "Cookie value STILL matches pre-set (max-age may refresh, but ID stays)" \
  "NO render-tick thrash rewriting the cookie repeatedly"

do_step "Check DevTools Console for getSnapshot warnings."

confirm "Pre-set session_id was READ (not overwritten) on first page render?"
confirm "SessionPulse + LiveStrip both showed the pre-set suffix?"
confirm "Cookie value remained stable (not thrashed) across the walk?"
confirm "Console stayed clean (no getSnapshot purity warnings)?"

# ════════════════════════════════════════════════════════════════════════
# Summary

hr
echo ""
echo "  RESULTS"
echo ""
echo "    ✓ PASS  : $PASS"
echo "    ✗ FAIL  : $FAIL"
echo "    ⊘ SKIP  : $SKIP"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "  Failed scenarios:"
  for s in "${FAILED_SCENARIOS[@]}"; do
    echo "    • $s"
  done
  echo ""
  echo "  ✗ UAT: FAIL — $FAIL scenario(s) require attention before Phase 10a merge."
  echo ""
  echo "  Next: capture feedback in docs/uat/phase-10a-uat-feedback.md"
  echo "  listing each failed check with reproduction steps and proposed fix."
  hr
  exit 1
fi

if [ "$SKIP" -gt 0 ]; then
  echo "  ⚠  UAT: PASS (LOCAL) — $SKIP scenario(s) skipped (require production URL)."
  echo ""
  echo "  Re-run with BASE_URL=https://iampatterson.com to cover the [prod*]"
  echo "  scenarios before merge-to-main."
  hr
  exit 0
fi

echo "  ✓ UAT: PASS — Phase 10a is user-accepted. Ready to merge to main."
hr
exit 0
