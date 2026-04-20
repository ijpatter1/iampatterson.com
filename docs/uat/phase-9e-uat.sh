#!/usr/bin/env bash
#
# Phase 9E — User Acceptance Testing
#
# Phase 9E reframes the site as "one world in two states":
#   D1 header nav pivot + NavHint
#   D2 overlay restructure (3 tabs, Session State default)
#   D3 Session State tab (new)
#   D4 Session State data model (tab-scoped sessionStorage)
#   D5 pipeline section progressive bleed-through reveal
#   D6 Homepage Demos section rebuild (single ecommerce surface)
#   D7 subscription + leadgen demo removal + 301 redirects
#   D8 contact form session-state ride-along (shipped with Phase 10 transport stub)
#   D9 nav + Session State analytics
#
# 16 scenarios across happy-path, boundary, accessibility, timing, state-change,
# and tab-scope edges. Scenarios marked [devtools] require operator DevTools
# action (throttle, emulate, inspect network). Scenarios marked [mobile]
# require mobile viewport emulation.
#
# Usage:
#   bash docs/uat/phase-9e-uat.sh
#
# Prerequisites:
#   - Dev server running: `npm run dev` on port 3000 in a separate shell.
#   - Desktop browser with DevTools (Chromium-family recommended for IO / rAF
#     introspection and for the DevTools "Emulate CSS prefers-reduced-motion"
#     toggle used in Scenario 3).
#   - Operator has Cookiebot consent permissions (for Scenarios 9–10).

set -u

BASE_URL="${BASE_URL:-http://localhost:3000}"

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
  read -p "  Pass? [Y/n] $prompt " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Nn]$ ]]; then
    echo "  ✗ FAIL — $prompt"
    ((FAIL++))
    FAILED_SCENARIOS+=("$CURRENT_SCENARIO: $prompt")
  else
    echo "  ✓ PASS"
    ((PASS++))
  fi
  echo ""
}

skip_scenario() {
  echo "  SKIPPED — $1"
  ((SKIP++))
  echo ""
}

verify_http() {
  local url="$1"
  local expected_status="$2"
  local label="$3"
  local actual
  actual=$(curl -s -o /dev/null -w "%{http_code}" -L --max-redirs 0 "$url" || echo "000")
  if [[ "$actual" == "$expected_status" ]]; then
    echo "  ✓ $label ($actual)"
    ((PASS++))
  else
    echo "  ✗ $label — expected $expected_status, got $actual"
    ((FAIL++))
    FAILED_SCENARIOS+=("$CURRENT_SCENARIO: $label (expected $expected_status, got $actual)")
  fi
}

verify_redirect_location() {
  local url="$1"
  local expected_location="$2"
  local label="$3"
  local actual
  actual=$(curl -s -o /dev/null -w "%{redirect_url}" --max-redirs 0 "$url" || echo "")
  if [[ "$actual" == *"$expected_location"* ]]; then
    echo "  ✓ $label ($actual)"
    ((PASS++))
  else
    echo "  ✗ $label — expected URL containing '$expected_location', got '$actual'"
    ((FAIL++))
    FAILED_SCENARIOS+=("$CURRENT_SCENARIO: $label (expected '$expected_location', got '$actual')")
  fi
}

# ────────────────────────────────────────────────────────────────────────
# Preflight

section "Phase 9E UAT — preflight"
echo "  Base URL: $BASE_URL"
if ! curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/" | grep -q "^200$"; then
  echo "  ✗ Dev server not responding at $BASE_URL/ — start \`npm run dev\` in another shell."
  exit 1
fi
echo "  ✓ Dev server reachable."
echo ""

# ────────────────────────────────────────────────────────────────────────
# SCENARIO 1 — Fresh visitor discovers nav through the hint
# Deliverables: D1, D2, D3, D9

scenario "1 — Fresh visitor discovers nav through NavHint (Flow C)" \
  "Core navigation hypothesis: visitor with no prior exposure reaches Services/Contact via SessionPulse + NavHint without a conventional nav bar"

setup \
  "Open an incognito window on desktop viewport (≥768px)." \
  "Disable prefers-reduced-motion (OS Accessibility setting OFF)." \
  "Open DevTools → Application → Storage → Clear site data."

do_step "1.1 — Load $BASE_URL/ in the fresh tab."
expect \
  "No conventional nav links in the header (no Home/Services/About/Contact/Demos)." \
  "SessionPulse visible adjacent to brand wordmark. Pulse is animating." \
  "'ses <6-char> · N evt' legible inside the pulse surface."
confirm "Header has no conventional nav links, SessionPulse is the only nav affordance"

do_step "1.2 — Do NOTHING for ~3 seconds (no scroll/click/keydown/pointermove)."
expect \
  "Soft amber pulse ring expands outward from the SessionPulse." \
  "Accompanying text reads '← menu · under the hood' (or matching copy)." \
  "Check DevTools Console for data-layer pushes: 'nav_hint_shown' fires."
confirm "NavHint animated pulse ring appears ~3s after idle on first visit"

do_step "1.3 — Continue sitting idle for another ~10 seconds."
expect \
  "Hint auto-clears." \
  "DevTools Console: 'nav_hint_dismissed' fires with dismissal_mode: 'timeout'."
confirm "NavHint auto-clears at ~10s with dismissal_mode='timeout'"

do_step "1.4 — Reload the page in the SAME tab. Wait ~5 seconds without interacting."
expect \
  "Hint does NOT re-appear, even after 3s idle." \
  "DevTools Application → Session Storage has key 'iampatterson.nav_hint.shown'."
confirm "Reload does NOT re-fire the NavHint in the same tab"

do_step "1.5 — Click the SessionPulse."
expect \
  "Overlay opens. Active tab label reads '[ SESSION STATE ]' in terminal bracket framing." \
  "Three tabs only: SESSION STATE → TIMELINE → CONSENT. No Overview, no Dashboards." \
  "DevTools Console: 'session_state_tab_view' fires with source: 'default_landing'."
confirm "Overlay lands on Session State with bracket framing, three tabs only"

do_step "1.6 — Scan the Session State tab top-to-bottom without interacting."
expect \
  "Session header: last-6 session ID + started UTC time + current page '/'." \
  "16-cell ASCII coverage bar + chip grid showing 22 event-type chips." \
  "Ecommerce funnel: PRODUCT_VIEW [  ] / ADD_TO_CART [  ] / CHECKOUT [  ] / PURCHASE [  ]." \
  "Consent summary (three rows)." \
  "Portal section: > SERVICES / > ABOUT / > CONTACT."
confirm "All Session State sections render (header, coverage, funnel, consent, portals)"

do_step "1.7 — Click '> SERVICES' in the portal section."
expect \
  "Overlay closes." \
  "Browser routes to /services." \
  "DevTools Console: 'portal_click' fires with destination: 'services'."
confirm "Portal link closes overlay AND routes to /services AND fires portal_click"

# ────────────────────────────────────────────────────────────────────────
# SCENARIO 2 — Returning-session visitor sees no hint
# Deliverables: D1, D9

scenario "2 — Returning-session visitor sees no hint" \
  "sessionStorage gate prevents re-firing within a tab"

setup \
  "Continue from Scenario 1 (hint already fired, sessionStorage key set). Do NOT clear storage."

do_step "2.1 — Navigate to /services then back to / via a footer link."
expect "No NavHint after 3s idle on /. No 'nav_hint_shown' event."
confirm "Same-tab re-visit does NOT re-show the hint"

do_step "2.2 — Open a NEW tab (fresh sessionStorage) and load $BASE_URL/. Idle ~3s."
expect "NavHint DOES fire in the new tab (new tab = new sessionStorage)."
confirm "New tab DOES show the hint"

# ────────────────────────────────────────────────────────────────────────
# SCENARIO 3 — Reduced-motion visitor experience [devtools]
# Deliverables: D1, D3, D5

scenario "3 — Reduced-motion visitor experience end-to-end [devtools]" \
  "Every motion surface respects prefers-reduced-motion"

setup \
  "DevTools → three-dot menu → More tools → Rendering → Emulate CSS media feature prefers-reduced-motion → reduce." \
  "Clear Application → Storage → Session Storage for $BASE_URL."

do_step "3.1 — Load $BASE_URL/. Sit idle ~3 seconds."
expect \
  "NavHint appears as STATIC TEXT ('← menu · under the hood') next to SessionPulse." \
  "No pulse ring animation. Fades after ~6 seconds."
confirm "NavHint is static text, not an animated ring"

do_step "3.2 — Scroll slowly through the pipeline section."
expect \
  "Bleed layers render STATICALLY — no scanline drift, phosphor breathing, flicker bursts, RGB sweep, peak jitter." \
  "Tier class still changes on scroll (warm/hot/peak visible as static color/intensity shifts)." \
  "Stage rotation does NOT advance — the active stage is frozen on stage 01."
confirm "Pipeline section has no moving effects but still shows bleed layers and tier shifts"

do_step "3.3 — At peak bleed, observe the 'Watch it live' CTA."
expect "CTA flips to solid amber fill at peak but does NOT jitter or animate halo growth."
confirm "'Watch it live' CTA flips amber at peak but does not jitter"

do_step "3.4 — Click SessionPulse, observe Session State tab."
expect "Coverage numerals render IMMEDIATELY — no typewriter/typing animation."
confirm "Session State coverage numbers appear immediately, no typewriter effect"

# ────────────────────────────────────────────────────────────────────────
# SCENARIO 4 — Pipeline bleed-through reveal (Flow A)
# Deliverables: D5, D1, D2, D3, D9

scenario "4 — Pipeline bleed-through reveal (Flow A, 'came to see the stack')" \
  "Scroll-anchored ramp peaks at footnote, tiers cross at thresholds, CTA amber-crest is timed to section end"

setup \
  "Disable prefers-reduced-motion (DevTools emulation OFF or OS setting OFF)." \
  "Desktop viewport. Fresh tab or cleared sessionStorage."

do_step "4.1 — Load $BASE_URL/. Scroll from top slowly, watching pipeline section as it enters viewport."
do_step "4.2 — As the section TOP crosses ~25% into viewport:"
expect "First visible bleed onset. Faint scanlines at section edges. Persimmon still dominant."
confirm "Bleed onset is subtle at entry, persimmon still dominant"

do_step "4.3 — Continue scrolling until section is near-centered."
expect \
  "Tier crosses to 'warm' (class on section mutates — inspect via DevTools Elements)." \
  "Phosphor bloom visible from the bottom." \
  "Flicker bursts start firing (random short brightness pulses)." \
  "Stage rotation advances 'is-hot' stage every ~1800ms."
confirm "Warm tier: phosphor bloom + flicker bursts + stage rotation all active"

do_step "4.4 — Scroll until ~2/3 of section has scrolled past viewport bottom."
expect \
  "Tier crosses to 'hot'." \
  "RGB chromatic-aberration band sweeps top→bottom visibly (~2.8s loop)." \
  "'Watch it live' CTA border warmed, halo grown, icon rotated partway." \
  "'flip →' suffix text has begun fading in (starts ~bleed 0.55)."
confirm "Hot tier: RGB sweep visible + CTA border/halo/icon couple to --bleed"

do_step "4.5 — Scroll to the footnote at the bottom of the section."
expect \
  "Tier is 'peak'. Active-stage numeral has flipped persimmon → amber." \
  "Schematic has sub-pixel jitter." \
  "CTA is solid amber fill + jittering. 'flip →' suffix fully visible."
confirm "Peak: active numeral flips amber + schematic jitters + CTA solid amber + 'flip →' visible"

do_step "4.6 — Click 'Watch it live' at peak."
expect \
  "Overlay opens to Session State." \
  "DevTools Console: 'click_cta' fires with cta_location: 'pipeline_watch_it_live'."
confirm "'Watch it live' click fires click_cta with pipeline_watch_it_live location"

do_step "4.7 — Close overlay (backdrop click). Scroll back up past the section."
expect \
  "Bleed ramp REVERSES smoothly — no visual snap, no lingering amber cast above viewport." \
  "Tier classes revert cleanly."
confirm "Scrolling back up smoothly reverses the ramp"

# ────────────────────────────────────────────────────────────────────────
# SCENARIO 5 — 301 redirect from removed demo (automated + visual)
# Deliverables: D7, D6

scenario "5 — Visitor arrives via 301 redirect from a removed demo" \
  "D7 redirects resolve from removed routes + deep-links; D6 rebuild banner surfaces"

setup \
  "No browser setup needed for automated checks; manual verification follows."

echo "  AUTOMATED:"
verify_http "$BASE_URL/demo/subscription" "301" "GET /demo/subscription → 301"
verify_redirect_location "$BASE_URL/demo/subscription" "rebuild=subscription" "  → redirects to ?rebuild=subscription"
verify_http "$BASE_URL/demo/subscription/anything/deep" "301" "GET /demo/subscription/:path* → 301 (deep-link wildcard)"
verify_redirect_location "$BASE_URL/demo/subscription/anything/deep" "rebuild=subscription" "  → deep-link also redirects to ?rebuild=subscription"
verify_http "$BASE_URL/demo/leadgen" "301" "GET /demo/leadgen → 301"
verify_redirect_location "$BASE_URL/demo/leadgen" "rebuild=leadgen" "  → redirects to ?rebuild=leadgen"
verify_http "$BASE_URL/demo/leadgen/thanks" "301" "GET /demo/leadgen/:path* → 301 (deep-link wildcard)"
echo ""

do_step "5.1 — In a fresh browser tab with cleared sessionStorage, navigate directly to $BASE_URL/demo/subscription."
expect \
  "Final URL: /?rebuild=subscription#demos. Page scrolls to Demos section." \
  "Rebuild banner visible with copy mentioning 'subscription' (e.g. 'The subscription demo is being rebuilt…')."
confirm "Subscription-label rebuild banner surfaces with correct copy"

do_step "5.2 — Dismiss the banner via the × control."
expect "Banner hides. DevTools Application → Session Storage shows a per-label dismissal key."
confirm "Banner dismisses AND sessionStorage records dismissal for 'subscription' label"

do_step "5.3 — Navigate to $BASE_URL/demo/subscription/account/settings (deep-link)."
expect "Redirects to /?rebuild=subscription#demos. Banner does NOT reappear (dismissal persisted)."
confirm "Deep-link redirect works AND banner stays dismissed per-label"

do_step "5.4 — Navigate to $BASE_URL/demo/leadgen/thanks."
expect "Redirects to /?rebuild=leadgen#demos. Rebuild banner DOES appear with leadgen-specific copy."
confirm "Leadgen-label banner appears independently (per-label sessionStorage gate)"

do_step "5.5 — From the Demos section, click 'Enter the demo →'."
expect "Routes to /demo/ecommerce. Ecommerce demo loads (unchanged from 9B — 9E does not modify it)."
confirm "Ecommerce demo still works end-to-end"

# ────────────────────────────────────────────────────────────────────────
# SCENARIO 6 — Coverage milestone thresholds
# Deliverables: D3, D4, D9

scenario "6 — Visitor crosses coverage milestone thresholds" \
  "coverage_milestone fires exactly once per session per threshold; reload suppresses re-fire"

setup \
  "Fresh tab. Clear sessionStorage." \
  "DevTools → Console open. Optionally filter for 'coverage_milestone'."

do_step "6.1 — Load $BASE_URL/. Open SessionPulse → Session State tab. Note the initial N/22 coverage."
expect "Coverage bar is 16 cells wide regardless of denominator. Fill proportional to N/22."
confirm "Coverage bar renders 16 cells; initial coverage low (~1–3/22)"

do_step "6.2 — Close overlay. Drive coverage up: scroll, click CTAs, hover SessionPulse, etc. Aim to cross 25%."
expect "When coverage crosses 25% (~6/22): 'coverage_milestone' fires with threshold: 25 in Console."
confirm "coverage_milestone: 25 fires when crossing 25%"

do_step "6.3 — Continue exploration. Navigate into ecommerce demo briefly (trigger product_view/add_to_cart), return to homepage. Push past 50%."
expect \
  "'coverage_milestone: 50' fires." \
  "Does NOT re-fire 'coverage_milestone: 25'."
confirm "coverage_milestone: 50 fires; 25 does NOT re-fire"

do_step "6.4 — Reload the page in the same tab."
expect \
  "Coverage state preserved (chip grid, funnel, percentage)." \
  "coverage_milestone does NOT re-fire for 25 or 50 (rehydrated thresholds suppressed)."
confirm "Reload preserves coverage AND does NOT re-fire already-crossed milestones"

do_step "6.5 — Continue pushing coverage across 75%."
expect "'coverage_milestone: 75' fires (newly crossed, not rehydrated)."
confirm "coverage_milestone: 75 fires on newly-crossed threshold post-reload"

do_step "6.6 — Open a NEW tab and load $BASE_URL/."
expect "Fresh session; coverage bar near zero. Milestones reset in the new tab."
confirm "New tab resets milestone state"

# ────────────────────────────────────────────────────────────────────────
# SCENARIO 7 — Threshold-gated contact CTA
# Deliverables: D3, D9

scenario "7 — Threshold-gated contact CTA appears and routes correctly" \
  "Contextual CTA surfaces only when threshold met; fires with distinct cta_location from > CONTACT portal"

setup \
  "Fresh tab. Cleared sessionStorage."

do_step "7.1 — Load /. Open Session State tab immediately."
expect "Threshold-gated contact CTA is NOT visible. Only the neutral '> CONTACT' portal link."
confirm "Contextual CTA is hidden before threshold met"

do_step "7.2 — Close overlay. Navigate /demo/ecommerce, click a product, add to cart, go to checkout."
do_step "7.3 — Return to homepage. Reopen Session State tab."
expect \
  "Threshold-gated contact CTA IS now visible (triggered by begin_checkout)." \
  "Copy is warmer/outcome-framed (e.g. 'Seen enough? →'), distinct from '> CONTACT'." \
  "Funnel: PRODUCT_VIEW [OK] / ADD_TO_CART [OK] / CHECKOUT [OK] / PURCHASE [  ]."
confirm "Contextual CTA appears post-begin_checkout with outcome-framed copy"

do_step "7.4 — Click the threshold-gated contact CTA."
expect \
  "Overlay closes, routes to /contact with NO session_state= query param." \
  "DevTools Console: 'click_cta' with cta_location: 'contact_cta_threshold'." \
  "DevTools Console: 'portal_click' with destination: 'contact'."
confirm "Threshold CTA fires click_cta with cta_location='contact_cta_threshold'"

do_step "7.5 — Browser back. Reopen overlay. Click the neutral '> CONTACT' portal link."
expect \
  "Routes to /contact." \
  "'click_cta' fires with cta_location: 'portal_contact' (DIFFERENT from threshold CTA)." \
  "'portal_click' fires with destination: 'contact'."
confirm "Portal > CONTACT fires click_cta with DIFFERENT cta_location than threshold CTA"

# ────────────────────────────────────────────────────────────────────────
# SCENARIO 8 — Overlay tab navigation + analytics discriminator
# Deliverables: D2, D9

scenario "8 — Overlay tab nav + session_state_tab_view source discriminator" \
  "Session State default; 3 tabs only; manual_select vs default_landing source"

setup "Fresh tab. Cleared sessionStorage. DevTools Console open."

do_step "8.1 — Click SessionPulse to open overlay."
expect \
  "Three tabs in order: [ SESSION STATE ] active, TIMELINE plain, CONSENT plain." \
  "No OVERVIEW. No DASHBOARDS." \
  "'session_state_tab_view' fires with source: 'default_landing'."
confirm "Three tabs only; Session State is default and fires source='default_landing'"

do_step "8.2 — Click TIMELINE tab."
expect "[ TIMELINE ] now bracket-framed, SESSION STATE plain. Timeline body visible."
confirm "Active-tab bracket framing moves to TIMELINE"

do_step "8.3 — Click CONSENT tab."
expect "[ CONSENT ] active; others plain."
confirm "Active-tab bracket framing moves to CONSENT"

do_step "8.4 — Click back to SESSION STATE."
expect \
  "[ SESSION STATE ] active again." \
  "'session_state_tab_view' fires with source: 'manual_select' (NOT default_landing)."
confirm "Return to Session State fires source='manual_select'"

do_step "8.5 — Close overlay (backdrop click). Click SessionPulse to re-open."
expect \
  "Opens BACK on Session State (tab state does not persist across open/close)." \
  "'session_state_tab_view' fires with source: 'default_landing' again."
confirm "Re-opening overlay lands on Session State with source='default_landing'"

# ────────────────────────────────────────────────────────────────────────
# SCENARIO 9 — Consent denied mid-session [cookiebot]
# Deliverables: D3, D4

scenario "9 — Consent denied mid-session updates Session State live" \
  "Consent state changes post-session-start propagate into consent_snapshot"

setup \
  "Fresh tab. Cookiebot banner should appear on first load." \
  "Accept ALL consent categories in the Cookiebot banner."

do_step "9.1 — Open Session State tab. Confirm consent summary."
expect "Consent rows: analytics: granted, marketing: granted, preferences: granted."
confirm "Initial consent summary shows all granted"

do_step "9.2 — Close overlay. Re-invoke Cookiebot preferences (floating badge or stored link). Deny marketing category."
do_step "9.3 — Interact briefly (scroll, click). Wait ~1s."
do_step "9.4 — Reopen Session State tab."
expect "Consent summary: analytics: granted, marketing: DENIED, preferences: granted."
confirm "Session State reflects mid-session consent revocation (marketing denied)"

do_step "9.5 — Switch to Timeline tab."
expect "Recent events post-consent-change continue to appear (analytics still granted)."
confirm "Timeline continues populating after consent change"

# ────────────────────────────────────────────────────────────────────────
# SCENARIO 10 — Slow Cookiebot load [devtools + network throttle]
# Deliverables: D3, D4

scenario "10 — Slow-loading consent: first-visit consent seeding [devtools]" \
  "Consent snapshot heals on first poll tick without requiring an iap_source event"

setup \
  "DevTools → Network → throttle 'Slow 3G' OR block 'consent.cookiebot.com' with a request interceptor." \
  "Clear sessionStorage, local storage, and all cookies for $BASE_URL."

do_step "10.1 — Load / under throttled/blocked network. IMMEDIATELY open Session State tab (before Cookiebot responds)."
expect "Consent snapshot shows all 'denied' (Cookiebot state not yet available; getCurrentConsent returns denied)."
confirm "Pre-Cookiebot, snapshot reads all 'denied' without crashing"

do_step "10.2 — Wait ~1–2 seconds. Do NOT take any banner action yet."
expect "Within ~400ms of Cookiebot load, snapshot heals to real state (typically all granted if auto-consent is on, or still denied if banner is pending)."
confirm "Snapshot heals to real state within ~400ms, without needing user event"

do_step "10.3 — Take a consent-banner action (accept or deny)."
expect "Snapshot updates to match banner choice."
confirm "Banner action propagates to snapshot"

# ────────────────────────────────────────────────────────────────────────
# SCENARIO 11 — Mobile viewport [mobile]
# Deliverables: D1, D2, D3, D5, D6

scenario "11 — Mobile-viewport visitor navigates the pivot [mobile]" \
  "Mobile layout for header, overlay, pipeline schematic, and Demos section"

setup \
  "DevTools → device mode → iPhone 12 or similar (<768px)." \
  "Fresh tab, cleared sessionStorage."

do_step "11.1 — Load $BASE_URL/."
expect \
  "SessionPulse sits in top-right (hamburger position) with mobile styling." \
  "No conventional nav. Header sticky-on-scroll."
confirm "SessionPulse is top-right on mobile"

do_step "11.2 — Idle ~3 seconds."
expect "NavHint pulse ring fires, positioned sensibly relative to top-right SessionPulse (not clipped)."
confirm "NavHint positions correctly on mobile"

do_step "11.3 — Tap SessionPulse."
expect "Overlay opens to Session State. Tab bar usable at mobile width. Chip grid, funnel, portals all legible; chips wrap gracefully."
confirm "Session State tab fully usable at mobile width (no clipping)"

do_step "11.4 — Close overlay. Scroll into pipeline section."
expect "Schematic: 2-column layout (numeral 40px + body). Readouts collapse below each stage; expand via max-height only when is-hot. Bleed layers visible."
confirm "Pipeline schematic uses 2-column mobile layout with is-hot-gated readouts"

do_step "11.5 — Scroll into Demos section."
expect \
  "Single full-width section (NO horizontal-scroll track, NO swipe-hint bars)." \
  "Eyebrow, serif headline, paragraphs, CTA, terminal preview stacked vertically and legible."
confirm "Demos section is single full-width block (not horizontal scroll track)"

# ────────────────────────────────────────────────────────────────────────
# SCENARIO 12 — Desktop hover + session_pulse_hover debounce
# Deliverables: D1, D9

scenario "12 — Desktop SessionPulse hover affordance + 60s analytics debounce" \
  "Hover reveals NAV · UNDER THE HOOD; session_pulse_hover debounced; suppressed on coarse pointer"

setup "Desktop viewport (≥768px). Mouse pointer (fine). DevTools Console open."

do_step "12.1 — Load /. Hover SessionPulse without clicking."
expect \
  "Border intensifies; ↗ indicator scales/glows." \
  "Tooltip-style label appears reading 'NAV · UNDER THE HOOD' in mono/amber." \
  "Console: 'session_pulse_hover' fires."
confirm "Hover label 'NAV · UNDER THE HOOD' appears + session_pulse_hover fires"

do_step "12.2 — Move cursor away. Hover again within 10s."
expect \
  "Visual hover state shows (affordance works)." \
  "'session_pulse_hover' does NOT re-fire (debounced to 60s)."
confirm "session_pulse_hover debounced — no re-fire within 60s"

do_step "12.3 — Wait 60+ seconds, hover again."
expect "'session_pulse_hover' fires again (debounce window elapsed)."
confirm "session_pulse_hover fires again after 60s"

do_step "12.4 — DevTools device mode: switch to mobile (coarse pointer simulation). Hover/tap events."
expect "'session_pulse_hover' does NOT fire on hover under coarse-pointer simulation."
confirm "session_pulse_hover is suppressed under coarse-pointer"

# ────────────────────────────────────────────────────────────────────────
# SCENARIO 13 — Coverage denominator drift guard
# Deliverables: D3, D4

scenario "13 — Coverage denominator matches live schema" \
  "No rendering-path hardcodes denominator; bar is 16 cells, denominator is 22"

setup "Fresh tab, cleared sessionStorage."

do_step "13.1 — Load /. Open Session State tab."
expect \
  "Coverage readout: '<N>/22 event types' (current denominator 22 as of 9E D9)." \
  "Bar is visually 16 cells wide." \
  "Chip grid contains exactly 22 chips."
confirm "Bar is 16 cells + denominator is 22 + chip grid has 22 chips"

do_step "13.2 — Scan chip grid for nav-analytics chips (added in D9): nav_hint_shown, nav_hint_dismissed, session_pulse_hover, session_state_tab_view, portal_click, coverage_milestone."
expect "All 6 nav-analytics chips present (most dimmed until fired)."
confirm "All 6 D9 nav-analytics chips present in the chip grid"

do_step "13.3 — Scan for subscription/leadgen chips: plan_select, trial_signup, form_complete, lead_qualify."
expect "All 4 chips present but dimmed (unfired — intentional carry in denominator)."
confirm "Subscription/leadgen chips present but dimmed"

do_step "13.4 — Hover SessionPulse to fire session_pulse_hover. Reopen Session State tab."
expect "session_pulse_hover chip has flipped from dimmed to amber."
confirm "Firing a nav-analytics event flips its chip amber"

# ────────────────────────────────────────────────────────────────────────
# SCENARIO 14 — Full persona run (Flow B)
# Deliverables: D1, D2, D3, D4, D5, D6, D7, D8, D9

scenario "14 — Full persona run (Flow B, 'came for the dashboards')" \
  "Full end-to-end: enters via removed demo redirect, scrolls hero → pipeline → demos, completes ecommerce, sees elevated coverage + threshold CTA + D8 ride-along"

setup "Fresh tab, cleared sessionStorage."

do_step "14.1 — Enter via $BASE_URL/demo/subscription (stale inbound link)."
expect "301 redirect to /?rebuild=subscription#demos. Rebuild banner visible at Demos section."
confirm "Stale inbound link redirects + rebuild banner appears"

do_step "14.2 — Dismiss banner. Scroll UP to the hero."
expect "Pipeline section renders above Demos. Scrolling up, bleed ramp reverses cleanly."
confirm "Scroll-up reverses pipeline bleed cleanly"

do_step "14.3 — From hero, scroll DOWN through pipeline section (full Scenario 4 experience)."
expect "Full bleed reveal: warm → hot → peak with CTA amber crest at footnote."
confirm "Full pipeline reveal plays end-to-end"

do_step "14.4 — Click 'Watch it live' at peak. Overlay opens."
expect "Session State shows fired events already (page_view, scroll_depth, at least) as amber chips."
confirm "Session State accurately reflects events fired during pipeline scroll"

do_step "14.5 — Close overlay. Click 'Enter the demo →' in Demos section."
expect "Routes to /demo/ecommerce. Ecommerce demo is 9B implementation (unchanged in 9E)."
confirm "Ecommerce demo still works end-to-end (9E does not break 9B)"

do_step "14.6 — Complete the demo through /demo/ecommerce/confirmation."
do_step "14.7 — Return to homepage. Open Session State tab."
expect \
  "Coverage jumped substantially." \
  "Ecommerce funnel: all four stages [OK]. Percentage 100%." \
  "coverage_milestone has fired at crossed thresholds." \
  "Threshold-gated contact CTA is visible."
confirm "Post-demo Session State: 100% funnel + elevated coverage + threshold CTA visible"

do_step "14.8 — Click threshold-gated contact CTA. Arrive at /contact."
expect \
  "Contact page renders." \
  "D8 ride-along block visible below the message textarea: checkbox labeled 'Share my session state with this message' + human-readable summary."
confirm "D8 ride-along block is visible on contact page"

do_step "14.9 — Inspect the D8 summary copy (marketing should be granted from Cookiebot acceptance)."
expect \
  "Checkbox is CHECKED by default (marketing granted)." \
  "Summary reads: 'You've triggered X of 22 event types, completed 100% of the ecommerce demo, and visited N pages. Your consent state and session ID will ride along.'"
confirm "D8 checkbox checked + summary shows concrete payload + 'will ride along'"

do_step "14.10 — Inspect the hidden session_state field. DevTools Elements → find input[name='session_state']."
expect \
  "Hidden input present. value attribute is JSON with session_id, event_types_triggered, event_types_total=22, ecommerce_demo_percentage=100, pages_visited, consent object."
confirm "Hidden session_state field serialized with correct projection shape"

do_step "14.11 — Uncheck the checkbox. Re-inspect Elements."
expect \
  "Summary copy flips to 'Session state will not be included with this message. Check the box above to share it.'" \
  "input[name='session_state'] is REMOVED from DOM (not just hidden or disabled)."
confirm "Uncheck removes hidden input from DOM + summary copy flips"

# ────────────────────────────────────────────────────────────────────────
# SCENARIO 15 — Interaction-before-hint cancels
# Deliverables: D1, D9

scenario "15 — Interaction-before-hint cancels the hint" \
  "Any idle-reset event within 3s prevents the hint from ever rendering"

setup "Fresh tab. Cleared sessionStorage. Desktop."

do_step "15.1 — Load $BASE_URL/."
do_step "15.2 — Within 1 SECOND of load, scroll slightly OR move the pointer."
expect "Idle timer resets. NavHint does NOT fire. No 'nav_hint_shown' in Console."
confirm "Early interaction prevents the hint from firing"

do_step "15.3 — Continue interacting normally. Idle for 10+ seconds afterward."
expect \
  "NavHint still does NOT fire (homepage-entry-scoped + interaction cancelled it for this page-load)." \
  "No 'nav_hint_dismissed' fires — dismissal only fires when hint rendered."
confirm "Later idle does not fire hint; no nav_hint_dismissed without nav_hint_shown"

do_step "15.4 — Navigate to /services via footer link, then back to / via footer Home link."
expect "No hint on return to / (sessionStorage gate may or may not be set; behavior is homepage-entry-scoped anyway)."
confirm "Return to / in same tab does not re-fire hint"

# ────────────────────────────────────────────────────────────────────────
# SCENARIO 16 — New-tab session isolation
# Deliverables: D3, D4

scenario "16 — New-tab visitor gets a fresh Session State blob" \
  "D4 tab-scoped sessionStorage: reload preserves, new tab is fresh, per-tab isolation"

setup "Two tabs A and B in the same browser window. Start with both clear."

do_step "16.1 — TAB A: Load /. Navigate through a few pages, trigger events. Open Session State."
expect "Note coverage (e.g. 7/22) and session ID last-6."
confirm "Tab A Session State has non-trivial coverage"

do_step "16.2 — TAB A: Reload (Cmd/Ctrl+R)."
expect \
  "Coverage, chip grid amber states, funnel progress, session ID all PRESERVED." \
  "visited_paths count stable."
confirm "Tab A reload preserves Session State"

do_step "16.3 — TAB B (new tab): Load $BASE_URL/."
expect \
  "Session State starts FRESH. Coverage at minimum (just page_view)." \
  "Funnel all [  ]. Session ID may differ or match (_iap_sid cookie may be shared)." \
  "Session State BLOB is independent per-tab."
confirm "New tab (B) starts with fresh Session State"

do_step "16.4 — TAB B: Trigger events, reach product_view in demo, return to homepage."
do_step "16.5 — TAB A: Reload."
expect "Tab A's Session State is STILL its own — NOT merged with Tab B's activity. Per-tab isolation holds."
confirm "Activity in Tab B does NOT bleed into Tab A"

# ────────────────────────────────────────────────────────────────────────
# Summary

hr
echo "  UAT SUMMARY"
echo ""
echo "    PASS:    $PASS"
echo "    FAIL:    $FAIL"
echo "    SKIPPED: $SKIP"
echo ""
if [ $FAIL -gt 0 ]; then
  echo "  FAILED CHECKS:"
  for failure in "${FAILED_SCENARIOS[@]}"; do
    echo "    ✗ $failure"
  done
  echo ""
  echo "  VERDICT: ✗ FAIL — Phase 9E NOT accepted. Address failures before joint 9E+9F release."
  exit 1
else
  echo "  VERDICT: ✓ PASS — Phase 9E accepted."
  echo "           Joint 9E+9F release cut unblocked from the 9E side."
  echo "           Phase 9F implementation picks up next."
fi
hr
