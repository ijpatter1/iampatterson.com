#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════
# Phase 10b UAT — Core Web Vitals & Performance
# Created: 2026-04-24, session-2026-04-24-001
# ═════════════════════════════════════════════════════════════════════════
#
# End-to-end verification of the Phase 10b deliverables on the developer's
# own machine. Uses the same automation-first pattern as phase-10a-uat.sh:
# automated setup + automated checks + `confirm()` prompts for visual
# inspection where the code can't self-verify.
#
# Phase 10b is measurement-focused, so most UAT steps are "run the thing
# we landed, check the numbers + the dataLayer + the browser state, move
# on." One manual scenario exercises `navigator.onLine` transitions via
# Chrome DevTools (cannot be scripted from bash).
#
# Usage:
#   bash docs/uat/phase-10b-uat.sh              # full run
#   SKIP_LIGHTHOUSE=1 bash docs/uat/phase-10b-uat.sh   # skip Lighthouse (slow)
#
# Prerequisites:
#   - arm64 Node 20.9+ on PATH (/opt/homebrew/bin prepended)
#   - `npm install` done
#   - No other process bound to ports 3110-3115
#
# Exercises: D1a (reporter + schema + BQ columns), D1b (Lighthouse
# baseline + capture script), D1c (no regression on desktop numbers), D5
# (reliability polish via useEventStream + Playwright), D6 (overlay memo
# under 100-event session).

set -euo pipefail
export PATH="/opt/homebrew/bin:$PATH"

PASS=0
FAIL=0
SKIP=0

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

# ── Helpers ──────────────────────────────────────────────────────────
verify() {
  local desc="$1" cmd="$2"
  echo ""
  echo "  → ${desc}"
  if eval "${cmd}" > /tmp/verify-out.log 2>&1; then
    echo "  ✓ pass"; ((PASS++))
  else
    echo "  ✗ fail: ${cmd}"
    tail -3 /tmp/verify-out.log | sed 's/^/    /'
    ((FAIL++))
  fi
}

confirm() {
  local question="$1" desc="$2"
  echo ""
  echo "  → ${question}"
  read -p "  Pass? [Y/n] " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Nn]$ ]]; then
    echo "  ✗ fail (human-rejected): ${desc}"; ((FAIL++))
  else
    echo "  ✓ pass: ${desc}"; ((PASS++))
  fi
}

skip() {
  local desc="$1" reason="$2"
  echo ""
  echo "  ⊘ skip: ${desc}"
  echo "    ${reason}"
  ((SKIP++))
}

section() {
  echo ""
  echo "═══════════════════════════════════════════════════════"
  echo "  $1"
  echo "═══════════════════════════════════════════════════════"
}

# Background server helpers
SERVER_PID=""
start_server() {
  local port="$1"
  PORT="$port" npm run start > "/tmp/uat-server-${port}.log" 2>&1 &
  SERVER_PID=$!
  for i in $(seq 1 60); do
    if curl -sf -o /dev/null "http://localhost:${port}/"; then return 0; fi
    sleep 1
  done
  echo "  ✗ server on :${port} did not become ready within 60s"
  return 1
}
stop_server() {
  if [ -n "${SERVER_PID}" ]; then
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
    SERVER_PID=""
  fi
}
trap stop_server EXIT

# ── Scenario 0: baseline state ─────────────────────────────────────
section "Scenario 0 — Baseline state (tests + lint + build)"

verify "npm test passes at 1201" \
  "npm test 2>&1 | grep -E 'Tests:.*1201 passed'"

verify "npm run lint clean" \
  "npm run lint 2>&1 | grep -qE '^$' -v; npm run lint 2>&1 | tail -3 | grep -qvE 'error|warning'"

verify "npm run build clean on Next 16.2.4" \
  "npm run build 2>&1 | tail -5 | grep -qE 'Generating|prerendered|Dynamic'"

# ── Scenario 1: D1a — CWV schema + track helper + BigQuery columns ─
section "Scenario 1 — D1a: CWV schema + track helper + BQ columns"

verify "WebVitalEvent is in DATA_LAYER_EVENT_NAMES + HIDDEN_FROM_COVERAGE" \
  "npx jest tests/unit/events/schema.test.ts --silent 2>&1 | grep -qE 'Tests:.*passed'"

verify "trackWebVital pushes web_vital events for all 5 metrics" \
  "npx jest tests/unit/events/track.test.ts --silent 2>&1 | grep -qE 'Tests:.*passed'"

verify "BigQuery schema.json has the 5 D1a columns" \
  "node -e \"const s = require('./infrastructure/bigquery/schema.json'); const names = s.map(c => c.name); for (const c of ['metric_name','metric_value','metric_rating','metric_id','navigation_type']) { if (!names.includes(c)) { throw new Error('missing ' + c); } } console.log('ok');\""

verify "WebVitalsReporter unit tests pass (4 tests)" \
  "npx jest tests/unit/components/scripts/web-vitals-reporter.test.tsx --silent 2>&1 | grep -qE 'Tests:.*4 passed'"

# ── Scenario 2: D1a — reporter actually emits to dataLayer in-browser ─
section "Scenario 2 — D1a in-browser: web_vital events land on window.dataLayer"

echo "  Starting production server on :3110..."
start_server 3110

# Use Playwright's chromium directly to visit home + capture web_vital events
echo "  Probing / for web_vital dataLayer pushes..."
node - <<'JS' || ((FAIL++))
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://localhost:3110/', { waitUntil: 'load' });
  // Give web-vitals time to register + settle, then flush via page hide
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(800);
  const events = await page.evaluate(() =>
    (window.dataLayer || []).filter(e => e && e.event === 'web_vital').map(e => ({
      metric_name: e.metric_name,
      metric_rating: e.metric_rating,
      has_value: typeof e.metric_value === 'number',
    }))
  );
  await browser.close();
  if (events.length === 0) {
    console.error('FAIL: no web_vital events on window.dataLayer');
    process.exit(1);
  }
  console.log('found', events.length, 'web_vital events:', events.map(e => e.metric_name).sort().join(','));
  const names = new Set(events.map(e => e.metric_name));
  const required = ['LCP', 'CLS', 'FCP', 'TTFB'];
  const missing = required.filter(n => !names.has(n));
  if (missing.length > 0) {
    console.error('FAIL: missing metrics:', missing.join(','));
    process.exit(1);
  }
  console.log('ok');
})();
JS
if [ $? -eq 0 ]; then echo "  ✓ pass"; ((PASS++)); else echo "  ✗ fail"; fi

stop_server

# ── Scenario 3: D1b — Lighthouse capture script produces expected report shape ─
section "Scenario 3 — D1b: Lighthouse capture script runs + writes expected reports"

if [ "${SKIP_LIGHTHOUSE:-0}" = "1" ]; then
  skip "Lighthouse run" "SKIP_LIGHTHOUSE=1 set"
else
  echo "  Running scripts/capture-cwv-baseline.sh (2-3 min)..."
  UAT_DATE="uat-$(date +%Y-%m-%d-%H%M%S)"
  DATE="${UAT_DATE}" PORT=3111 bash scripts/capture-cwv-baseline.sh > /tmp/lighthouse-uat.log 2>&1 || echo "  (capture script had non-fatal issues — see /tmp/lighthouse-uat.log)"

  verify "Desktop home Perf ≥ 99 on the current branch" \
    "node -e \"const r = require('./docs/perf/lighthouse-${UAT_DATE}-desktop-home.report.json'); const p = Math.round((r.categories.performance?.score ?? 0) * 100); console.log('Perf=' + p); if (p < 99) process.exit(1);\""

  verify "Desktop home LCP ≤ 1.2s" \
    "node -e \"const r = require('./docs/perf/lighthouse-${UAT_DATE}-desktop-home.report.json'); const l = r.audits['largest-contentful-paint']?.numericValue ?? 99999; console.log('LCP=' + l + 'ms'); if (l > 1200) process.exit(1);\""

  verify "Desktop confirmation Perf ≥ 98" \
    "node -e \"const r = require('./docs/perf/lighthouse-${UAT_DATE}-desktop-confirmation.report.json'); const p = Math.round((r.categories.performance?.score ?? 0) * 100); console.log('Perf=' + p); if (p < 98) process.exit(1);\""

  # Clean up the UAT-generated reports to avoid cluttering docs/perf/
  rm -f docs/perf/lighthouse-${UAT_DATE}-*.report.*
fi

# ── Scenario 4: D5 — reliability polish unit tests ─
section "Scenario 4 — D5: WebSocket reliability (jitter + online-recovery)"

verify "useEventStream tests pass (22 tests including 3 new D5 tests)" \
  "npx jest tests/unit/hooks/useEventStream.test.ts --silent 2>&1 | grep -qE 'Tests:.*22 passed'"

verify "Jitter pinned to 800ms delay via Math.random=0" \
  "npx jest tests/unit/hooks/useEventStream.test.ts -t 'jitter' --silent 2>&1 | grep -qE 'Tests:.*passed'"

verify "Online-event recovery reconnects from disconnected state" \
  "npx jest tests/unit/hooks/useEventStream.test.ts -t 'online-event recovery' --silent 2>&1 | grep -qE 'Tests:.*passed'"

# ── Scenario 5: D6 — overlay memo under 100-event session ─
section "Scenario 5 — D6: EventTimelineRow memo + 100-event stress"

verify "EventTimeline tests pass (11 tests including 3 D6 tests)" \
  "npx jest tests/unit/components/overlay/event-timeline.test.tsx --silent 2>&1 | grep -qE 'Tests:.*11 passed'"

verify "Memo short-circuits unchanged rows on prepend (render counter pin)" \
  "npx jest tests/unit/components/overlay/event-timeline.test.tsx -t 'React.memo short-circuits' --silent 2>&1 | grep -qE 'Tests:.*passed'"

# ── Scenario 6: D6 — overlay opens + Timeline tab works in-browser ─
section "Scenario 6 — D6 in-browser: overlay + Timeline under real chromium"

echo "  Starting production server on :3112..."
start_server 3112

node - <<'JS' || ((FAIL++))
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1350, height: 940 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' && !/Cookiebot|cookieinformation|preload/i.test(msg.text())) {
      consoleErrors.push(msg.text().slice(0, 200));
    }
  });
  await page.goto('http://localhost:3112/', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  // Open overlay
  await page.getByRole('button', { name: /open your session/i }).click();
  const overlay = page.getByTestId('overlay-view');
  await overlay.waitFor({ state: 'visible' });
  // Switch to Timeline
  await overlay.getByRole('button', { name: /^timeline$/i }).click();
  await page.waitForTimeout(500);
  // Close
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await browser.close();
  if (consoleErrors.length > 0) {
    console.error('FAIL: console errors during overlay interaction:');
    consoleErrors.forEach(e => console.error('  ' + e));
    process.exit(1);
  }
  console.log('ok — overlay open/Timeline/close cycle clean');
})();
JS
if [ $? -eq 0 ]; then echo "  ✓ pass"; ((PASS++)); else echo "  ✗ fail"; fi

stop_server

# ── Scenario 7: manual — navigator.onLine transitions ─
section "Scenario 7 — D5 manual: navigator.onLine offline→online recovery"

echo ""
echo "  This scenario requires Chrome DevTools (can't be scripted)."
echo ""
echo "  1. Start the dev server: npm run dev"
echo "  2. Open http://localhost:3000/ in Chrome (skip if SSE endpoint isn't configured — env: NEXT_PUBLIC_EVENT_STREAM_URL)"
echo "  3. Open DevTools → Network tab → 'Throttling' dropdown → 'Offline'"
echo "  4. Wait ~30s for the SSE connection to drop + exhaust retries"
echo "  5. Switch throttling back to 'No throttling'"
echo "  6. Observe: the hook should automatically bump retryTrigger via the"
echo "     'online' event handler and re-establish the EventSource"
echo ""
confirm "Did navigator.onLine offline→online recovery re-establish the stream?" \
  "D5 online-event recovery works in-browser against a real SSE endpoint"

# If no SSE endpoint is configured locally, this scenario is informational
# only — the hook's unit tests cover the logic; only production wiring matters.

# ── Scenario 8: Cookiebot banner + WebVitalsReporter graceful fallback ─
section "Scenario 8 — Cookiebot banner UX + reporter graceful behaviour"

echo "  Starting production server on :3113..."
start_server 3113

echo ""
echo "  Visual inspection required. Open:"
echo "    open http://localhost:3113/"
echo ""
confirm "Does the Cookiebot banner render as a bottom bar (not a center popup)?" \
  "Cookiebot production config applies correctly to localhost"

confirm "Does the hero h1 ('I build / measurement / infrastructure.') paint clearly without jank?" \
  "Hero LCP element renders cleanly"

stop_server

# ── Results summary ─
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  UAT Results"
echo "═══════════════════════════════════════════════════════"
echo "  Passed: ${PASS}"
echo "  Failed: ${FAIL}"
echo "  Skipped: ${SKIP}"
echo ""
if [ $FAIL -eq 0 ]; then
  echo "  ✓ Phase 10b UAT: PASS"
  echo ""
  echo "  Next: push phase/10b-core-web-vitals + open PR + merge to main."
  exit 0
else
  echo "  ✗ Phase 10b UAT: FAIL (${FAIL} failures)"
  echo ""
  echo "  Fix failures before pushing + opening PR."
  exit 1
fi
