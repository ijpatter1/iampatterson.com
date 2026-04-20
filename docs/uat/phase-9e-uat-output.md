bash docs/uat/phase-9e-uat.sh

════════════════════════════════════════════════════════════

  Phase 9E UAT — preflight

  Base URL: http://localhost:3000
  ✓ Dev server reachable.


════════════════════════════════════════════════════════════

  SCENARIO: 1 — Fresh visitor discovers nav through NavHint (Flow C)

  Validates: Core navigation hypothesis: visitor with no prior exposure reaches Services/Contact via SessionPulse + NavHint without a conventional nav bar

  SETUP:
    • Open an incognito window on desktop viewport (≥768px).
    • Disable prefers-reduced-motion (OS Accessibility setting OFF).
    • Open DevTools → Application → Storage → Clear site data.

  Press ENTER when setup is complete (or Ctrl-C to abort)… 

  STEP: 1.1 — Load http://localhost:3000/ in the fresh tab.

    → No conventional nav links in the header (no Home/Services/About/Contact/Demos).
    → SessionPulse visible adjacent to brand wordmark. Pulse is animating.
    → 'ses <6-char> · N evt' legible inside the pulse surface.

  Pass? [Y/n] Header has no conventional nav links, SessionPulse is the only nav affordance y
  ✓ PASS

  STEP: 1.2 — Do NOTHING for ~3 seconds (no scroll/click/keydown/pointermove).

    → Soft amber pulse ring expands outward from the SessionPulse.
    → Accompanying text reads '← menu · under the hood' (or matching copy).
    → Check DevTools Console for data-layer pushes: 'nav_hint_shown' fires.

  Pass? [Y/n] NavHint animated pulse ring appears ~3s after idle on first visit y
  ✓ PASS

  STEP: 1.3 — Continue sitting idle for another ~10 seconds.

    → Hint auto-clears.
    → DevTools Console: 'nav_hint_dismissed' fires with dismissal_mode: 'timeout'.

  Pass? [Y/n] NavHint auto-clears at ~10s with dismissal_mode='timeout' y
  ✓ PASS

  STEP: 1.4 — Reload the page in the SAME tab. Wait ~5 seconds without interacting.

    → Hint does NOT re-appear, even after 3s idle.
    → DevTools Application → Session Storage has key 'iampatterson.nav_hint.shown'.

  Pass? [Y/n] Reload does NOT re-fire the NavHint in the same tab y
  ✓ PASS

  STEP: 1.5 — Click the SessionPulse.

    → Overlay opens. Active tab label reads '[ SESSION STATE ]' in terminal bracket framing.
    → Three tabs only: SESSION STATE → TIMELINE → CONSENT. No Overview, no Dashboards.
    → DevTools Console: 'session_state_tab_view' fires with source: 'default_landing'.

  Pass? [Y/n] Overlay lands on Session State with bracket framing, three tabs only y
  ✓ PASS

  STEP: 1.6 — Scan the Session State tab top-to-bottom without interacting.

    → Session header: last-6 session ID + started UTC time + current page '/'.
    → 16-cell ASCII coverage bar + chip grid showing 22 event-type chips.
    → Ecommerce funnel: PRODUCT_VIEW [  ] / ADD_TO_CART [  ] / CHECKOUT [  ] / PURCHASE [  ].
    → Consent summary (three rows).
    → Portal section: > SERVICES / > ABOUT / > CONTACT.

  Pass? [Y/n] All Session State sections render (header, coverage, funnel, consent, portals) y
  ✓ PASS

  STEP: 1.7 — Click '> SERVICES' in the portal section.

    → Overlay closes.
    → Browser routes to /services.
    → DevTools Console: 'portal_click' fires with destination: 'services'.

  Pass? [Y/n] Portal link closes overlay AND routes to /services AND fires portal_click y
  ✓ PASS


════════════════════════════════════════════════════════════

  SCENARIO: 2 — Returning-session visitor sees no hint

  Validates: sessionStorage gate prevents re-firing within a tab

  SETUP:
    • Continue from Scenario 1 (hint already fired, sessionStorage key set). Do NOT clear storage.

  Press ENTER when setup is complete (or Ctrl-C to abort)… 

  STEP: 2.1 — Navigate to /services then back to / via a footer link.

    → No NavHint after 3s idle on /. No 'nav_hint_shown' event.

  Pass? [Y/n] Same-tab re-visit does NOT re-show the hint y
  ✓ PASS

  STEP: 2.2 — Open a NEW tab (fresh sessionStorage) and load http://localhost:3000/. Idle ~3s.

    → NavHint DOES fire in the new tab (new tab = new sessionStorage).

  Pass? [Y/n] New tab DOES show the hint y
  ✓ PASS


════════════════════════════════════════════════════════════

  SCENARIO: 3 — Reduced-motion visitor experience end-to-end [devtools]

  Validates: Every motion surface respects prefers-reduced-motion

  SETUP:
    • DevTools → three-dot menu → More tools → Rendering → Emulate CSS media feature prefers-reduced-motion → reduce.
    • Clear Application → Storage → Session Storage for http://localhost:3000.

  Press ENTER when setup is complete (or Ctrl-C to abort)… 

  STEP: 3.1 — Load http://localhost:3000/. Sit idle ~3 seconds.

    → NavHint appears as STATIC TEXT ('← menu · under the hood') next to SessionPulse.
    → No pulse ring animation. Fades after ~6 seconds.

  Pass? [Y/n] NavHint is static text, not an animated ring y
  ✓ PASS

  STEP: 3.2 — Scroll slowly through the pipeline section.

    → Bleed layers render STATICALLY — no scanline drift, phosphor breathing, flicker bursts, RGB sweep, peak jitter.
    → Tier class still changes on scroll (warm/hot/peak visible as static color/intensity shifts).
    → Stage rotation does NOT advance — the active stage is frozen on stage 01.

  Pass? [Y/n] Pipeline section has no moving effects but still shows bleed layers and tier shifts y
  ✓ PASS

  STEP: 3.3 — At peak bleed, observe the 'Watch it live' CTA.

    → CTA flips to solid amber fill at peak but does NOT jitter or animate halo growth.

  Pass? [Y/n] 'Watch it live' CTA flips amber at peak but does not jitter y
  ✓ PASS

  STEP: 3.4 — Click SessionPulse, observe Session State tab.

    → Coverage numerals render IMMEDIATELY — no typewriter/typing animation.

  Pass? [Y/n] Session State coverage numbers appear immediately, no typewriter effect y
  ✓ PASS


════════════════════════════════════════════════════════════

  SCENARIO: 4 — Pipeline bleed-through reveal (Flow A, 'came to see the stack')

  Validates: Scroll-anchored ramp peaks at footnote, tiers cross at thresholds, CTA amber-crest is timed to section end

  SETUP:
    • Disable prefers-reduced-motion (DevTools emulation OFF or OS setting OFF).
    • Desktop viewport. Fresh tab or cleared sessionStorage.

  Press ENTER when setup is complete (or Ctrl-C to abort)… 

  STEP: 4.1 — Load http://localhost:3000/. Scroll from top slowly, watching pipeline section as it enters viewport.

  STEP: 4.2 — As the section TOP crosses ~25% into viewport:

    → First visible bleed onset. Faint scanlines at section edges. Persimmon still dominant.

  Pass? [Y/n] Bleed onset is subtle at entry, persimmon still dominant y
  ✓ PASS

  STEP: 4.3 — Continue scrolling until section is near-centered.

    → Tier crosses to 'warm' (class on section mutates — inspect via DevTools Elements).
    → Phosphor bloom visible from the bottom.
    → Flicker bursts start firing (random short brightness pulses).
    → Stage rotation advances 'is-hot' stage every ~1800ms.

  Pass? [Y/n] Warm tier: phosphor bloom + flicker bursts + stage rotation all active y
  ✓ PASS

  STEP: 4.4 — Scroll until ~2/3 of section has scrolled past viewport bottom.

    → Tier crosses to 'hot'.
    → RGB chromatic-aberration band sweeps top→bottom visibly (~2.8s loop).
    → 'Watch it live' CTA border warmed, halo grown, icon rotated partway.
    → 'flip →' suffix text has begun fading in (starts ~bleed 0.55).

  Pass? [Y/n] Hot tier: RGB sweep visible + CTA border/halo/icon couple to --bleed y
  ✓ PASS

  STEP: 4.5 — Scroll to the footnote at the bottom of the section.

    → Tier is 'peak'. Active-stage numeral has flipped persimmon → amber.
    → Schematic has sub-pixel jitter.
    → CTA is solid amber fill + jittering. 'flip →' suffix fully visible.

  Pass? [Y/n] Peak: active numeral flips amber + schematic jitters + CTA solid amber + 'flip →' visible y
  ✓ PASS

  STEP: 4.6 — Click 'Watch it live' at peak.

    → Overlay opens to Session State.
    → DevTools Console: 'click_cta' fires with cta_location: 'pipeline_watch_it_live'.

  Pass? [Y/n] 'Watch it live' click fires click_cta with pipeline_watch_it_live location y
  ✓ PASS

  STEP: 4.7 — Close overlay (backdrop click). Scroll back up past the section.

    → Bleed ramp REVERSES smoothly — no visual snap, no lingering amber cast above viewport.
    → Tier classes revert cleanly.

  Pass? [Y/n] Scrolling back up smoothly reverses the ramp Y
  ✓ PASS


════════════════════════════════════════════════════════════

  SCENARIO: 5 — Visitor arrives via 301 redirect from a removed demo

  Validates: D7 redirects resolve from removed routes + deep-links; D6 rebuild banner surfaces

  SETUP:
    • No browser setup needed for automated checks; manual verification follows.

  Press ENTER when setup is complete (or Ctrl-C to abort)… 

  AUTOMATED:
  ✗ GET /demo/subscription → 301 — expected 301, got 308000
  ✓   → redirects to ?rebuild=subscription (http://localhost:3000/?rebuild=subscription#demos)
  ✗ GET /demo/subscription/:path* → 301 (deep-link wildcard) — expected 301, got 308000
  ✓   → deep-link also redirects to ?rebuild=subscription (http://localhost:3000/?rebuild=subscription#demos)
  ✗ GET /demo/leadgen → 301 — expected 301, got 308000
  ✓   → redirects to ?rebuild=leadgen (http://localhost:3000/?rebuild=leadgen#demos)
  ✗ GET /demo/leadgen/:path* → 301 (deep-link wildcard) — expected 301, got 308000

  STEP: 5.1 — In a fresh browser tab with cleared sessionStorage, navigate directly to http://localhost:3000/demo/subscription.

    → Final URL: /?rebuild=subscription#demos. Page scrolls to Demos section.
    → Rebuild banner visible with copy mentioning 'subscription' (e.g. 'The subscription demo is being rebuilt…').

  Pass? [Y/n] Subscription-label rebuild banner surfaces with correct copy y
  ✓ PASS

  STEP: 5.2 — Dismiss the banner via the × control.

    → Banner hides. DevTools Application → Session Storage shows a per-label dismissal key.

  Pass? [Y/n] Banner dismisses AND sessionStorage records dismissal for 'subscription' label y
  ✓ PASS

  STEP: 5.3 — Navigate to http://localhost:3000/demo/subscription/account/settings (deep-link).

    → Redirects to /?rebuild=subscription#demos. Banner does NOT reappear (dismissal persisted).

  Pass? [Y/n] Deep-link redirect works AND banner stays dismissed per-label n
  ✗ FAIL — Deep-link redirect works AND banner stays dismissed per-label

  STEP: 5.4 — Navigate to http://localhost:3000/demo/leadgen/thanks.

    → Redirects to /?rebuild=leadgen#demos. Rebuild banner DOES appear with leadgen-specific copy.

  Pass? [Y/n] Leadgen-label banner appears independently (per-label sessionStorage gate) y
  ✓ PASS

  STEP: 5.5 — From the Demos section, click 'Enter the demo →'.

    → Routes to /demo/ecommerce. Ecommerce demo loads (unchanged from 9B — 9E does not modify it).

  Pass? [Y/n] Ecommerce demo still works end-to-end y
  ✓ PASS


════════════════════════════════════════════════════════════

  SCENARIO: 6 — Visitor crosses coverage milestone thresholds

  Validates: coverage_milestone fires exactly once per session per threshold; reload suppresses re-fire

  SETUP:
    • Fresh tab. Clear sessionStorage.
    • DevTools → Console open. Optionally filter for 'coverage_milestone'.

  Press ENTER when setup is complete (or Ctrl-C to abort)… 

  STEP: 6.1 — Load http://localhost:3000/. Open SessionPulse → Session State tab. Note the initial N/22 coverage.

    → Coverage bar is 16 cells wide regardless of denominator. Fill proportional to N/22.

  Pass? [Y/n] Coverage bar renders 16 cells; initial coverage low (~1–3/22) y
  ✓ PASS

  STEP: 6.2 — Close overlay. Drive coverage up: scroll, click CTAs, hover SessionPulse, etc. Aim to cross 25%.

    → When coverage crosses 25% (~6/22): 'coverage_milestone' fires with threshold: 25 in Console.

  Pass? [Y/n] coverage_milestone: 25 fires when crossing 25% y
  ✓ PASS

  STEP: 6.3 — Continue exploration. Navigate into ecommerce demo briefly (trigger product_view/add_to_cart), return to homepage. Push past 50%.

    → 'coverage_milestone: 50' fires.
    → Does NOT re-fire 'coverage_milestone: 25'.

  Pass? [Y/n] coverage_milestone: 50 fires; 25 does NOT re-fire y
  ✓ PASS

  STEP: 6.4 — Reload the page in the same tab.

    → Coverage state preserved (chip grid, funnel, percentage).
    → coverage_milestone does NOT re-fire for 25 or 50 (rehydrated thresholds suppressed).

  Pass? [Y/n] Reload preserves coverage AND does NOT re-fire already-crossed milestones n
  ✗ FAIL — Reload preserves coverage AND does NOT re-fire already-crossed milestones

  STEP: 6.5 — Continue pushing coverage across 75%.

    → 'coverage_milestone: 75' fires (newly crossed, not rehydrated).

  Pass? [Y/n] coverage_milestone: 75 fires on newly-crossed threshold post-reload y
  ✓ PASS

  STEP: 6.6 — Open a NEW tab and load http://localhost:3000/.

    → Fresh session; coverage bar near zero. Milestones reset in the new tab.

  Pass? [Y/n] New tab resets milestone state y
  ✓ PASS


════════════════════════════════════════════════════════════

  SCENARIO: 7 — Threshold-gated contact CTA appears and routes correctly

  Validates: Contextual CTA surfaces only when threshold met; fires with distinct cta_location from > CONTACT portal

  SETUP:
    • Fresh tab. Cleared sessionStorage.

  Press ENTER when setup is complete (or Ctrl-C to abort)… 

  STEP: 7.1 — Load /. Open Session State tab immediately.

    → Threshold-gated contact CTA is NOT visible. Only the neutral '> CONTACT' portal link.

  Pass? [Y/n] Contextual CTA is hidden before threshold met y
  ✓ PASS

  STEP: 7.2 — Close overlay. Navigate /demo/ecommerce, click a product, add to cart, go to checkout.

  STEP: 7.3 — Return to homepage. Reopen Session State tab.

    → Threshold-gated contact CTA IS now visible (triggered by begin_checkout).
    → Copy is warmer/outcome-framed (e.g. 'Seen enough? →'), distinct from '> CONTACT'.
    → Funnel: PRODUCT_VIEW [OK] / ADD_TO_CART [OK] / CHECKOUT [OK] / PURCHASE [  ].

  Pass? [Y/n] Contextual CTA appears post-begin_checkout with outcome-framed copy y
  ✓ PASS

  STEP: 7.4 — Click the threshold-gated contact CTA.

    → Overlay closes, routes to /contact with NO session_state= query param.
    → DevTools Console: 'click_cta' with cta_location: 'contact_cta_threshold'.
    → DevTools Console: 'portal_click' with destination: 'contact'.

  Pass? [Y/n] Threshold CTA fires click_cta with cta_location='contact_cta_threshold' n
  ✗ FAIL — Threshold CTA fires click_cta with cta_location='contact_cta_threshold'

  STEP: 7.5 — Browser back. Reopen overlay. Click the neutral '> CONTACT' portal link.

    → Routes to /contact.
    → 'click_cta' fires with cta_location: 'portal_contact' (DIFFERENT from threshold CTA).
    → 'portal_click' fires with destination: 'contact'.

  Pass? [Y/n] Portal > CONTACT fires click_cta with DIFFERENT cta_location than threshold CTA y
  ✓ PASS


════════════════════════════════════════════════════════════

  SCENARIO: 8 — Overlay tab nav + session_state_tab_view source discriminator

  Validates: Session State default; 3 tabs only; manual_select vs default_landing source

  SETUP:
    • Fresh tab. Cleared sessionStorage. DevTools Console open.

  Press ENTER when setup is complete (or Ctrl-C to abort)… 

  STEP: 8.1 — Click SessionPulse to open overlay.

    → Three tabs in order: [ SESSION STATE ] active, TIMELINE plain, CONSENT plain.
    → No OVERVIEW. No DASHBOARDS.
    → 'session_state_tab_view' fires with source: 'default_landing'.

  Pass? [Y/n] Three tabs only; Session State is default and fires source='default_landing' y
  ✓ PASS

  STEP: 8.2 — Click TIMELINE tab.

    → [ TIMELINE ] now bracket-framed, SESSION STATE plain. Timeline body visible.

  Pass? [Y/n] Active-tab bracket framing moves to TIMELINE y
  ✓ PASS

  STEP: 8.3 — Click CONSENT tab.

    → [ CONSENT ] active; others plain.

  Pass? [Y/n] Active-tab bracket framing moves to CONSENT y
  ✓ PASS

  STEP: 8.4 — Click back to SESSION STATE.

    → [ SESSION STATE ] active again.
    → 'session_state_tab_view' fires with source: 'manual_select' (NOT default_landing).

  Pass? [Y/n] Return to Session State fires source='manual_select' y
  ✓ PASS

  STEP: 8.5 — Close overlay (backdrop click). Click SessionPulse to re-open.

    → Opens BACK on Session State (tab state does not persist across open/close).
    → 'session_state_tab_view' fires with source: 'default_landing' again.

  Pass? [Y/n] Re-opening overlay lands on Session State with source='default_landing' y
  ✓ PASS


════════════════════════════════════════════════════════════

  SCENARIO: 9 — Consent denied mid-session updates Session State live

  Validates: Consent state changes post-session-start propagate into consent_snapshot

  SETUP:
    • Fresh tab. Cookiebot banner should appear on first load.
    • Accept ALL consent categories in the Cookiebot banner.

  Press ENTER when setup is complete (or Ctrl-C to abort)… 

  STEP: 9.1 — Open Session State tab. Confirm consent summary.

    → Consent rows: analytics: granted, marketing: granted, preferences: granted.

  Pass? [Y/n] Initial consent summary shows all granted 

  ✓ PASS

  STEP: 9.2 — Close overlay. Re-invoke Cookiebot preferences (floating badge or stored link). Deny marketing category.

  STEP: 9.3 — Interact briefly (scroll, click). Wait ~1s.

  STEP: 9.4 — Reopen Session State tab.

    → Consent summary: analytics: granted, marketing: DENIED, preferences: granted.

  Pass? [Y/n] Session State reflects mid-session consent revocation (marketing denied) y
  ✓ PASS

  STEP: 9.5 — Switch to Timeline tab.

    → Recent events post-consent-change continue to appear (analytics still granted).

  Pass? [Y/n] Timeline continues populating after consent change y
  ✓ PASS


════════════════════════════════════════════════════════════

  SCENARIO: 10 — Slow-loading consent: first-visit consent seeding [devtools]

  Validates: Consent snapshot heals on first poll tick without requiring an iap_source event

  SETUP:
    • DevTools → Network → throttle 'Slow 3G' OR block 'consent.cookiebot.com' with a request interceptor.
    • Clear sessionStorage, local storage, and all cookies for http://localhost:3000.

  Press ENTER when setup is complete (or Ctrl-C to abort)… 

  STEP: 10.1 — Load / under throttled/blocked network. IMMEDIATELY open Session State tab (before Cookiebot responds).

    → Consent snapshot shows all 'denied' (Cookiebot state not yet available; getCurrentConsent returns denied).

  Pass? [Y/n] Pre-Cookiebot, snapshot reads all 'denied' without crashing y
  ✓ PASS

  STEP: 10.2 — Wait ~1–2 seconds. Do NOT take any banner action yet.

    → Within ~400ms of Cookiebot load, snapshot heals to real state (typically all granted if auto-consent is on, or still denied if banner is pending).

  Pass? [Y/n] Snapshot heals to real state within ~400ms, without needing user event y
  ✓ PASS

  STEP: 10.3 — Take a consent-banner action (accept or deny).

    → Snapshot updates to match banner choice.

  Pass? [Y/n] Banner action propagates to snapshot y
  ✓ PASS


════════════════════════════════════════════════════════════

  SCENARIO: 11 — Mobile-viewport visitor navigates the pivot [mobile]

  Validates: Mobile layout for header, overlay, pipeline schematic, and Demos section

  SETUP:
    • DevTools → device mode → iPhone 12 or similar (<768px).
    • Fresh tab, cleared sessionStorage.

  Press ENTER when setup is complete (or Ctrl-C to abort)… 

  STEP: 11.1 — Load http://localhost:3000/.

    → SessionPulse sits in top-right (hamburger position) with mobile styling.
    → No conventional nav. Header sticky-on-scroll.

  Pass? [Y/n] SessionPulse is top-right on mobile n
  ✗ FAIL — SessionPulse is top-right on mobile

  STEP: 11.2 — Idle ~3 seconds.

    → NavHint pulse ring fires, positioned sensibly relative to top-right SessionPulse (not clipped).

  Pass? [Y/n] NavHint positions correctly on mobile n
  ✗ FAIL — NavHint positions correctly on mobile

  STEP: 11.3 — Tap SessionPulse.

    → Overlay opens to Session State. Tab bar usable at mobile width. Chip grid, funnel, portals all legible; chips wrap gracefully.

  Pass? [Y/n] Session State tab fully usable at mobile width (no clipping) n
  ✗ FAIL — Session State tab fully usable at mobile width (no clipping)

  STEP: 11.4 — Close overlay. Scroll into pipeline section.

    → Schematic: 2-column layout (numeral 40px + body). Readouts collapse below each stage; expand via max-height only when is-hot. Bleed layers visible.

  Pass? [Y/n] Pipeline schematic uses 2-column mobile layout with is-hot-gated readouts y
  ✓ PASS

  STEP: 11.5 — Scroll into Demos section.

    → Single full-width section (NO horizontal-scroll track, NO swipe-hint bars).
    → Eyebrow, serif headline, paragraphs, CTA, terminal preview stacked vertically and legible.

  Pass? [Y/n] Demos section is single full-width block (not horizontal scroll track) y
  ✓ PASS


════════════════════════════════════════════════════════════

  SCENARIO: 12 — Desktop SessionPulse hover affordance + 60s analytics debounce

  Validates: Hover reveals NAV · UNDER THE HOOD; session_pulse_hover debounced; suppressed on coarse pointer

  SETUP:
    • Desktop viewport (≥768px). Mouse pointer (fine). DevTools Console open.

  Press ENTER when setup is complete (or Ctrl-C to abort)… 

  STEP: 12.1 — Load /. Hover SessionPulse without clicking.

    → Border intensifies; ↗ indicator scales/glows.
    → Tooltip-style label appears reading 'NAV · UNDER THE HOOD' in mono/amber.
    → Console: 'session_pulse_hover' fires.

  Pass? [Y/n] Hover label 'NAV · UNDER THE HOOD' appears + session_pulse_hover fires y
  ✓ PASS

  STEP: 12.2 — Move cursor away. Hover again within 10s.

    → Visual hover state shows (affordance works).
    → 'session_pulse_hover' does NOT re-fire (debounced to 60s).

  Pass? [Y/n] session_pulse_hover debounced — no re-fire within 60s y
  ✓ PASS

  STEP: 12.3 — Wait 60+ seconds, hover again.

    → 'session_pulse_hover' fires again (debounce window elapsed).

  Pass? [Y/n] session_pulse_hover fires again after 60s y
  ✓ PASS

  STEP: 12.4 — DevTools device mode: switch to mobile (coarse pointer simulation). Hover/tap events.

    → 'session_pulse_hover' does NOT fire on hover under coarse-pointer simulation.

  Pass? [Y/n] session_pulse_hover is suppressed under coarse-pointer y
  ✓ PASS


════════════════════════════════════════════════════════════

  SCENARIO: 13 — Coverage denominator matches live schema

  Validates: No rendering-path hardcodes denominator; bar is 16 cells, denominator is 22

  SETUP:
    • Fresh tab, cleared sessionStorage.

  Press ENTER when setup is complete (or Ctrl-C to abort)… 

  STEP: 13.1 — Load /. Open Session State tab.

    → Coverage readout: '<N>/22 event types' (current denominator 22 as of 9E D9).
    → Bar is visually 16 cells wide.
    → Chip grid contains exactly 22 chips.

  Pass? [Y/n] Bar is 16 cells + denominator is 22 + chip grid has 22 chips y
  ✓ PASS

  STEP: 13.2 — Scan chip grid for nav-analytics chips (added in D9): nav_hint_shown, nav_hint_dismissed, session_pulse_hover, session_state_tab_view, portal_click, coverage_milestone.

    → All 6 nav-analytics chips present (most dimmed until fired).

  Pass? [Y/n] All 6 D9 nav-analytics chips present in the chip grid y
  ✓ PASS

  STEP: 13.3 — Scan for subscription/leadgen chips: plan_select, trial_signup, form_complete, lead_qualify.

    → All 4 chips present but dimmed (unfired — intentional carry in denominator).

  Pass? [Y/n] Subscription/leadgen chips present but dimmed y
  ✓ PASS

  STEP: 13.4 — Hover SessionPulse to fire session_pulse_hover. Reopen Session State tab.

    → session_pulse_hover chip has flipped from dimmed to amber.

  Pass? [Y/n] Firing a nav-analytics event flips its chip amber y
  ✓ PASS


════════════════════════════════════════════════════════════

  SCENARIO: 14 — Full persona run (Flow B, 'came for the dashboards')

  Validates: Full end-to-end: enters via removed demo redirect, scrolls hero → pipeline → demos, completes ecommerce, sees elevated coverage + threshold CTA + D8 ride-along

  SETUP:
    • Fresh tab, cleared sessionStorage.

  Press ENTER when setup is complete (or Ctrl-C to abort)… 

  STEP: 14.1 — Enter via http://localhost:3000/demo/subscription (stale inbound link).

    → 301 redirect to /?rebuild=subscription#demos. Rebuild banner visible at Demos section.

  Pass? [Y/n] Stale inbound link redirects + rebuild banner appears y
  ✓ PASS

  STEP: 14.2 — Dismiss banner. Scroll UP to the hero.

    → Pipeline section renders above Demos. Scrolling up, bleed ramp reverses cleanly.

  Pass? [Y/n] Scroll-up reverses pipeline bleed cleanly y
  ✓ PASS

  STEP: 14.3 — From hero, scroll DOWN through pipeline section (full Scenario 4 experience).

    → Full bleed reveal: warm → hot → peak with CTA amber crest at footnote.

  Pass? [Y/n] Full pipeline reveal plays end-to-end y
  ✓ PASS

  STEP: 14.4 — Click 'Watch it live' at peak. Overlay opens.

    → Session State shows fired events already (page_view, scroll_depth, at least) as amber chips.

  Pass? [Y/n] Session State accurately reflects events fired during pipeline scroll y
  ✓ PASS

  STEP: 14.5 — Close overlay. Click 'Enter the demo →' in Demos section.

    → Routes to /demo/ecommerce. Ecommerce demo is 9B implementation (unchanged in 9E).

  Pass? [Y/n] Ecommerce demo still works end-to-end (9E does not break 9B) y
  ✓ PASS

  STEP: 14.6 — Complete the demo through /demo/ecommerce/confirmation.

  STEP: 14.7 — Return to homepage. Open Session State tab.

    → Coverage jumped substantially.
    → Ecommerce funnel: all four stages [OK]. Percentage 100%.
    → coverage_milestone has fired at crossed thresholds.
    → Threshold-gated contact CTA is visible.

  Pass? [Y/n] Post-demo Session State: 100% funnel + elevated coverage + threshold CTA visible y
  ✓ PASS

  STEP: 14.8 — Click threshold-gated contact CTA. Arrive at /contact.

    → Contact page renders.
    → D8 ride-along block visible below the message textarea: checkbox labeled 'Share my session state with this message' + human-readable summary.

  Pass? [Y/n] D8 ride-along block is visible on contact page y
  ✓ PASS

  STEP: 14.9 — Inspect the D8 summary copy (marketing should be granted from Cookiebot acceptance).

    → Checkbox is CHECKED by default (marketing granted).
    → Summary reads: 'You've triggered X of 22 event types, completed 100% of the ecommerce demo, and visited N pages. Your consent state and session ID will ride along.'

  Pass? [Y/n] D8 checkbox checked + summary shows concrete payload + 'will ride along' y
  ✓ PASS

  STEP: 14.10 — Inspect the hidden session_state field. DevTools Elements → find input[name='session_state'].

    → Hidden input present. value attribute is JSON with session_id, event_types_triggered, event_types_total=22, ecommerce_demo_percentage=100, pages_visited, consent object.

  Pass? [Y/n] Hidden session_state field serialized with correct projection shape y
  ✓ PASS

  STEP: 14.11 — Uncheck the checkbox. Re-inspect Elements.

    → Summary copy flips to 'Session state will not be included with this message. Check the box above to share it.'
    → input[name='session_state'] is REMOVED from DOM (not just hidden or disabled).

  Pass? [Y/n] Uncheck removes hidden input from DOM + summary copy flips y
  ✓ PASS


════════════════════════════════════════════════════════════

  SCENARIO: 15 — Interaction-before-hint cancels the hint

  Validates: Any idle-reset event within 3s prevents the hint from ever rendering

  SETUP:
    • Fresh tab. Cleared sessionStorage. Desktop.

  Press ENTER when setup is complete (or Ctrl-C to abort)… 

  STEP: 15.1 — Load http://localhost:3000/.

  STEP: 15.2 — Within 1 SECOND of load, scroll slightly OR move the pointer.

    → Idle timer resets. NavHint does NOT fire. No 'nav_hint_shown' in Console.

  Pass? [Y/n] Early interaction prevents the hint from firing y
  ✓ PASS

  STEP: 15.3 — Continue interacting normally. Idle for 10+ seconds afterward.

    → NavHint still does NOT fire (homepage-entry-scoped + interaction cancelled it for this page-load).
    → No 'nav_hint_dismissed' fires — dismissal only fires when hint rendered.

  Pass? [Y/n] Later idle does not fire hint; no nav_hint_dismissed without nav_hint_shown y
  ✓ PASS

  STEP: 15.4 — Navigate to /services via footer link, then back to / via footer Home link.

    → No hint on return to / (sessionStorage gate may or may not be set; behavior is homepage-entry-scoped anyway).

  Pass? [Y/n] Return to / in same tab does not re-fire hint y
  ✓ PASS


════════════════════════════════════════════════════════════

  SCENARIO: 16 — New-tab visitor gets a fresh Session State blob

  Validates: D4 tab-scoped sessionStorage: reload preserves, new tab is fresh, per-tab isolation

  SETUP:
    • Two tabs A and B in the same browser window. Start with both clear.

  Press ENTER when setup is complete (or Ctrl-C to abort)… 

  STEP: 16.1 — TAB A: Load /. Navigate through a few pages, trigger events. Open Session State.

    → Note coverage (e.g. 7/22) and session ID last-6.

  Pass? [Y/n] Tab A Session State has non-trivial coverage y
  ✓ PASS

  STEP: 16.2 — TAB A: Reload (Cmd/Ctrl+R).

    → Coverage, chip grid amber states, funnel progress, session ID all PRESERVED.
    → visited_paths count stable.

  Pass? [Y/n] Tab A reload preserves Session State n
  ✗ FAIL — Tab A reload preserves Session State

  STEP: 16.3 — TAB B (new tab): Load http://localhost:3000/.

    → Session State starts FRESH. Coverage at minimum (just page_view).
    → Funnel all [  ]. Session ID may differ or match (_iap_sid cookie may be shared).
    → Session State BLOB is independent per-tab.

  Pass? [Y/n] New tab (B) starts with fresh Session State y
  ✓ PASS

  STEP: 16.4 — TAB B: Trigger events, reach product_view in demo, return to homepage.

  STEP: 16.5 — TAB A: Reload.

    → Tab A's Session State is STILL its own — NOT merged with Tab B's activity. Per-tab isolation holds.

  Pass? [Y/n] Activity in Tab B does NOT bleed into Tab A y
  ✓ PASS


════════════════════════════════════════════════════════════

  UAT SUMMARY

    PASS:    71
    FAIL:    11
    SKIPPED: 0

  FAILED CHECKS:
    ✗ 5 — Visitor arrives via 301 redirect from a removed demo: GET /demo/subscription → 301 (expected 301, got 308000)
    ✗ 5 — Visitor arrives via 301 redirect from a removed demo: GET /demo/subscription/:path* → 301 (deep-link wildcard) (expected 301, got 308000)
    ✗ 5 — Visitor arrives via 301 redirect from a removed demo: GET /demo/leadgen → 301 (expected 301, got 308000)
    ✗ 5 — Visitor arrives via 301 redirect from a removed demo: GET /demo/leadgen/:path* → 301 (deep-link wildcard) (expected 301, got 308000)
    ✗ 5 — Visitor arrives via 301 redirect from a removed demo: Deep-link redirect works AND banner stays dismissed per-label
    ✗ 6 — Visitor crosses coverage milestone thresholds: Reload preserves coverage AND does NOT re-fire already-crossed milestones
    ✗ 7 — Threshold-gated contact CTA appears and routes correctly: Threshold CTA fires click_cta with cta_location='contact_cta_threshold'
    ✗ 11 — Mobile-viewport visitor navigates the pivot [mobile]: SessionPulse is top-right on mobile
    ✗ 11 — Mobile-viewport visitor navigates the pivot [mobile]: NavHint positions correctly on mobile
    ✗ 11 — Mobile-viewport visitor navigates the pivot [mobile]: Session State tab fully usable at mobile width (no clipping)
    ✗ 16 — New-tab visitor gets a fresh Session State blob: Tab A reload preserves Session State

  VERDICT: ✗ FAIL — Phase 9E NOT accepted. Address failures before joint 9E+9F release.
