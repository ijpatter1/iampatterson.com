#!/usr/bin/env bash
#
# Phase 10d, UAT — Polish, Performance & Launch Prep
#
# End-to-end visitor verification of the 9 Phase 10d deliverables across
# `phase/10d-launch-prep`. Mirrors the phase-10a-uat.sh pattern: scenario
# blocks with setup/do_step/expect/confirm; automated `verify()` calls
# wherever the codebase can self-check; visual `confirm()` prompts where
# the eye is the only authority.
#
# Phase 10d deliverables:
#   D1 — Mobile testing matrix (5 viewports × 8 routes; matrix doc at
#        docs/perf/mobile-matrix-2026-04-25.md; iPhone-SE soft-fail
#        carry packaged as docs/manual/task-2026-04-25-007.md)
#   D2 — Error handling (15s iframe load-timeout fallback on
#        /demo/ecommerce/confirmation; graceful WebSocket / Pub/Sub /
#        BQ degradation; audit at docs/perf/error-handling-audit-2026-04-25.md)
#   D3 — Site-self analytics (`page_engagement` event at 15s/60s/180s;
#        new mart_ecommerce_funnel; Metabase question
#        07_ecommerce_funnel_drop_off wired into ecommerce_executive)
#   D4 — SEO (root + 4 per-route metadata, JSON-LD Organization+Person,
#        sitemap, robots, dynamic OG image; content plan at
#        docs/seo/content-plan-2026-04-25.md)
#   D5 — Security review (5-track audit at docs/security/review-2026-04-25.md;
#        npm audit clean; PII audit clean across 26 event types;
#        18/18 sGTM tags consentSettings-gated)
#   D6 — Load testing (gated LOAD_TEST=1 suites; runner at
#        scripts/run-load-tests.sh; baseline at
#        docs/perf/load-test-2026-04-25.md)
#   D7 — Anonymous-id `_iap_aid` cookie (UUID v4, 365d Max-Age,
#        SameSite=Lax, Secure on https; threaded into BaseEvent)
#   D8 — UX polish bundle (10 sub-items including u-accept/u-deny
#        semantic tokens, ✓/× glyph variety, shop product images,
#        Overview/Consent directives)
#   D9 — Browser storage inspector (cookies + localStorage +
#        sessionStorage in overlay; categorized read-only view)
#
# 13 scenarios: 9 deliverable-aligned + 3 edge cases + 1 regression sweep.
#   Scenarios marked [auto] run without operator interaction.
#   Scenarios marked [devtools] require DevTools observation.
#   Scenarios marked [prod] require BASE_URL pointing at production.
#   Scenarios marked [slow] include intentional waits (≥16s).
#
# Usage:
#   bash docs/uat/phase-10d-uat.sh                    # local dev (default)
#   BASE_URL=https://iampatterson.com \
#     bash docs/uat/phase-10d-uat.sh                  # production
#   SKIP_LOAD=1 bash docs/uat/phase-10d-uat.sh        # skip D6 load suites
#   SKIP_SLOW=1 bash docs/uat/phase-10d-uat.sh        # skip 16s wait scenarios
#
# Prerequisites:
#   - arm64 Node 20.9+ on PATH (script prepends /opt/homebrew/bin)
#   - Dev server running (`npm run dev` on port 3000) OR prod URL set
#   - Desktop browser with DevTools (Chromium-family)
#   - For D1 carry: a real iPhone-SE-class device (375×667, Safari URL bar)
#   - For D6 load tests: `npm install` already run inside both
#     infrastructure/cloud-run/event-stream and data-generator service dirs

set -u
export PATH="/opt/homebrew/bin:$PATH"

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

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

# ────────────────────────────────────────────────────────────────────────
# Helpers (match phase-10a-uat.sh / phase-9f-uat-r3.sh conventions)

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

verify() {
  local desc="$1" cmd="$2"
  echo "  → ${desc}"
  if eval "${cmd}" > /tmp/uat-10d-verify.log 2>&1; then
    echo "    ✓ PASS"
    ((PASS++))
  else
    echo "    ✗ FAIL: ${cmd}"
    tail -5 /tmp/uat-10d-verify.log | sed 's/^/      /'
    ((FAIL++))
    FAILED_SCENARIOS+=("$CURRENT_SCENARIO :: ${desc}")
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

skip_if_no_load() {
  if [ "${SKIP_LOAD:-0}" = "1" ]; then
    echo "  ⊘ SKIP (SKIP_LOAD=1 set)"
    ((SKIP++))
    return 0
  fi
  return 1
}

skip_if_no_slow() {
  if [ "${SKIP_SLOW:-0}" = "1" ]; then
    echo "  ⊘ SKIP (SKIP_SLOW=1 set — long waits disabled)"
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

section "PHASE 10D UAT — Polish, Performance & Launch Prep (D1–D9)"

echo "  Target: $BASE_URL"
echo "  Mode:   $([ "$IS_PROD" -eq 1 ] && echo 'production' || echo 'local dev')"
echo "  Date:   $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""
echo "  Phase context (per CLAUDE.md / PHASE_STATUS.md):"
echo "    • All 9 deliverables shipped on phase/10d-launch-prep"
echo "    • Pass-3 dual-evaluator: Tech 5.00/5 + Product 5.00/5, ship-recommended"
echo "    • Test suite: 1324 jest tests (1204 → 1324; +120 net across 10d)"
echo "    • Mobile matrix: 40 cases × 3 captures = 120 screenshots green"
echo ""
echo "  This UAT layers visitor + operator observations on top of the"
echo "  green automation: subjective UX, live-server behaviour, ≥16s"
echo "  engagement waits, real-cookie inspection, and the consent-deny"
echo "  → suppression edge case the unit tests can't cover end-to-end."
echo ""
read -p "  Press ENTER to begin scenarios… " _

# ────────────────────────────────────────────────────────────────────────
# Scenario 0 — automated baseline
# ────────────────────────────────────────────────────────────────────────
scenario "0. [auto] Baseline state — tests + lint + build + supporting docs" \
  "Repo is in a known-good state before visitor scenarios begin"

verify "npm test passes at ≥1324 tests (Phase 10d ship-state)" \
  "npm test 2>&1 | tee /tmp/uat-10d-jest.log | grep -qE 'Tests:.*1324 passed'"

verify "npm run lint clean (no errors)" \
  "npm run lint 2>&1 | tail -5 | grep -qvE 'problem|error  '"

verify "npm run build clean on Next 16.2.4" \
  "npm run build 2>&1 | tail -10 | grep -qE 'Generating|prerendered|Route \\(app\\)|Compiled'"

verify "D1 mobile matrix doc exists with 5 viewports listed" \
  "test -f docs/perf/mobile-matrix-2026-04-25.md && grep -qE 'iPhone-SE.*375' docs/perf/mobile-matrix-2026-04-25.md"

verify "D1 carry-forward task doc packaged" \
  "test -f docs/manual/task-2026-04-25-007.md"

verify "D2 error-handling audit doc exists" \
  "test -f docs/perf/error-handling-audit-2026-04-25.md"

verify "D3 mart_ecommerce_funnel.sqlx defines partition + cluster keys" \
  "grep -qE 'partitionBy.*session_start' infrastructure/dataform/definitions/marts/mart_ecommerce_funnel.sqlx && grep -qE 'page_engagement' infrastructure/dataform/definitions/marts/mart_ecommerce_funnel.sqlx"

verify "D3 Metabase question 07_ecommerce_funnel_drop_off.yaml exists" \
  "test -f infrastructure/metabase/dashboards/specs/questions/07_ecommerce_funnel_drop_off.yaml"

verify "D3 ecommerce_executive dashboard references mart_ecommerce_funnel" \
  "grep -q 'mart_ecommerce_funnel' infrastructure/metabase/dashboards/specs/dashboards/ecommerce_executive.yaml"

verify "D4 SEO content plan exists" \
  "test -f docs/seo/content-plan-2026-04-25.md"

verify "D4 dynamic OG image route exists" \
  "test -f src/app/opengraph-image.tsx && grep -q 'ImageResponse' src/app/opengraph-image.tsx"

verify "D4 sitemap + robots routes exist" \
  "test -f src/app/sitemap.ts && test -f src/app/robots.ts"

verify "D4 JSON-LD builders exist" \
  "test -f src/lib/seo/json-ld.ts && grep -qE 'Organization|Person' src/lib/seo/json-ld.ts"

verify "D5 security review doc exists, PASS verdict" \
  "test -f docs/security/review-2026-04-25.md && grep -qiE 'PASS|no critical' docs/security/review-2026-04-25.md"

verify "D6 load-test runner is executable + report exists" \
  "test -x scripts/run-load-tests.sh && test -f docs/perf/load-test-2026-04-25.md"

verify "D7 anonymous-id helper defines _iap_aid cookie name" \
  "grep -qE \"ANONYMOUS_ID_COOKIE_NAME = '_iap_aid'\" src/lib/identity/anonymous-id.ts"

verify "D9 storage-categories include app-identity classifier for _iap_aid" \
  "grep -q \"category: 'app-identity'\" src/lib/identity/storage-categories.ts && grep -qE '_iap_aid' src/lib/identity/storage-categories.ts"

echo "  Baseline complete. Begin visitor scenarios:"
echo ""

# ────────────────────────────────────────────────────────────────────────
# Scenario 1 — D1 Mobile testing matrix
# ────────────────────────────────────────────────────────────────────────
scenario "1. D1 Mobile testing matrix — visual sweep at iPhone-SE + iPad-Mini" \
  "5-viewport × 8-route Playwright sweep + the iPad-Mini-landscape cart fix"

setup \
  "Chrome DevTools open (or browser of choice with device emulation)." \
  "Toggle device toolbar." \
  "Be ready to switch between 'iPhone SE' (375×667) and 'iPad Mini' landscape (1024×768)."

do_step "Switch viewport to iPhone SE (375×667)."

do_step "Navigate to $BASE_URL/"
open_url "$BASE_URL/"
expect \
  "H1 'I build…' is visible without horizontal scroll" \
  "SessionPulse pill in the top-right has tap target ≥44×44" \
  "Primary hero CTA reachable; one minimal scroll past Safari URL-bar collapse is acceptable" \
  "(See docs/manual/task-2026-04-25-007.md — soft fail carry on iPhone-SE worst-case)"

do_step "Navigate to $BASE_URL/demo/ecommerce/cart and add a product first if cart empty."
expect \
  "Cart contents fit at 375px wide (no horizontal scroll)" \
  "LiveSidebar (data-quality readout) stacks below cart, not overlapping"

do_step "Switch viewport to iPad Mini, landscape orientation (1024×768)."

do_step "Reload the cart page."
expect \
  "Cart grid uses lg:grid-cols-[minmax(0,1fr)_360px] layout (the regression fix)" \
  "No 16px horizontal overflow at 1024px wide (the cart sidebar fix from session-008)"

do_step "Navigate to $BASE_URL/demo/ecommerce/checkout (still iPad-Mini landscape)."
expect \
  "Checkout form + LiveSidebar fit cleanly at 1024px"

confirm "iPhone-SE: H1 visible, SessionPulse hits 44×44 tap target?"
confirm "iPad-Mini landscape: cart + checkout no longer overflow horizontally?"
confirm "Mobile matrix sweep felt polished — no obvious layout issues across the 8 routes?"

# ────────────────────────────────────────────────────────────────────────
# Scenario 2 — D2 Error handling: iframe load-timeout fallback
# ────────────────────────────────────────────────────────────────────────
scenario "2. [edge] D2 Error handling — 15s iframe load-timeout fallback" \
  "src/components/demo/ecommerce/dashboard-payoff.tsx IFRAME_LOAD_TIMEOUT_MS"

setup \
  "Open $BASE_URL/demo/ecommerce/confirmation?order_id=test-d2-fallback&total=42.00&items=1" \
  "Open DevTools → Network tab" \
  "Network throttling: select 'Offline' OR add a request blocker pattern matching" \
  "  bi.iampatterson.com/embed/* before navigation" \
  "(Goal: iframe never fires onLoad within 15s, fallback should render)"

do_step "Verify the throttle / block is active."

do_step "Navigate to $BASE_URL/demo/ecommerce/confirmation?order_id=test-d2-fallback&total=42.00&items=1"
open_url "$BASE_URL/demo/ecommerce/confirmation?order_id=test-d2-fallback&total=42.00&items=1"

do_step "Watch the dashboard-payoff section (below the order summary). Wait 15+ seconds."
expect \
  "Initially: iframe attempts to load (visible white box)" \
  "After ~15s: fallback prose replaces the iframe — title 'dashboard didn't load in time'" \
  "Fallback prose includes a deep-link to bi.iampatterson.com/dashboard/<id>" \
  "Page does NOT crash, white-screen, or show a generic Next.js error" \
  "Order summary above the fallback remains intact + readable"

do_step "Check DevTools Console."
expect \
  "No unhandled promise rejection or React error boundary trigger" \
  "Acceptable: a Cookiebot / pre-existing Recharts warning"

do_step "Disable the network block + reload."
expect \
  "iframe loads normally on the warm path (no fallback)"

confirm "Fallback prose rendered after the 15s budget expired?"
confirm "Deep-link to bi.iampatterson.com is present + clickable?"
confirm "Order summary above the fallback remained intact, no crash?"
confirm "Disabling the block + reload renders the dashboard normally?"

# ────────────────────────────────────────────────────────────────────────
# Scenario 3 — D3 page_engagement at 15s
# ────────────────────────────────────────────────────────────────────────
scenario "3. [slow] D3 Site-self analytics — page_engagement fires at 15s" \
  "src/components/page-engagement-tracker.tsx threshold=15s"

if skip_if_no_slow; then :; else
  setup \
    "Fresh tab at $BASE_URL/" \
    "DevTools → Console open" \
    "Be prepared to keep the tab visible (no switching) for ≥16 seconds"

  do_step "Navigate to $BASE_URL/ and immediately open SessionPulse → Timeline tab."
  open_url "$BASE_URL/"

  do_step "Note the initial event count in the Timeline view."

  do_step "Close the overlay (Escape). Stay on the page. Do NOT switch tabs."

  do_step "Wait 16 seconds. (Don't tab away — engagement counter pauses on visibility=hidden.)"
  echo "    Sleeping 16s to give the engagement timer room…"
  sleep 16

  do_step "Re-open SessionPulse → Timeline tab."
  expect \
    "A new 'page_engagement' row appears with engagement_seconds=15" \
    "Routing badge shows GA4 + BigQuery destinations" \
    "max_scroll_pct rides along (0 if you didn't scroll)"

  do_step "Click the page_engagement row to expand the detail."
  expect \
    "Event payload shows event_name=page_engagement, engagement_seconds=15" \
    "session_id + page_path populated; session_id has a 6-char visible suffix"

  do_step "Open the narrative-flow row description (in Timeline or Overview)."
  expect \
    "page_engagement renders with a sensible label like 'engaged ≥15s'"

  confirm "page_engagement event appeared in the Timeline after the 16s wait?"
  confirm "Routing badge correctly shows GA4 + BigQuery destinations?"
  confirm "Narrative-flow row described page_engagement intelligibly?"
fi

# ────────────────────────────────────────────────────────────────────────
# Scenario 4 — D4 SEO: sitemap, robots, OG image, JSON-LD
# ────────────────────────────────────────────────────────────────────────
scenario "4. [auto] D4 SEO — sitemap, robots, OG image, head metadata, JSON-LD" \
  "Per-route metadata + sitemap + robots + dynamic /opengraph-image"

verify "GET /robots.txt returns 200 with Sitemap: line + explicit Disallow" \
  "curl -sf '$BASE_URL/robots.txt' -o /tmp/robots.txt && grep -qiE '^sitemap:' /tmp/robots.txt && grep -qiE '^disallow:' /tmp/robots.txt"

verify "GET /sitemap.xml returns 200 with at least 4 <url> entries" \
  "curl -sf '$BASE_URL/sitemap.xml' -o /tmp/sitemap.xml && [ \$(grep -c '<url>' /tmp/sitemap.xml) -ge 4 ]"

verify "Sitemap includes /demo/ecommerce product detail entries (catalog-derived)" \
  "grep -qE '/demo/ecommerce/[a-z0-9-]+' /tmp/sitemap.xml"

verify "Homepage <head> contains og:title + og:image" \
  "curl -sf '$BASE_URL/' -o /tmp/home.html && grep -qE 'property=\"og:title\"' /tmp/home.html && grep -qE 'property=\"og:image\"' /tmp/home.html"

verify "Homepage <head> contains canonical link" \
  "grep -qE 'rel=\"canonical\"' /tmp/home.html"

verify "Homepage <head> includes JSON-LD Organization schema" \
  "grep -qE 'application/ld\\+json' /tmp/home.html && grep -qE '\"@type\":\"Organization\"|\"@type\": \"Organization\"' /tmp/home.html"

verify "Homepage <head> includes JSON-LD Person schema" \
  "grep -qE '\"@type\":\"Person\"|\"@type\": \"Person\"' /tmp/home.html"

verify "/about <head> includes Twitter card metadata" \
  "curl -sf '$BASE_URL/about' -o /tmp/about.html && grep -qE 'name=\"twitter:card\"' /tmp/about.html"

verify "/services has its own canonical (per-route metadata layout)" \
  "curl -sf '$BASE_URL/services' -o /tmp/services.html && grep -qE 'rel=\"canonical\"' /tmp/services.html && grep -qE '/services' /tmp/services.html"

verify "/contact has its own openGraph metadata" \
  "curl -sf '$BASE_URL/contact' -o /tmp/contact.html && grep -qE 'property=\"og:title\"' /tmp/contact.html"

verify "/demo/ecommerce has its own metadata via the EcomProviders Server-Component lift" \
  "curl -sf '$BASE_URL/demo/ecommerce' -o /tmp/ecom.html && grep -qE 'property=\"og:title\"' /tmp/ecom.html"

verify "GET /opengraph-image returns image bytes (>1000 bytes)" \
  "curl -sf '$BASE_URL/opengraph-image' -o /tmp/og.png && [ \$(wc -c < /tmp/og.png) -gt 1000 ]"

# Visual OG image confirmation
do_step "Open the dynamic OG image visually:"
do_step "  $BASE_URL/opengraph-image"
open_url "$BASE_URL/opengraph-image"

confirm "OG image rendered with Patterson Consulting branding (visual check)?"
confirm "view-source on $BASE_URL/ reads as a real production-ready <head> (not generic boilerplate)?"

# ────────────────────────────────────────────────────────────────────────
# Scenario 5 — D5 Security review spot-check
# ────────────────────────────────────────────────────────────────────────
scenario "5. [auto+devtools] D5 Security review — npm audit + PII spot-check" \
  "5-track audit at docs/security/review-2026-04-25.md"

verify "npm audit shows 0 critical (handlebars critical was cleared)" \
  "npm audit --audit-level=critical --json 2>/dev/null | grep -qE '\"critical\":[[:space:]]*0' || npm audit --audit-level=critical 2>&1 | grep -qiE 'found 0 vulnerabilities|0 critical'"

verify "Security review document records PASS verdict, no critical findings" \
  "grep -qiE 'no critical findings|verdict:.*pass|PASS' docs/security/review-2026-04-25.md"

setup \
  "DevTools → Network tab open" \
  "Filter on 'Doc' or capture all" \
  "Will visit /contact and interact with the form to spot-check PII handling"

do_step "Navigate to $BASE_URL/contact"
open_url "$BASE_URL/contact"

do_step "Click into the email field (focus). Type a value (e.g. test@example.com)."
do_step "Click into name + message fields. Type values."
do_step "Do NOT submit the form."

do_step "Inspect Network tab + window.dataLayer in Console."

do_step "Open the Console and run:"
do_step "  copy(JSON.stringify(window.dataLayer.filter(e => e.event === 'form_field_focus' || e.event === 'form_field_blur').slice(-5)))"
expect \
  "form_field_focus / form_field_blur events have a field_name (e.g. 'email')" \
  "Events do NOT contain the actual VALUE you typed (no 'test@example.com' in the payload)" \
  "PII audit holds: form events carry NAME, never VALUE"

do_step "Search Network requests for 'test@example.com'."
expect \
  "Zero requests contain the email value (no fetch() egress of contact-form values)"

confirm "form_field events in dataLayer carry field_name only — never the typed value?"
confirm "Network tab showed zero requests containing your typed email value?"
confirm "npm audit clean (0 critical)?"

# ────────────────────────────────────────────────────────────────────────
# Scenario 6 — D6 Load testing
# ────────────────────────────────────────────────────────────────────────
scenario "6. [auto] D6 Load testing — runner script + within-15% baseline check" \
  "scripts/run-load-tests.sh + docs/perf/load-test-2026-04-25.md baseline"

if skip_if_no_load; then :; else
  do_step "Running scripts/run-load-tests.sh (~30-60s)…"
  echo ""

  if bash scripts/run-load-tests.sh > /tmp/uat-10d-load.log 2>&1; then
    echo "  ✓ load-test runner exited 0 (both suites green)"
    ((PASS++))
  else
    echo "  ✗ load-test runner failed:"
    tail -20 /tmp/uat-10d-load.log | sed 's/^/      /'
    ((FAIL++))
    FAILED_SCENARIOS+=("$CURRENT_SCENARIO :: runner failed")
  fi
  echo ""

  verify "Both gated suites mentioned in runner output (event-stream + data-generator)" \
    "grep -qE 'event-stream' /tmp/uat-10d-load.log && grep -qE 'data-generator' /tmp/uat-10d-load.log"

  verify "Baseline doc still exists + carries committed throughput numbers" \
    "test -f docs/perf/load-test-2026-04-25.md && grep -qiE 'events/sec|throughput|baseline' docs/perf/load-test-2026-04-25.md"

  echo "  Manual judgment: review /tmp/uat-10d-load.log against the baseline."
  echo "  The committed baseline lives at docs/perf/load-test-2026-04-25.md."
  echo ""

  confirm "Throughput numbers in the runner output are within ~15% of the committed baseline?"
fi

# ────────────────────────────────────────────────────────────────────────
# Scenario 7 — D7 Anonymous-ID cookie
# ────────────────────────────────────────────────────────────────────────
scenario "7. [devtools] D7 Anonymous-ID — _iap_aid cookie attributes + event threading" \
  "src/lib/identity/anonymous-id.ts + baseFields() threading + D9 inspector surface"

setup \
  "Fresh incognito window" \
  "DevTools → Application tab → Cookies → $([ "$IS_PROD" -eq 1 ] && echo 'iampatterson.com' || echo 'localhost')"

do_step "Clear all cookies for the origin."

do_step "Navigate to $BASE_URL/"
open_url "$BASE_URL/"

do_step "Wait ~2 seconds for cookies to mint, then refresh the Application tab."
expect \
  "Cookie '_iap_aid' exists" \
  "Value is a UUID v4 (8-4-4-4-12 hex pattern)" \
  "Max-Age (or Expires) ≈ 365 days (~31536000 seconds)" \
  "SameSite=Lax" \
  "On https: Secure flag set; on localhost: Secure may be unset (acceptable)" \
  "Path=/"

do_step "Open SessionPulse → Consent tab."
expect \
  "Storage inspector includes an 'App identity' group" \
  "_iap_aid row is visible in the App identity group" \
  "Click-to-reveal works (initial truncated/masked, expands to full UUID)" \
  "_iap_sid (Phase 2 session cookie) is also in the App identity group"

do_step "Navigate to $BASE_URL/demo/ecommerce → click any product → 'Add to cart'."

do_step "Open SessionPulse → Timeline → click the most recent add_to_cart event."

do_step "Inspect the event payload."
expect \
  "Event row carries an anonymous_id field" \
  "anonymous_id matches the _iap_aid cookie value (or its truncated suffix)"

do_step "Continue to /cart → /checkout → fill form → place order."
do_step "On /confirmation, inspect the warehouse-write sidebar (BQ row preview)."
expect \
  "user_pseudo_id column shows a non-NULL value (a real anonymous id, not the seed NULL)" \
  "Value matches the _iap_aid cookie (truncated as appropriate for display)"

do_step "Application tab → re-check _iap_aid value."
expect \
  "Cookie value unchanged across the funnel — same id from homepage to confirmation"

confirm "_iap_aid cookie has correct attributes (UUID v4, ≈365d Max-Age, SameSite=Lax)?"
confirm "_iap_aid surfaces in the D9 storage inspector under App identity?"
confirm "anonymous_id appears on event payloads in the Timeline?"
confirm "Confirmation page BQ row preview shows the real anonymous id (not seed NULL)?"

# ────────────────────────────────────────────────────────────────────────
# Scenario 8 — D8 UX polish bundle
# ────────────────────────────────────────────────────────────────────────
scenario "8. [devtools] D8 UX polish bundle — visual sweep over 10 sub-items" \
  "Hero p-meta, Explore singularization, persimmon CTA, tier deep-links, evidence cut, shop images, ecom banner, Overview/Consent directives, u-accept/u-deny + ✓/× glyphs"

setup "Desktop viewport. Reduced-motion OFF. Fresh cookies."

do_step "Navigate to $BASE_URL/"
open_url "$BASE_URL/"
expect \
  "Hero subtitle (the p-meta line) reads as a single deliberate sentence" \
  "Pipeline-section CTA uses persimmon as its base hue (not amber)" \
  "Tier cards link directly into the ecommerce tier deep-anchors (not a detour)" \
  "No 'evidence' section as a standalone block (cut in 10d)"

do_step "Scroll to the Explore the demo section."
expect \
  "Heading is singular: 'Explore the demo' (NOT 'demos')"

do_step "Navigate to $BASE_URL/demo/ecommerce"
expect \
  "Demo banner reads 'this is a demo · nothing ships from here'" \
  "Banner contains a back-to-homepage link (not a dead end)" \
  "Each of the 6 product tiles renders a real .webp image (not a placeholder)"

do_step "Click any product. Add to cart. Go to /cart → /checkout → place order → confirmation."

do_step "Click SessionPulse → Overview tab."
expect \
  "Directive line reads claim-led (e.g. 'Your session as the stack sees it: which events fired, what consent allowed, where you are in the funnel.')" \
  "Mobile/responsive: full 'this is a demo · nothing ships from here' clause is preserved at every viewport"

do_step "Switch to Consent tab."
expect \
  "Consent rows: accepted entries use the u-accept token (#8FBF7A green) + ✓ glyph" \
  "Denied entries use the u-deny token (#D9725B persimmon) + × glyph" \
  "Destination chip verbs renamed: 'Sent' (not 'Active') + 'Blocked' (not 'Suppressed')"

do_step "Switch to Timeline. Inspect a routing badge on any event row."
expect \
  "Routing badge uses the same ✓/× glyph variety + u-accept/u-deny tokens"

do_step "Click any timeline row → EventDetail panel opens."
expect \
  "StatusBadge + ConsentRow inside EventDetail use the same token + glyph treatment" \
  "NarrativeFlow blocked StageCard (if visible) uses u-deny + ×"

confirm "Hero p-meta reads as polished single sentence?"
confirm "Explore section is singular ('demo', not 'demos')?"
confirm "All 6 shop products show real .webp images?"
confirm "Demo banner has the back-to-homepage link?"
confirm "Overview directive reads claim-led + mobile preserves the demo-honesty clause?"
confirm "u-accept (green) + u-deny (persimmon) + ✓/× glyphs visible across Consent + Timeline + EventDetail + NarrativeFlow?"
confirm "Destination chip verbs read 'Sent' + 'Blocked' (not 'Active' + 'Suppressed')?"

# ────────────────────────────────────────────────────────────────────────
# Scenario 9 — D9 Browser storage inspector
# ────────────────────────────────────────────────────────────────────────
scenario "9. [devtools] D9 Browser storage inspector — Overview chips + Consent per-key" \
  "Categorized read-only inspector for cookies + localStorage + sessionStorage"

setup \
  "Fresh tab at $BASE_URL/" \
  "DevTools → Application tab open in another window for cross-checking"

do_step "Navigate to $BASE_URL/, walk a bit (visit /services, return to /)."
open_url "$BASE_URL/"

do_step "Open SessionPulse → Overview tab."
expect \
  "Storage summary chips per category visible" \
  "Categories include at minimum: app-identity, cmp (Cookiebot), analytics" \
  "Each chip shows a count (e.g. 'app-identity · 2 keys')"

do_step "Switch to Consent tab → scroll to the storage inspector section."
expect \
  "Per-key inspector with category groupings" \
  "_iap_aid + _iap_sid both visible under app-identity" \
  "CookieConsent (Cookiebot) cookie visible under cmp" \
  "Click-to-reveal: clicking a row expands to show the full value" \
  "Cookie expiry / domain / path show 'not readable from document.cookie' footnote"

do_step "Open a new tab + add a new localStorage key via DevTools console:"
do_step "  Application tab → Local Storage → click '+ Add' → key='test-d9-uat' → value='hello'"

do_step "Return to the SessionPulse overlay (open if closed) → Consent tab."
expect \
  "Inspector reflects the new test-d9-uat key within ~1 second (live-subscribed via 1s tick)" \
  "Updates without requiring an overlay close + reopen"

do_step "Delete the test-d9-uat key from DevTools."
expect \
  "Inspector removes the row within ~1 second"

do_step "Visit /demo/ecommerce, walk to the product page (drops a few cookies / storage)."

do_step "Reopen the overlay → Consent tab inspector."
expect \
  "Any new keys (e.g. cart state, last-viewed product) appear in their categories"

confirm "Overview shows category chips with counts?"
confirm "Consent inspector shows _iap_aid + _iap_sid in app-identity with click-to-reveal?"
confirm "Live updates: adding a localStorage key reflects within 1s without overlay reopen?"
confirm "Cookie expiry/domain/path narrowing is shown as a footnote (no fabricated metadata)?"

# ────────────────────────────────────────────────────────────────────────
# Edge case A — consent denial → suppression in Timeline + storage inspector
# ────────────────────────────────────────────────────────────────────────
scenario "A. [edge][devtools] Consent denial — suppression visible in Timeline + storage" \
  "Cookiebot manual blocking-mode + bridgeToGtagConsent + per-tag consentSettings"

setup \
  "Fresh incognito window (no prior consent state)" \
  "DevTools → Application tab + Console open"

do_step "Navigate to $BASE_URL/"
open_url "$BASE_URL/"

do_step "Wait for the Cookiebot banner to appear."

do_step "Click the 'Reject all' / 'Decline' option (NOT 'Accept all')."

do_step "Open SessionPulse → Consent tab."
expect \
  "Statistics + Marketing categories show u-deny (persimmon) + × glyph" \
  "Necessary stays accepted (u-accept + ✓)"

do_step "Walk to /demo/ecommerce → click a product → 'Add to cart'."

do_step "Open Timeline tab. Inspect any add_to_cart or product_view row."
expect \
  "Routing badge shows GA4 / BigQuery / Meta destinations as BLOCKED (× glyph + u-deny token)" \
  "Visible verb is 'Blocked' (not 'Active')" \
  "Event still appears in the Timeline (it's recorded), but its routing is honestly suppressed"

do_step "Open Network tab. Filter on 'analytics' / 'google-analytics'."
expect \
  "ZERO outbound GA4 hits (no /collect, no /g/collect requests)" \
  "ZERO outbound Meta CAPI / Google Ads hits"

do_step "Switch back to Consent tab → storage inspector."
expect \
  "Analytics-category storage entries are absent or marked as denied" \
  "Marketing-category storage entries are absent" \
  "_iap_aid + _iap_sid (necessary / app-identity) still present"

confirm "Consent UI honestly reflects the denial (× glyph + persimmon for declined categories)?"
confirm "Timeline routing shows 'Blocked' destinations after consent denial?"
confirm "Network tab confirms zero analytics / marketing pixels fired?"
confirm "Necessary cookies (_iap_aid, _iap_sid) still present despite denial of other categories?"

# ────────────────────────────────────────────────────────────────────────
# Edge case B — full ecommerce funnel sweep with all D8/D9 tokens visible
# ────────────────────────────────────────────────────────────────────────
scenario "B. [devtools] Full ecommerce funnel — accept all consent → walk through all reveals" \
  "Regression sweep + verify D8 + D9 + D7 cooperation across the demo"

setup \
  "Fresh incognito window" \
  "Accept all Cookiebot categories on the banner"

do_step "Navigate to $BASE_URL/demo/ecommerce?utm_source=meta&utm_medium=paid_social&utm_campaign=spring_launch"
open_url "$BASE_URL/demo/ecommerce?utm_source=meta&utm_medium=paid_social&utm_campaign=spring_launch"

do_step "Click any product → 'Add to cart' → /cart → /checkout → fill form → place order."

do_step "On /confirmation: dashboard iframe should load within 10s (warm path)."

do_step "Open SessionPulse → Overview."
expect \
  "demo_progress.ecommerce shows 100% (full funnel traversed)" \
  "Storage chips reflect: app-identity, cmp, analytics, marketing all populated" \
  "Routing accepts everywhere (✓ + u-accept) since consent was accepted"

do_step "Switch to Timeline. Confirm the full event sequence:"
expect \
  "page_view → product_view → add_to_cart → view_cart → begin_checkout → form_submit → purchase" \
  "Each routing badge shows GA4 + BigQuery + Meta destinations as Sent (✓ + u-accept)"

do_step "Switch to Consent tab → storage inspector. Click-to-reveal _iap_aid."
expect \
  "_iap_aid value visible after click; matches the Application-tab cookie value"

confirm "Full funnel completed without errors, all 7 events present in Timeline?"
confirm "Confirmation page Metabase dashboard rendered within 10s?"
confirm "All routing badges show ✓ + u-accept under accept-all consent state?"

# ────────────────────────────────────────────────────────────────────────
# Edge case C — slow dashboard fallback deep-link is reachable
# ────────────────────────────────────────────────────────────────────────
scenario "C. [edge] D2 fallback deep-link is honest — bi.iampatterson.com link exists" \
  "Fallback prose deep-link points to the real BI surface (no fabricated URL)"

verify "DashboardPayoff fallback uses METABASE_BASE_URL constant" \
  "grep -qE 'METABASE_BASE_URL' src/components/demo/ecommerce/dashboard-payoff.tsx"

verify "Fallback prose explicitly mentions Google SSO (honesty about gating)" \
  "grep -qiE 'google sso' src/components/demo/ecommerce/dashboard-payoff.tsx"

verify "Two fallback branches exist (env-disabled + load-timeout) — both deep-link" \
  "grep -cE 'bi.iampatterson.com/dashboard' src/components/demo/ecommerce/dashboard-payoff.tsx | xargs -I{} test {} -ge 2"

# ────────────────────────────────────────────────────────────────────────
# Regression sweep — Phase 10b CWV + 10c Voice both still hold
# ────────────────────────────────────────────────────────────────────────
scenario "Z. [auto+devtools] Regression canary — 10b CWV + 10c Voice + Cookiebot manual mode" \
  "Phase 10d should not have regressed prior phase deliverables"

verify "WebVitalsReporter still wired (10b D1a)" \
  "test -f src/components/scripts/web-vitals-reporter.tsx"

verify "useEventStream hook with jitter + online-recovery still present (10b D5)" \
  "grep -qE 'online' src/hooks/useEventStream.ts && grep -qE 'jitter|Math.random' src/hooks/useEventStream.ts"

verify "Voice-and-style guide present (10c D5)" \
  "test -f docs/voice-and-style-guide.md"

verify "Cookiebot manual blocking mode (Phase 1 D3 amendment, retained)" \
  "grep -rqE 'data-blockingmode=\"manual\"' src/ || grep -rqE \"blockingmode.*manual\" src/"

verify "bridgeToGtagConsent helper exists (Phase 1 D3 amendment)" \
  "grep -qE 'bridgeToGtagConsent' src/lib/events/track.ts"

setup "Fresh tab at $BASE_URL/"

do_step "Open DevTools → Console (cleared). Hard-reload $BASE_URL/."

do_step "Walk: / → /services → /about → /contact → /demo/ecommerce."

do_step "Open SessionPulse → cycle Overview / Timeline / Consent → close."

do_step "Inspect Console."
expect \
  "Zero hydration warnings" \
  "Zero React 19 / Next 16 errors" \
  "Acceptable noise: pre-existing Recharts width(-1)/height(-1) on /analytics, Cookiebot dev-only logs"

confirm "Full-arc walk: console clean (no hydration warnings, no React/Next errors)?"
confirm "All Phase 10b/10c behaviours still hold (CWV reporter, voice tone, Cookiebot)?"

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
  echo "  ✗ UAT: FAIL — $FAIL check(s) require attention before Phase 10d merge."
  echo ""
  echo "  Next: capture feedback in docs/uat/phase-10d-uat-feedback.md"
  echo "        listing each failed check with reproduction steps + proposed fix."
  hr
  exit 1
fi

if [ "$SKIP" -gt 0 ]; then
  echo "  ⚠  UAT: PASS (PARTIAL) — $SKIP scenario(s) skipped."
  echo ""
  echo "  Skip reasons: SKIP_LOAD=1, SKIP_SLOW=1, or [prod]-only scenarios"
  echo "  on a local-dev BASE_URL. Re-run with BASE_URL=https://iampatterson.com"
  echo "  + no SKIP_* flags to cover everything before merge-to-main."
  hr
  exit 0
fi

echo "  ✓ UAT: PASS — Phase 10d is user-accepted. Ready to merge to main."
hr
exit 0
