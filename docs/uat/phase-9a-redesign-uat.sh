#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════
# Phase 9A-redesign, UAT (User Acceptance Test)
#
# End-to-end verification of the editorial reskin of the homepage,
# services page, and under-the-hood overlay. Interactive script: mixes
# automated curl checks (HTTP 200, HTML content presence) with confirm()
# prompts for visual / animation / CRT verification that can't be
# automated.
#
# Runs against a local `npm run dev` server (http://localhost:3000).
# Operator keeps a browser window open alongside the terminal, follows
# the scenarios, observes each prompt, and presses Y/n to score.
#
# Usage: bash docs/uat/phase-9a-redesign-uat.sh
#        bash docs/uat/phase-9a-redesign-uat.sh --auto-only  # skip interactive prompts
#
# Exit status: 0 if all checks pass, 1 otherwise.
# ═══════════════════════════════════════════════════════
set -uo pipefail
# Do NOT set -e, we want all checks to run even if one fails.

BASE_URL="${BASE_URL:-http://localhost:3000}"
AUTO_ONLY=false
[[ "${1:-}" == "--auto-only" ]] && AUTO_ONLY=true

PASS=0
FAIL=0
SKIP=0

# ── Helpers ──────────────────────────────────────────
section() {
  echo ""
  echo "═══════════════════════════════════════════════════════"
  echo "  $1"
  echo "═══════════════════════════════════════════════════════"
}

verify() {
  local label="$1" cmd="$2"
  if eval "${cmd}" >/dev/null 2>&1; then
    echo "  ✓ ${label}"
    PASS=$((PASS + 1))
  else
    echo "  ✗ ${label}"
    FAIL=$((FAIL + 1))
  fi
}

confirm() {
  local prompt="$1" label="${2:-${1}}"
  if [[ "${AUTO_ONLY}" == "true" ]]; then
    echo "  ⏭  ${label}  (skipped, --auto-only)"
    SKIP=$((SKIP + 1))
    return
  fi
  echo ""
  echo "  → ${prompt}"
  read -p "  Pass? [Y/n] " -n 1 -r
  echo ""
  if [[ ${REPLY} =~ ^[Nn]$ ]]; then
    echo "  ✗ ${label}"
    FAIL=$((FAIL + 1))
  else
    echo "  ✓ ${label}"
    PASS=$((PASS + 1))
  fi
}

fetch() {
  curl -sSL --max-time 10 "$1"
}

# ── Prerequisites ────────────────────────────────────
section "Prerequisites"

verify "Dev server reachable at ${BASE_URL}" \
  "curl -sI --max-time 5 ${BASE_URL}/ | grep -q 'HTTP/[12].* 200'"

if [[ ${FAIL} -gt 0 ]]; then
  echo ""
  echo "Dev server not running. Start it with:"
  echo "    npm run dev"
  echo "Then re-run this script."
  exit 1
fi

# ── Scenario 1, First-visit editorial read ──────────
section "Scenario 1, First-visit editorial read of the homepage"
echo "  Exercises: D1 tokens · D3 hero · D4 pipeline · D5 demos · D6 teaser · D7 proof · D8 CTA"

HOME_HTML="$(fetch "${BASE_URL}/")"

verify "Homepage returns 200" \
  "curl -sI --max-time 5 ${BASE_URL}/ | grep -q '200'"

verify "Hero headline 'I build' present" \
  "echo \"\${HOME_HTML}\" | grep -q 'I build'"

verify "Hero emphasis word 'measurement' present" \
  "echo \"\${HOME_HTML}\" | grep -q 'measurement'"

verify "Proof metric '2.5' present" \
  "echo \"\${HOME_HTML}\" | grep -q '2.5'"

verify "Proof metric '\$45' present" \
  "echo \"\${HOME_HTML}\" | grep -q '\\\$45'"

verify "Final CTA phrase 'Then hire me' present" \
  "echo \"\${HOME_HTML}\" | grep -q 'Then hire me'"

echo ""
echo "  → Open ${BASE_URL}/ in a browser for the visual checks below."
confirm "Hero headline renders in Instrument Serif (tall serif), with 'measurement' italicized and in persimmon #EA5F2A" \
  "Hero serif + italic accent"
confirm "Scrolling top-to-bottom: hero → pipeline → demos → services teaser (4 tiers) → proof (3 metrics) → final CTA" \
  "Homepage section order"
confirm "Accent color is persimmon everywhere (italic emphases, CTAs, metric units, left borders), NOT amber. Background is paper, not dark" \
  "Accent discipline on paper surface"
confirm "Proof section shows 2.5M, \$45K, 24/7 metrics with tags + context blurbs" \
  "Proof 3-metric grid"

# ── Scenario 2, Pipeline with real events ───────────
section "Scenario 2, Pipeline section shows real events flowing"
echo "  Exercises: D4 (pipeline + useLiveEvents), D10 (event pipeline preserved)"

confirm "5 pipeline stages labeled in order: Browser → Client GTM → sGTM → BigQuery → Dashboards" \
  "Pipeline stage labels + order"
confirm "Active-stage indicator cycles along the pipeline every ~1.4s" \
  "Active-stage rotation"
confirm "After scrolling for ~3s, the live log feed has populated with timestamp · event_name · page_path rows (NOT hard-coded mock strings)" \
  "Live log feed wired to real events"
confirm "A 'Watch it live' pill CTA sits near the log feed" \
  "Pipeline CTA present"

# ── Scenario 3, Flip the card ───────────────────────
section "Scenario 3, Flip the card: paper → CRT boot → amber overlay → back to paper"
echo "  Exercises: D1 accent flip · D2 SessionPulse · D9 CRT overlay · D10 provider wiring"

confirm "Header has a SessionPulse pill on the left with a pulsing persimmon dot + short session ID + live event count" \
  "SessionPulse present and ticking"

echo ""
echo "  → Click SessionPulse (or the hero primary CTA)."
confirm "Brief black hold (~0.25s). During the hold the page accent flips persimmon → phosphor amber #FFA400. Then the panel reveals with a subtle tab-flash" \
  "Two-step boot with accent flip"
confirm "Inside overlay: dark near-black backdrop, warm cream text, amber accent, visible CRT scanlines + soft bloom + subtle flicker (terminal, not white modal)" \
  "Terminal/CRT vocabulary"
confirm "4 tabs at the top: Overview · Timeline · Consent · Dashboards" \
  "Overlay 4-tab set"

echo ""
echo "  → Click 'Back to site' (or click the backdrop outside the panel)."
confirm "Overlay closes; page accent returns instantly to persimmon (no lingering amber)" \
  "Close returns to persimmon"

# ── Scenario 4, Overlay tabs tell the story ─────────
section "Scenario 4, Overlay tabs tell the coherent 'under the hood' story"
echo "  Exercises: D9 (tabs), D4 (shared hook), D10 (event pipeline)"

echo ""
echo "  → Reopen the overlay via SessionPulse. Scroll the page first so timeline has rows."

confirm "Timeline tab: session events in reverse-chronological order with event_name, timestamp, page_path" \
  "Timeline populated with real events"

echo ""
echo "  → Click any event row in the Timeline."
confirm "Event-detail drill-down opens with structured fields; a contextual narrative blurb renders below the detail" \
  "Event detail + narrative contextual"

echo ""
echo "  → Click the Overview tab."
confirm "Overview: Tier 1-3 narrative framing with editorial italic-accent in the headline ('instrumented'), NOT a blank panel" \
  "Overview editorial content"

echo ""
echo "  → Click the Consent tab."
confirm "Consent: editorial headline with italic 'deny', rows for each consent signal (granted/denied), active + suppressed destinations listed" \
  "Consent tab real content"

echo ""
echo "  → Click the Dashboards tab."
confirm "Dashboards: editorial headline + italic accent on 'dashboards', 3 demo-dashboard rows + a 'Live Metabase · bi.iampatterson.com' panel with IAP-gating note" \
  "Dashboards tab + Metabase panel"

echo ""
echo "  → Close the overlay."

# ── Scenario 5, Services page + scroll-spy ──────────
section "Scenario 5, Homepage teaser hands off to Services page with sticky scroll-spy"
echo "  Exercises: D6 (teaser + page), D1 (accent), D9 (overlay from closer), D10"

verify "/services returns 200" \
  "curl -sI --max-time 5 ${BASE_URL}/services | grep -q '200'"

SERVICES_HTML="$(fetch "${BASE_URL}/services")"

verify "Services hero copy 'End-to-end' present" \
  "echo \"\${SERVICES_HTML}\" | grep -q 'End-to-end'"

verify "All 4 tier titles present in services HTML" \
  "echo \"\${SERVICES_HTML}\" | grep -q 'Measurement Foundation' && echo \"\${SERVICES_HTML}\" | grep -q 'Data Infrastructure' && echo \"\${SERVICES_HTML}\" | grep -q 'Business Intelligence' && echo \"\${SERVICES_HTML}\" | grep -qE 'Attribution (&|&amp;) Advanced'"

verify "'Not sure where you' closer phrase present" \
  "echo \"\${SERVICES_HTML}\" | grep -q 'Not sure where you'"

echo ""
echo "  → On the homepage, scroll to the services teaser. Click any tier row."

confirm "Each teaser row links to /services (row click lands on that page)" \
  "Teaser → /services navigation"
confirm "/services has a sticky tier-nav sidebar on desktop with 4 tier entries" \
  "Sticky tier-nav"

echo ""
echo "  → Scroll down through /services slowly."
confirm "Sticky nav highlights the active tier (scroll-spy), persimmon accent on the active entry" \
  "Scroll-spy active highlight"

echo ""
echo "  → Click a different tier entry in the sidebar."
confirm "Page scrolls to that tier's section; sidebar highlight updates to match" \
  "Tier-nav click-to-scroll"
confirm "Each tier section has numbered core/optional component lists + a tier-summary block with persimmon accent left-border" \
  "Tier content structure"

echo ""
echo "  → Scroll to the bottom of /services."
confirm "Closer section: 'Not sure where you'd start? Watch it run first.' with primary + ghost CTAs" \
  "Services closer section"

echo ""
echo "  → Click the closer's primary CTA."
confirm "Overlay boots with amber accent flip (same as Scenario 3); tab is Overview by default" \
  "Closer CTA opens overlay"

echo ""
echo "  → Close the overlay."

# ── Scenario 6, Editorial chrome on all consulting routes ──
section "Scenario 6, Editorial chrome wraps every consulting route"
echo "  Exercises: D2 (chrome), D10 (route integration), D1, D9 (tab-hinted open)"

confirm "Header: SessionPulse left · nav center (Home, Services, Demos, About, Contact) · hamburger on narrow widths" \
  "Header composition"
confirm "Sticky LiveStrip ticker sits directly below the header with fields: SESSION · STACK · CONSENT · PIPELINE · DASHBOARDS · ATTRIB" \
  "LiveStrip fields"
confirm "LiveStrip session suffix matches the one shown in SessionPulse (6-char match)" \
  "LiveStrip/SessionPulse session-id parity"
confirm "Footer: 4-column editorial grid (brand · pages · demos · under-the-hood) + legal row at the very bottom" \
  "Footer 4-column grid"

echo ""
echo "  → Click one of the 3 'under the hood' deep links in the footer column (Live event stream / Pipeline architecture / Consent state)."
confirm "Overlay opens already on the matching tab (Timeline / Overview / Consent), no extra click needed" \
  "Tab-hinted deep link from footer"

echo ""
echo "  → Close overlay. Navigate to /services."
confirm "Same header + LiveStrip + footer wrap the services page" \
  "Chrome persists on /services"

echo ""
echo "  → Navigate to /about and /contact."
confirm "Same editorial chrome wraps these routes (body content is Phase 8 styling, deferred, not a failure)" \
  "Chrome persists on /about + /contact"

# ── Scenario 7, Mobile sheet + demos scroll-snap ────
section "Scenario 7, Mobile sheet nav + horizontal-scroll demos + demo routes still render"
echo "  Exercises: D2 (MobileSheet), D5 (demos), D10 (demo routes untouched)"

echo ""
echo "  → Open browser DevTools → Device Mode → set viewport to ~375px width. Reload."

confirm "Header collapses to hamburger + SessionPulse" \
  "Mobile header collapse"

echo ""
echo "  → Tap the hamburger."
confirm "MobileSheet slides in as a full-height menu with numbered editorial nav list (01 Home, 02 Services, 03 Demos, 04 About, 05 Contact)" \
  "MobileSheet structure"

echo ""
echo "  → Close the sheet and scroll to the Demos section."
confirm "Demo cards render as a horizontal-scroll track with snap points; a swipe-indicator bar below tracks scroll position" \
  "Mobile demos scroll-snap + indicator"
confirm "3 cards present: E-commerce (The Tuna Shop) · Subscription (Tuna Subscription) · Lead Gen (Tuna Partnerships)" \
  "3 demo cards visible"

verify "/demo/ecommerce returns 200" \
  "curl -sI --max-time 5 ${BASE_URL}/demo/ecommerce | grep -q '200'"
verify "/demo/subscription returns 200" \
  "curl -sI --max-time 5 ${BASE_URL}/demo/subscription | grep -q '200'"
verify "/demo/leadgen returns 200" \
  "curl -sI --max-time 5 ${BASE_URL}/demo/leadgen | grep -q '200'"

echo ""
echo "  → Tap each demo card in turn and confirm each demo route renders without errors."
confirm "/demo/ecommerce renders (styling does not match editorial chrome, expected, scope-deferred)" \
  "Ecommerce demo renders"
confirm "/demo/subscription renders" \
  "Subscription demo renders"
confirm "/demo/leadgen renders" \
  "Leadgen demo renders"

echo ""
echo "  → Switch browser back to desktop viewport for remaining scenarios."

# ── Scenario 8, Overlay available on demo routes, ambient bubbles gated ──
section "Scenario 8, Overlay available on ecommerce demo; ambient bubbles gated"
echo "  Exercises: D10 (route integration), D9 (pathname-specific overview panel)"
echo ""
echo "  Phase 9B explicitly uses the overlay on /demo/ecommerce/* for the Tier 2"
echo "  under-the-hood content (campaign taxonomy, staging, data quality, etc.),"
echo "  so the overlay SHOULD be reachable on ecommerce routes, only the ambient"
echo "  event bubbles are gated off /demo/* per AmbientBubblesWrapper."

echo ""
echo "  → Navigate to /demo/ecommerce. Click SessionPulse in the header."
confirm "Overlay opens on /demo/ecommerce. Overview tab renders EcommerceUnderside (Phase 9B content), styling may still use Phase 8 tokens (scope-deferred)" \
  "Overlay reachable on ecommerce demo"
confirm "Ambient event bubbles are NOT shown on /demo/ecommerce (gated by AmbientBubblesWrapper)" \
  "Ambient bubbles gated off /demo/*"

echo ""
echo "  → Close the overlay. Navigate back to /."
confirm "Ambient bubbles return on /; overlay still reachable" \
  "Bubbles back on consulting route"

# ── Edge-1, prefers-reduced-motion ──────────────────
section "Edge-1, prefers-reduced-motion respected"
echo "  Exercises: D1 (accent flip), D4 (pipeline motion), D9 (boot + CRT)"

echo ""
echo "  → Enable reduced motion:"
echo "    macOS: System Settings → Accessibility → Display → Reduce Motion (ON)"
echo "    DevTools: Rendering panel → Emulate CSS media feature prefers-reduced-motion: reduce"
echo "  → Hard-reload ${BASE_URL}/"

confirm "Pipeline packet motion is paused / not animating; active-stage indicator does NOT cycle" \
  "Pipeline motion paused"
confirm "Scroll-reveal animations disabled (content appears immediately on scroll)" \
  "Scroll reveals disabled"

echo ""
echo "  → Open overlay via SessionPulse."
confirm "No boot hold, panel content renders immediately. Accent still flips persimmon → amber, but instantly" \
  "Boot phase skipped under reduced-motion"
confirm "CRT flicker animation is disabled (static layers are OK)" \
  "CRT flicker paused"

echo ""
echo "  → Close overlay."
confirm "Accent flips back to persimmon instantly" \
  "Close accent flip instant"

echo ""
echo "  → Disable reduced motion before continuing."

# ── Edge-2, close-then-reopen state reset ───────────
section "Edge-2, Close-then-reopen lands on tab-level, not stale drill-down"
echo "  Exercises: D9 (state reset), D2 (footer deep-links), D10"

echo ""
echo "  → Open overlay. Click Timeline tab. Click into any event row (drill into event detail)."
echo "  → Close the overlay."
echo "  → Reopen via SessionPulse (or any entry point)."
confirm "Overlay reopens on tab-level Timeline view, NOT stuck on the previous event-detail drill-down" \
  "selectedEvent cleared on close"

echo ""
echo "  → Switch to Dashboards tab. Close. Reopen from the footer's 'Consent state' deep link."
confirm "Overlay opens on the Consent tab, not Dashboards (stale), not Timeline (default)" \
  "Tab-hint overrides stale viewMode"

echo ""
echo "  → Close the overlay."

# ── Edge-3, cancel accent flip on fast close ────────
section "Edge-3, Fast-close during boot hold does not leave accent stuck amber"
echo "  Exercises: D1 (cancel-on-close accent flip), D9 (boot state machine)"

echo ""
echo "  → On the homepage, click SessionPulse to open the overlay."
echo "  → Immediately (within ~100ms, before the boot hold ends) press Escape or click the backdrop to close."
confirm "Page accent is persimmon, not amber. No lingering amber tint on hero italic, CTAs, or metric units" \
  "Fast-close cancels pending amber flip"

echo ""
echo "  → Repeat the click-then-immediate-close cycle 2-3 times in a row."
confirm "Accent remains persimmon throughout; no accumulated amber state" \
  "Repeated fast-close stays persimmon"

# ── Session-024 addendum, CRT boot fidelity + once-per-session ─────

section "Addendum-1, Once-per-session boot (sessionStorage scope)"
echo "  Exercises: D9 once-per-session spec refinement (session-024)"

echo ""
echo "  → Open a NEW incognito/private window (or a fresh tab with sessionStorage cleared)."
echo "  → Navigate to the homepage. Click SessionPulse to open the overlay for the FIRST time."
confirm "Boot sequence plays: ~260ms black hold, warm amber flicker pulse, content blinks/strobes in with hard steps (not smooth fade). Accent flips persimmon → amber during the hold." \
  "First-open boot sequence plays as specified"

echo ""
echo "  → Close the overlay via Back-to-site or backdrop click."
echo "  → Click SessionPulse again to REOPEN in the same tab/session."
confirm "No boot hold. Panel contents are present immediately. Scanlines/ambient already on. Accent still amber." \
  "Second-open-in-session skips boot"

echo ""
echo "  → Open a NEW tab, navigate to the homepage."
echo "  → Click SessionPulse to open the overlay in the new tab."
confirm "Boot sequence plays again (new sessionStorage scope)" \
  "New tab / new session re-fires boot"

section "Addendum-2, CRT boot visual fidelity (split-layer)"
echo "  Exercises: D9 CRT four-layer structure (session-024 commits 4e185f7 + 1ca8233)"

echo ""
echo "  → From a fresh session (new incognito window), open the overlay."
echo "  → WATCH THE TOP NAV AREA of the overlay during the 260ms boot hold."
confirm "A warm amber glow is visible behind the 'Under the Hood' header. NOT a plain dark band." \
  "Ambient amber glow scoped to header (user-preserved effect)"

echo ""
echo "  → Once the boot settles, look at the tabs row and the content body."
confirm "Subtle amber horizontal scanlines visible across the ENTIRE overlay, including tabs and body, not just the header." \
  "Scanlines cover full surface (z:3 CRT wrapper)"

echo ""
echo "  → Watch the content pane while tabs transition. Click Timeline, then Consent, then Dashboards."
confirm "Each tab switch triggers a hard strobing reveal (~150ms, visibly stepped), not a gentle ease-out fade" \
  "tab-flash steps(3, end) strobe on tab change"

# ── Results ──────────────────────────────────────────
section "Results"
echo "  Pass:    ${PASS}"
echo "  Fail:    ${FAIL}"
echo "  Skipped: ${SKIP}"
echo ""

if [[ ${FAIL} -eq 0 ]]; then
  echo "  ✅ Phase 9A-redesign UAT PASSED"
  exit 0
else
  echo "  ❌ Phase 9A-redesign UAT FAILED (${FAIL} check${FAIL:+s} did not pass)"
  exit 1
fi
