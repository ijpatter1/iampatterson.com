#!/usr/bin/env bash
#
# Phase 9B, User Acceptance Testing
#
# Runs end-to-end scenarios that exercise deliverables 6a + 6b + 7 together.
# Uses `verify` for automated HTTP/grep checks and `confirm` for visual/
# interactive checks that require human judgment.
#
# Usage:
#   bash docs/uat/phase-9b-uat.sh              # full suite (env vars must be set)
#   bash docs/uat/phase-9b-uat.sh --missing-env   # Scenario 5 only (env vars unset)
#
# Prerequisites:
#   - Dev server running: `npm run dev` on port 3000 in a separate shell.
#   - .env.local has MB_EMBEDDING_SECRET_KEY + METABASE_EMBED_CONFIG set
#     (except when running with --missing-env).
#   - Operator SSO access to https://bi.iampatterson.com/ for Scenario 4.

set -u  # unset-var guard; we handle failures ourselves rather than set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
METABASE_URL="${METABASE_URL:-https://bi.iampatterson.com}"

PASS=0
FAIL=0
SKIP=0
FAILED_SCENARIOS=()

MODE="full"
if [[ "${1:-}" == "--missing-env" ]]; then
  MODE="missing-env"
fi

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

scenario() {
  echo ""
  echo "════════════════════════════════════════════════════════════════════"
  echo "  Scenario $1, $2"
  echo "════════════════════════════════════════════════════════════════════"
}

verify() {
  # verify <description> <command> [expected-exit-code=0]
  local desc="$1"
  local cmd="$2"
  local expected="${3:-0}"
  echo -n "  verify: $desc ... "
  eval "$cmd" >/tmp/uat-9b.out 2>&1
  local actual=$?
  if [[ "$actual" == "$expected" ]]; then
    echo "✓"
    ((PASS++))
  else
    echo "✗ (exit $actual, expected $expected)"
    echo "    --- output ---"
    sed 's/^/    /' /tmp/uat-9b.out | head -20
    echo "    ---"
    ((FAIL++))
    FAILED_SCENARIOS+=("$desc")
  fi
}

confirm() {
  # confirm <prompt> [label]
  local prompt="$1"
  local label="${2:-$1}"
  echo ""
  echo "  → $prompt"
  read -r -p "  Pass? [Y/n] " -n 1 REPLY
  echo ""
  if [[ "$REPLY" =~ ^[Nn]$ ]]; then
    echo "  ✗ FAIL: $label"
    ((FAIL++))
    FAILED_SCENARIOS+=("$label")
  else
    echo "  ✓ pass"
    ((PASS++))
  fi
}

skip() {
  echo "  ⊘ skip: $1"
  ((SKIP++))
}

# Decode the second segment (payload) of a JWT from stdin; pads base64url
# with '=' as needed. Requires `jq`.
decode_jwt_payload() {
  local token="$1"
  local payload
  payload="$(echo -n "$token" | cut -d. -f2)"
  # pad base64url
  local padding=$(( (4 - ${#payload} % 4) % 4 ))
  payload="${payload}$(printf '=%.0s' $(seq 1 $padding))"
  # convert base64url → base64
  echo -n "$payload" | tr '_-' '/+' | base64 -d 2>/dev/null
}

echo "Phase 9B UAT, mode: $MODE"
echo "Base URL:      $BASE_URL"
echo "Metabase URL:  $METABASE_URL"

# -----------------------------------------------------------------------------
# Prerequisites check
# -----------------------------------------------------------------------------

echo ""
echo "Prerequisites..."
verify "dev server reachable at $BASE_URL" \
  "curl -sSf -o /dev/null $BASE_URL"

if [[ "$MODE" == "missing-env" ]]; then
  echo ""
  echo "  Running Scenario 5 only (env vars intentionally missing)."
  echo "  Ensure your dev server was started WITHOUT"
  echo "  MB_EMBEDDING_SECRET_KEY or METABASE_EMBED_CONFIG set."
  confirm "Dev server was restarted with env vars cleared" \
    "Missing-env preflight"
  # Jump directly to Scenario 5 below via flag check
fi

# -----------------------------------------------------------------------------
# Scenario 1, Organic E-Commerce Funnel Ends in Live BI
# -----------------------------------------------------------------------------

if [[ "$MODE" == "full" ]]; then
  scenario 1 "Organic E-Commerce Funnel Ends in Live BI"
  verify "GET /demo/ecommerce returns 200 with product listing" \
    "curl -sS $BASE_URL/demo/ecommerce | grep -q -i 'tuna\\|product'"
  confirm "Walk /demo/ecommerce → pick a product → add to cart → checkout → submit; URL lands on /demo/ecommerce/confirmation?order_id=ORD-… (NOT ORD-T3-DEMO)" \
    "Organic checkout funnel completes"
  confirm "Order details block shows the correct random order ID, total, and item count matching what you purchased" \
    "Order details reflect organic purchase"
  confirm "Three Metabase iframes appear below order details in order: daily revenue → funnel → AOV" \
    "Three iframes render in narrative order"
  confirm "Each iframe shows 'Querying BigQuery…' placeholder that fades out as the chart paints (not a pop)" \
    "Loading placeholders fade smoothly"
  confirm "All three charts display actual data (bars/lines visible, non-empty axes); no 'No data' or error states" \
    "Charts render with live data"
  confirm "AOV caption interpolates the organic order's dollar total (not \$44.98)" \
    "AOV caption uses organic order total"
  confirm "Narrative copy reads hedged: 'The checkout funnel fires purchase events…' + 'Orders like yours roll into this bar…' (NOT 'this event just fired' or 'your order is in there')" \
    "Copy uses path-agnostic hedge"
fi

# -----------------------------------------------------------------------------
# Scenario 2, Services Cross-Link to Tier 3 Confirmation
# -----------------------------------------------------------------------------

if [[ "$MODE" == "full" ]]; then
  scenario 2 "Services Cross-Link to Tier 3 Confirmation"
  verify "GET /services returns 200" \
    "curl -sS -o /dev/null -w '%{http_code}' $BASE_URL/services | grep -q 200"
  verify "/services HTML contains Tier 2 See-it-live link → /demo/ecommerce" \
    "curl -sS $BASE_URL/services | grep -qE 'href=\"/demo/ecommerce\"[^>]*>.*See it live'"
  verify "/services HTML contains Tier 3 See-it-live link → confirmation with seeded ORD-T3-DEMO params" \
    "curl -sS $BASE_URL/services | grep -q 'order_id=ORD-T3-DEMO&total=44\\.98&items=2'"
  confirm "Browser: on /services, Tier 2 and Tier 3 summary boxes each show an accent-colored 'See it live →' link" \
    "Tier 2/3 See-it-live links visible in summary boxes"
  confirm "Click Tier 3 'See it live →'; URL loads /demo/ecommerce/confirmation?order_id=ORD-T3-DEMO&total=44.98&items=2" \
    "Tier 3 cross-link navigates correctly"
  confirm "Order details block shows: Order confirmed · ORD-T3-DEMO, Items 2, Total \$44.98" \
    "Seeded order details display"
  confirm "AOV caption interpolates specifically '\$44.98' (visible in caption text)" \
    "AOV caption names \$44.98"
  confirm "Copy does NOT claim 'a purchase event just fired', hedged wording holds for Services arrivals" \
    "Services-path copy doesn't overclaim"
fi

# -----------------------------------------------------------------------------
# Scenario 3, Overlay Dashboards Tab Deep-Links to IAP-Gated Questions
# -----------------------------------------------------------------------------

if [[ "$MODE" == "full" ]]; then
  scenario 3 "Overlay Dashboards Tab Deep-Links"
  verify "Confirmation HTML contains question/42 deep-link" \
    "curl -sS '$BASE_URL/demo/ecommerce/confirmation?order_id=ORD-T3-DEMO&total=44.98&items=2' | grep -q 'question/42'"
  verify "Confirmation HTML contains question/43 deep-link" \
    "curl -sS '$BASE_URL/demo/ecommerce/confirmation?order_id=ORD-T3-DEMO&total=44.98&items=2' | grep -q 'question/43'"
  verify "Confirmation HTML contains question/44 deep-link" \
    "curl -sS '$BASE_URL/demo/ecommerce/confirmation?order_id=ORD-T3-DEMO&total=44.98&items=2' | grep -q 'question/44'"
  verify "Confirmation HTML contains /dashboard/2 full-dashboard link" \
    "curl -sS '$BASE_URL/demo/ecommerce/confirmation?order_id=ORD-T3-DEMO&total=44.98&items=2' | grep -q '/dashboard/2'"
  confirm "Browser: on confirmation page, open the overlay; navigate to the Dashboards tab. A 'Three more reports behind IAP' section appears" \
    "Three-more-reports section appears on confirmation route only"
  confirm "Section lists ROAS by campaign, Revenue share by channel, Customer LTV distribution as card deep-links labeled 'IAP ↗'" \
    "Three non-embeddable cards labeled with IAP affordance"
  confirm "Section copy explicitly warns about the Google SSO gate BEFORE the click ('Google SSO wall', 'reach out for a walkthrough')" \
    "IAP warning copy present pre-click"
  confirm "Click one deep-link, new tab opens, redirects to accounts.google.com SSO challenge (as expected)" \
    "Deep-link routes through IAP"
  confirm "Open the overlay on /demo/ecommerce (NOT confirmation); the 'Three more reports' section does NOT appear" \
    "Section is route-gated to confirmation only"
fi

# -----------------------------------------------------------------------------
# Scenario 4, Live Metabase Dashboard Reflects Applied Spec
# -----------------------------------------------------------------------------

if [[ "$MODE" == "full" ]]; then
  scenario 4 "Live Metabase Dashboard Reflects Applied Spec"
  # Unauthenticated API call should hit IAP; expect 302 or 401/403, NOT 200
  verify "Unauthenticated GET ${METABASE_URL}/api/dashboard/2 does NOT return 200 (IAP gate active)" \
    "[[ \$(curl -sS -o /dev/null -w '%{http_code}' ${METABASE_URL}/api/dashboard/2) != '200' ]]"
  confirm "Browser: navigate to ${METABASE_URL}/dashboard/2, complete SSO as the operator. Dashboard 'E-Commerce Executive' loads" \
    "Dashboard loads for allowlisted operator"
  confirm "Dashboard shows exactly six cards: Funnel conversion by channel, AOV trend 90d, ROAS by campaign, Revenue share by channel, Customer LTV distribution, Daily revenue trend 30d" \
    "All six cards present"
  confirm "Every card renders real data (charts populated, no 'ask filter' prompts blocking the view)" \
    "Cards render with live mart data"
  confirm "In Metabase admin: cards 40 (funnel), 41 (AOV), 45 (daily revenue) show 'Enabled' under Public embed, the other three do not" \
    "Embedding flags match spec"
fi

# -----------------------------------------------------------------------------
# Scenario 5, Missing Env Vars Trigger Fallback Block
# -----------------------------------------------------------------------------

if [[ "$MODE" == "missing-env" ]]; then
  scenario 5 "Missing Env Vars Trigger Fallback Block"
  verify "GET confirmation returns 200 (not 500) without env vars" \
    "curl -sS -o /dev/null -w '%{http_code}' '$BASE_URL/demo/ecommerce/confirmation?order_id=ORD-T3-DEMO&total=44.98&items=2' | grep -q 200"
  verify "Response HTML contains NO iframe pointing at bi.iampatterson.com/embed/" \
    "! curl -sS '$BASE_URL/demo/ecommerce/confirmation?order_id=ORD-T3-DEMO&total=44.98&items=2' | grep -q 'bi.iampatterson.com/embed/'"
  verify "Response HTML DOES contain a link to /dashboard/2 (fallback)" \
    "curl -sS '$BASE_URL/demo/ecommerce/confirmation?order_id=ORD-T3-DEMO&total=44.98&items=2' | grep -q 'bi.iampatterson.com/dashboard/2'"
  confirm "Browser: visible fallback block with 'Live embeds offline' kicker appears where the three iframes would otherwise be" \
    "Fallback block renders with clear kicker"
  confirm "Fallback copy warns about the Google SSO wall before clicking the dashboard link" \
    "Fallback copy carries IAP-gate warning"
  confirm "Fallback link opens ${METABASE_URL}/dashboard/2 in a new tab" \
    "Fallback link target correct"
  confirm "Order details block + overlay Dashboards-tab 'Three more reports' section still render normally" \
    "Fallback is scoped to inline-embed region only"
fi

# -----------------------------------------------------------------------------
# Scenario 6, Signed JWT Rotates Per Request, 10-Minute Expiry
# -----------------------------------------------------------------------------

if [[ "$MODE" == "full" ]]; then
  scenario 6 "Signed JWT Rotates + 10-Minute Expiry"

  HTML_1="$(curl -sS "$BASE_URL/demo/ecommerce/confirmation?order_id=ORD-T3-DEMO&total=44.98&items=2")"
  TOKENS_1="$(echo "$HTML_1" | grep -oE 'embed/question/[A-Za-z0-9._-]+' | sed 's|embed/question/||' | head -3)"
  TOKEN_COUNT_1="$(echo "$TOKENS_1" | wc -l | tr -d ' ')"
  verify "First request extracts 3 JWT tokens from iframe srcs" \
    "[[ '$TOKEN_COUNT_1' == '3' ]]"

  FIRST_TOKEN="$(echo "$TOKENS_1" | head -1)"
  HEADER="$(echo -n "$FIRST_TOKEN" | cut -d. -f1)"
  # Pad base64url
  HEADER_PADDED="$HEADER$(printf '=%.0s' $(seq 1 $(( (4 - ${#HEADER} % 4) % 4 )) ))"
  ALG="$(echo -n "$HEADER_PADDED" | tr '_-' '/+' | base64 -d 2>/dev/null | python3 -c 'import json,sys; print(json.loads(sys.stdin.read()).get("alg",""))' 2>/dev/null)"
  verify "First JWT header alg = HS256" \
    "[[ '$ALG' == 'HS256' ]]"

  PAYLOAD="$(decode_jwt_payload "$FIRST_TOKEN")"
  EXP="$(echo "$PAYLOAD" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read()).get("exp",0))' 2>/dev/null)"
  NOW="$(date +%s)"
  DIFF=$(( EXP - NOW ))
  verify "JWT exp is ~600s from now (actual: ${DIFF}s, expected 570-630)" \
    "[[ '$DIFF' -ge 570 && '$DIFF' -le 630 ]]"

  # Second request, assert tokens differ
  sleep 1
  HTML_2="$(curl -sS "$BASE_URL/demo/ecommerce/confirmation?order_id=ORD-T3-DEMO&total=44.98&items=2")"
  TOKENS_2="$(echo "$HTML_2" | grep -oE 'embed/question/[A-Za-z0-9._-]+' | sed 's|embed/question/||' | head -3)"
  verify "Second request produces at least one different JWT (not cached across requests)" \
    "[[ \"\$(echo -n \"$TOKENS_1\" | md5sum)\" != \"\$(echo -n \"$TOKENS_2\" | md5sum)\" ]]"
fi

# -----------------------------------------------------------------------------
# Scenario 7, Iframe Security + Accessibility Attributes
# -----------------------------------------------------------------------------

if [[ "$MODE" == "full" ]]; then
  scenario 7 "Iframe Security + A11y Attributes"
  HTML="$(curl -sS "$BASE_URL/demo/ecommerce/confirmation?order_id=ORD-T3-DEMO&total=44.98&items=2")"

  IFRAME_COUNT="$(echo "$HTML" | grep -oE '<iframe[^>]*>' | wc -l | tr -d ' ')"
  verify "Three iframe elements on the confirmation page" \
    "[[ '$IFRAME_COUNT' == '3' ]]"

  REFERRER_COUNT="$(echo "$HTML" | grep -oE '<iframe[^>]*referrerpolicy="no-referrer"' | wc -l | tr -d ' ')"
  verify "All 3 iframes carry referrerpolicy=\"no-referrer\"" \
    "[[ '$REFERRER_COUNT' == '3' ]]"

  LAZY_COUNT="$(echo "$HTML" | grep -oE '<iframe[^>]*loading="lazy"' | wc -l | tr -d ' ')"
  verify "All 3 iframes carry loading=\"lazy\"" \
    "[[ '$LAZY_COUNT' == '3' ]]"

  TITLE_COUNT="$(echo "$HTML" | grep -oE '<iframe[^>]*title="[^"]+"' | wc -l | tr -d ' ')"
  verify "All 3 iframes carry a title attribute" \
    "[[ '$TITLE_COUNT' == '3' ]]"

  TABINDEX_NEG="$(echo "$HTML" | grep -oE '<iframe[^>]*tabindex="-1"' | wc -l | tr -d ' ')"
  verify "Iframes rendered with tabindex=\"-1\" (out of tab order while loading)" \
    "[[ '$TABINDEX_NEG' == '3' ]]"

  confirm "Browser: load confirmation, immediately Tab repeatedly from top, focus does not jump into an invisible iframe before placeholders fade" \
    "Keyboard tab order skips invisible iframes"
  confirm "After charts load, iframe content is reachable via normal Tab navigation (no focus trap)" \
    "Loaded iframes rejoin tab order"
fi

# -----------------------------------------------------------------------------
# Scenario 8, Seeded Order-Total Interpolation is Dynamic + Defensive
# -----------------------------------------------------------------------------

if [[ "$MODE" == "full" ]]; then
  scenario 8 "AOV Caption Order-Total Interpolation"
  verify "\$44.98 appears in the AOV caption for seeded cross-link total" \
    "curl -sS '$BASE_URL/demo/ecommerce/confirmation?order_id=ORD-T3-DEMO&total=44.98&items=2' | grep -qE 'Your order was \\\$44\\.98'"
  verify "Interpolation is dynamic: \$199.99 appears in AOV caption when total=199.99" \
    "curl -sS '$BASE_URL/demo/ecommerce/confirmation?order_id=ORD-T3-DEMO&total=199.99&items=2' | grep -qE 'Your order was \\\$199\\.99'"
  verify "Missing total param returns 200 (no crash)" \
    "curl -sS -o /dev/null -w '%{http_code}' '$BASE_URL/demo/ecommerce/confirmation?order_id=ORD-T3-DEMO&items=2' | grep -q 200"
  verify "Missing total does NOT render \$NaN or \$undefined in HTML" \
    "! curl -sS '$BASE_URL/demo/ecommerce/confirmation?order_id=ORD-T3-DEMO&items=2' | grep -qE '\\\$NaN|\\\$undefined'"
  verify "Non-numeric total sanitized to \$0.00 (no \$notanumber leakage)" \
    "curl -sS '$BASE_URL/demo/ecommerce/confirmation?order_id=ORD-T3-DEMO&total=notanumber&items=2' | grep -q '\\\$0\\.00'"
  verify "Negative total also sanitized to \$0.00" \
    "curl -sS '$BASE_URL/demo/ecommerce/confirmation?order_id=ORD-T3-DEMO&total=-100&items=2' | grep -q '\\\$0\\.00'"
fi

# -----------------------------------------------------------------------------
# Cross-Scenario Regression Check
# -----------------------------------------------------------------------------

if [[ "$MODE" == "full" ]]; then
  scenario "R" "Regression sweep"
  verify "npm test passes with 673 tests (or more)" \
    "npm test --silent 2>&1 | grep -qE 'Tests:[[:space:]]+(67[3-9]|6[89][0-9]|7[0-9]{2})+ passed'"
  verify "npm run build exits clean" \
    "npm run build >/tmp/uat-9b-build.log 2>&1"
  verify "GET / returns 200 (homepage not regressed)" \
    "curl -sS -o /dev/null -w '%{http_code}' $BASE_URL/ | grep -q 200"
  verify "GET /services returns 200" \
    "curl -sS -o /dev/null -w '%{http_code}' $BASE_URL/services | grep -q 200"
  verify "GET /demo/ecommerce returns 200" \
    "curl -sS -o /dev/null -w '%{http_code}' $BASE_URL/demo/ecommerce | grep -q 200"
  confirm "Open overlay for the first time in a fresh browser session on the confirmation page, phosphor amber CRT boot plays once" \
    "Once-per-session CRT boot still works"
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------

echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "  Phase 9B UAT Summary"
echo "════════════════════════════════════════════════════════════════════"
echo "  Mode:    $MODE"
echo "  Pass:    $PASS"
echo "  Fail:    $FAIL"
echo "  Skipped: $SKIP"
echo ""

if [[ "$FAIL" -gt 0 ]]; then
  echo "  Failed checks:"
  printf '    - %s\n' "${FAILED_SCENARIOS[@]}"
  echo ""
  echo "  Verdict: ✗ UAT FAILED"
  exit 1
else
  if [[ "$MODE" == "missing-env" ]]; then
    echo "  Verdict: ✓ Missing-env path clean. Now re-run without --missing-env."
  else
    echo "  Verdict: ✓ Phase 9B UAT PASSED"
    echo ""
    echo "  Don't forget: also run 'bash $0 --missing-env' with env vars cleared"
    echo "  to cover Scenario 5."
  fi
fi
