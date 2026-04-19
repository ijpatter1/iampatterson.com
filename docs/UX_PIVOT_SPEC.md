# iampatterson.com — UX Pivot Design Spec

**Status:** Ready for Claude Code handoff
**Scope:** Redesign of homepage navigation model, Under the Hood overlay, and ecommerce demo reveal mechanics. Subscription and lead gen demos out of scope for this pivot.
**Companion artifact:** Pipeline section prototype + implementation plan — `[PLACEHOLDER: insert path to pipeline prototype doc]`

---

## 1. Vision

The site today has three surfaces — editorial front-end, retrofuturistic Under the Hood overlay, three demo mini-sites — linked by CTAs. The surfaces feel disjointed. The overlay is a destination the visitor toggles in and out of, the demos force the visitor through pretend funnels with under-the-hood interruptions, and the conventional top nav doesn't reflect the product.

This pivot reframes the site as **one world in two states**, with the instrument panel as the primary navigation. Editorial and retrofuture become surfaces of the same measurement stack, not separate properties. Navigation becomes exploration with explicit escape hatches. The demos stop being shopkeeper theater and become diagnostic environments where the instrumentation reveals itself natively as the visitor interacts.

### Design principles

1. **Instrument as nav.** The SessionPulse is the navigation entry point. The Under the Hood overlay is the portal. There is no conventional Home/Services/About/Contact bar. Paths to services/contact are reachable from the Session State tab, the footer, and contextual in-page CTAs.

2. **The underside is session-scoped; demo reveals are demo-scoped.** The overlay reflects the visitor's activity across the whole site. Demo-native reveals (toasts, sidebars, inline live elements, diagnostic pages) use the underside's visual vocabulary — amber, mono, scanlines — but live inside the demo flow, not inside the overlay.

3. **Progressive reveal, not binary toggle.** The editorial surface doesn't hide the underside and then flip to reveal it. The underside bleeds through the pipeline section on scroll. By the time the visitor encounters "Watch it live," opening the overlay is a continuation of a gesture the page has already been priming, not a state change.

4. **Accents stay separated by surface, but visually bleed.** Persimmon (`#EA5F2A`) remains the paper accent; phosphor amber (`#FFA400`) remains the underside accent. Editorial surfaces do not adopt amber as primary. The pipeline section reveal shows amber *peeking through* from the underside below (glow, scanline edges), framed as the underside becoming visible — not as the editorial layer changing color.

5. **Retrofuturism is emphatic, not universal.** Amber glow for headers, live data, status signals, and the overlay's top nav. Body text stays warm cream (existing `u-ink` token) for legibility. Emphasis through ASCII progress bars, `[OK]` status tags, terminal vocabulary, and typing effects — not by rendering every word in phosphor.

6. **Clear payoff paths.** Exploration is the default mode, but any visitor who wants to skip to "just hire me" can do so in one click. The Session State tab is the rich escape hatch. The footer and homepage CTAs are the cheap ones.

7. **Meta-proof through self-measurement.** The site measures its own visitors' engagement with itself. Session State is gamification for the visitor, signal for Ian (site analytics), and context on contact form submissions (with explicit consent).

---

## 2. User flows

Three representative personas, each with a distinct path through the site. These are illustrative — the system must support all three simultaneously.

### Flow A — The Tier 1/2 buyer (came to see the stack)

This visitor is a marketing ops lead, VP data, or technical founder. They don't want to pretend-shop through an ecommerce demo. They want to see that Ian actually builds the measurement infrastructure he sells.

1. Visitor lands on the homepage from a LinkedIn post or direct link. Sees the editorial hero (`I build measurement infrastructure.`) with persimmon accent. The SessionPulse in the header is already pulsing — their session ID is in it, event count is 0 and climbing as scroll fires events.
2. Scrolls into the pipeline section. The editorial aesthetic starts bleeding toward the underside: faint scanlines at the section edges, a subtle amber cast on the pipeline stage cards, the log feed intensifying as events stream in. The section teaches them the pipeline architecture *and* primes them for the overlay.
3. They tap the SessionPulse in the header (or the "Watch it live" pill at the bottom of the pipeline section). The overlay opens. **Default tab: Session State.** They see a gamified summary: coverage across event types, ecommerce demo funnel progress (0% — haven't started), CTAs to Services and Contact in the tab itself.
4. They click Timeline. They see every event their session has fired, in order, with routing destinations. They click Consent. They see how their consent state has gated the routing in real time. They have now seen Tier 1 demonstrated end-to-end.
5. From the Session State tab, they click "Services." The overlay closes and the editorial Services page loads. Or they click "Contact." Same behavior.

**What this flow validates:** The overlay is a legitimate endpoint on its own. Visitors who never touch the demos still get a complete Tier 1/2 demonstration. Session State is the portal that lets them cut through the maze.

### Flow B — The Tier 3 buyer (came for the dashboards)

This visitor is a marketing director or head of analytics. They care about BI, attribution, and what the pretty numbers look like in production. They'll go through the demo because the demo is where the payoff lives.

1. Visitor lands on the homepage, scrolls past the hero into the pipeline section, and through the pipeline reveal ends up at the Demos section. They click into the ecommerce demo.
2. The demo page is styled editorially (a believable product listing for the Tuna Shop) but the instrumentation is visible *as they interact* — not behind an overlay. When they click a product, a small amber toast near the cart icon fires: `product_view · tuna-plush · $24.99 → GA4 BigQuery Pub/Sub`. It fades after ~2 seconds. No interruption to the browsing flow, but the stack is visible.
3. On the product detail page, a persistent sidebar (collapsible) shows the staging layer transformation for their event — the field extraction, type casting, session stitching — updating live as they interact. They are seeing Tier 2 *as it happens*, not by opening an overlay.
4. As they add to cart and reach checkout, the sidebar content shifts to show data quality assertions running against their event. `[OK] schema_validation · [OK] null_check · [OK] volume_anomaly`. They feel like they're operating a console, not filling in a form.
5. The confirmation page is the Tier 3 payoff. The existing inline Metabase embeds stay — daily revenue, funnel, AOV — but the visual treatment leans harder into the diagnostic-readout aesthetic. The three IAP-gated extras (ROAS, revenue share, LTV) remain reachable, possibly as additional embedded panels rather than behind a Dashboards tab (which no longer exists in the overlay).
6. They can tap the SessionPulse at any time during this flow to open the overlay. Session State now shows: ecommerce demo 100% complete, X of Y event types fired across the full site. Portal to Services / Contact is one click away.

**What this flow validates:** The demo is worth going through for its own sake. The instrumentation reveals itself in-flow, not by interrupting the flow. The binary overlay-in/overlay-out rhythm is gone.

### Flow C — The direct-hire visitor (came from search)

This visitor googled "server-side GTM consultant Atlanta" and landed on the homepage. They want to see services and pricing and contact info. They are not interested in a 15-minute interactive tour.

1. Visitor lands on the homepage. No conventional nav. They scan the hero, realize this is a consulting site, and look for a Services or Contact link.
2. First escape hatch: they see the pulsing SessionPulse in the nav position where a menu would normally be. Instinct to tap it. Overlay opens to Session State tab. They see "Services" and "Contact" CTAs in the tab itself. Done.
3. Alternatively: they scroll. The Services teaser section has per-tier rows with "See scope →" links to the full Services page. Second escape hatch.
4. Alternatively: they scroll to the footer. Standard footer nav with Home / Services / About / Contact / Demos. Third escape hatch.
5. Alternatively: they scroll all the way to the Final CTA ("Watch it run first. Then hire me."). "Start a conversation" button. Fourth escape hatch.

**What this flow validates:** The nav model is unconventional, but a visitor who wants to leave the maze can do so in under 10 seconds from any point on the homepage. The Session State tab doubles as the richest escape hatch, but it is not the only one.

---

## 3. Components and systems

This section describes what stays, what changes, what's new, and what's removed. It is not a refactor plan — Claude Code owns the phasing and impact mapping. It is the target state the refactor should produce.

### 3.1 Header and navigation

**Target state:**
- Header contains: SessionPulse (primary interaction — opens overlay), logo/brand treatment (optional, no more than a wordmark). No links to Home/Services/About/Contact.
- LiveStrip sits below the header as today, unchanged in function. Its SESSION / STACK / CONSENT / PIPELINE / DASHBOARDS / ATTRIB fields reinforce the instrument-panel framing.
- Mobile: the SessionPulse sits in the position a hamburger menu would occupy (top right). Tapping it opens the overlay to the Session State tab — same behavior as desktop.
- On scroll: header behavior remains as today (sticky, subtle shadow on scroll).

**Removed:**
- Conventional nav links from the header (Home, Services, About, Contact, Demos dropdown).
- MobileSheet slide-in menu (obsolete — the overlay replaces it).

### 3.2 Under the Hood overlay

**Target state:**
- **Default tab on open: Session State** (new — replaces Overview as default).
- **Tabs, in order:** Session State, Timeline, Consent.
- CRT boot sequence, scanlines, amber accent, backdrop-click-to-close, "← Back to site" button: all unchanged.
- Retrofuturism pushed slightly further in the overlay's top nav: tab labels glow amber when active (today), but also get a subtle terminal-style bracket treatment (e.g. `[ SESSION STATE ]` for active, plain for inactive — details in the Session State tab spec below).
- Body content in overlay stays warm cream for legibility; amber is reserved for headers, live data, status tags, progress bars, and navigation.

**Changes to existing tabs:**
- **Timeline tab:** no functional change. Visual treatment aligns with the heightened retrofuture direction — timestamps and event names glow amber; page paths and parameter rows stay warm cream.
- **Consent tab:** no functional change. Status signals (`granted` / `denied`) already read as terminal-style; keep.

**Removed:**
- **Overview tab.** Essential content redistributed: the consent signal table moves to the Session State tab or stays as introductory content on Session State; the pipeline architecture diagram is replaced by the homepage pipeline section's progressive reveal; the live event stream description is redundant with the Timeline tab.
- **Dashboards tab.** This content was Tier 3 demo-payoff material, not Tier 1 showcase. It doesn't belong in a session-scoped overlay. The confirmation page retains its inline Metabase embeds. The three IAP-gated questions that used to live in the Dashboards tab move to the confirmation page as additional embedded panels (see §3.5).
- **EcommerceUnderside routing in the Overview tab.** The overlay no longer shows per-page Tier 2 content when on `/demo/ecommerce/*` routes. All Tier 2 content moves to demo-native reveals (see §3.4).
- **HomepageUnderside component.** Its content is redistributed as described above.

### 3.3 Session State tab (new)

The Session State tab is the overlay's default landing surface and doubles as the primary portal to Services / Contact / About. It has three jobs: (1) show the visitor a gamified view of their session activity, (2) offer clear escape hatches to the rest of the site, (3) lean into retrofuturism with ASCII bars and terminal vocabulary.

**Layout (top to bottom):**

1. **Session header block.** Session ID (short form, e.g. `ses 89dfc3`), session start time, current page. Rendered in amber mono.

2. **Coverage summary.** "Event coverage: X of Y event types triggered" with an ASCII-style progress bar:
   ```
   [██████████░░░░░░░░░░] 10/24 event types
   ```
   Below the bar, a grid of event-type chips — fired events show amber, unfired show dimmed. Visitor can see at a glance what they haven't yet explored.

3. **Ecommerce demo funnel.** Per-demo funnel progress, rendered as a sequential ASCII-style block:
   ```
   PRODUCT_VIEW [OK]
   ADD_TO_CART  [OK]
   CHECKOUT     [  ]
   PURCHASE     [  ]
   ```
   Completion percentage at the bottom. When a stage is not yet reached, it's dimmed. When reached, amber. Progress persists via sessionStorage (see §3.6).

4. **Consent summary.** Three-row compact readout of the visitor's current consent state. Pulled from the same source the Consent tab uses. Appears here as context for the session overall, not as a full consent explainer.

5. **Portal section (the cheap escape).** Terminal-styled list of destinations:
   ```
   > SERVICES     → Four tiers of measurement infrastructure
   > ABOUT        → Ian, Tuna, and the backstory
   > CONTACT      → Start a conversation
   ```
   Each row is a clickable link. Closes the overlay and routes.

6. **Contact form CTA (contextual).** If the visitor has explored beyond a threshold (e.g. triggered >10 event types or reached checkout in the demo), surface a prompt: "Ready to talk? Your session state will ride along with the message." Links to contact with session state pre-attached (see §3.6).

**Retrofuture touches to push further here:**
- All headers glow amber. Body text stays cream.
- ASCII bars rendered in mono with `█` full blocks and `░` empty blocks.
- Status tags in brackets: `[OK]`, `[  ]`, `[SKIPPED]`.
- Section separators use `─` or similar dashes.
- Completion counts prefixed with a `>` prompt character.
- Subtle typing animation on first render of the coverage numbers (respects `prefers-reduced-motion`).

### 3.4 Homepage pipeline section — progressive reveal

**Reference:** `[PLACEHOLDER: insert path to pipeline prototype doc]`

This document scopes the pipeline section's role in the system without re-specifying the effects. Claude Code should implement against the prototype.

**What this document asserts about the pipeline section:**
- It is the primary mechanism by which the editorial surface reveals the underside before the overlay opens. Scrolling into it is the visitor's first exposure to the retrofuture aesthetic.
- By the end of the section, the visitor understands that a "Watch it live" CTA opens a fuller version of the thing they've just seen peeking through. The overlay-open gesture is a continuation, not a state change.
- The section continues to render the real live event stream via `useLiveEvents` — no new data source is introduced.
- Accent color strictly remains persimmon for editorial text within the section. Amber appears only as glow, scanline edges, or bleed-through visual effects attributable to the underside below. This preserves the "accents separated by surface" principle.
- The existing "Watch it live" pill CTA remains. It becomes the primary conversion from progressive reveal to overlay open.
- `prefers-reduced-motion` disables all progressive reveal effects and renders the section in its stable editorial state.

### 3.5 Ecommerce demo — native reveal pattern language

The ecommerce demo abandons the overlay-based Tier 2/3 mechanics in favor of in-flow reveals that use the underside's visual vocabulary but live within the demo pages. The binary "open overlay to see what's happening" gesture is removed from the demo experience. The overlay remains accessible (via the SessionPulse) for deep inspection, but the demo's own reveals carry the primary narrative.

The pattern language has four categories. Each ecommerce funnel page picks one or more.

#### Pattern 1 — Event toast

**What it is:** A small, non-blocking notification that appears near the element the visitor interacted with, showing the event name, primary parameters, and routing destinations. Fades after ~2s.

**Visual treatment:** Amber mono on a dark semi-transparent pill. Slight glow. Positioned contextually (e.g. near the cart icon when `add_to_cart` fires).

**Use for:** Discrete interactions where the reveal is the fact *that* an event fired and where it went. Product click, add to cart, form field focus.

**Example:**
```
> product_view · tuna-plush · $24.99
  → GA4 · BigQuery · Pub/Sub
```

#### Pattern 2 — Live sidebar

**What it is:** A persistent collapsible sidebar on the right side of the page (on desktop; bottom drawer on mobile) that shows live Tier 2 content relevant to the current page. Updates as the visitor interacts. Can be collapsed to a thin amber strip if the visitor finds it distracting.

**Visual treatment:** Dark panel with amber borders and headers. Warm cream body text. Scanlines at low opacity. Contains terminal-style readouts of staging layer transformations, data quality assertions, warehouse writes, etc.

**Use for:** Pages where the narrative benefits from continuous visibility of a transformation process.
- Product detail page → staging layer (field extraction, type casting, session stitching shown for the current event)
- Cart page → data quality assertions checklist (schema, null checks, volume anomaly)
- Checkout page → warehouse write (the row being written to BigQuery, field by field)

**Example (staging layer sidebar on product detail):**
```
STAGING LAYER · stg_events
─────────────────────────
event_name:     product_view
event_timestamp: 2026-04-19T17:32:11Z
session_id:     89dfc3...
page_path:      /demo/ecommerce/tuna-plush
product_id:     tuna-plush       [CAST string → string]
product_price:  24.99            [CAST string → FLOAT64]

[OK] dedupe
[OK] session stitch
[OK] param extract
```

#### Pattern 3 — Inline diagnostic block

**What it is:** A section of the page itself (not a toast, not a sidebar) styled as a terminal readout, embedded in the demo page layout. Reads as part of the page, not as an overlay.

**Visual treatment:** Full-width or column-wide block with dark background, amber headers, warm cream body text. Indistinguishable in layout from a product image or description card; the *content* is what marks it as diagnostic.

**Use for:** Pages where the instrumentation reveal is the primary payoff content, not a side commentary.
- Confirmation page → Tier 3 payoff. Existing inline Metabase embeds stay. The three IAP-gated extras (ROAS, revenue share, LTV) move inline here as additional embedded panels with narrative framing. The page reads as a diagnostic report that contains a receipt, rather than a receipt with dashboards bolted on.

#### Pattern 4 — Full-page diagnostic moment

**What it is:** A deliberate break in the demo flow where the page itself momentarily becomes a full-bleed diagnostic screen before returning the visitor to the demo. Short (1-2 seconds), skippable under `prefers-reduced-motion`.

**Visual treatment:** Full-page dark panel, amber text, scanlines. Shows the event's full journey through the pipeline as a typed-out sequence. Transitions out into the next demo page.

**Use for:** Exactly one moment per demo, where the narrative calls for maximum impact. In ecommerce, recommended placement: between `begin_checkout` and the checkout form render — the moment the event enters the warehouse. The visitor gets a diagnostic "WAREHOUSE WRITE COMPLETE" beat, then the checkout form appears.

**Reserved use; overuse makes the demo feel interrupted. One moment is enough.**

#### Pages and pattern assignments (ecommerce)

| Page | Pattern(s) | Content |
|---|---|---|
| Product listing (`/demo/ecommerce`) | Toast | Campaign taxonomy toast on page load — shows classified UTM from landing. |
| Product detail (`/demo/ecommerce/[id]`) | Toast + Sidebar | Toast on `product_view`. Sidebar shows staging layer for the event. |
| Cart (`/demo/ecommerce/cart`) | Sidebar | Sidebar shows data quality assertions checklist. Updates when line items change. |
| Checkout (`/demo/ecommerce/checkout`) | Sidebar + Full-page | Sidebar shows warehouse write preview. On submit, full-page diagnostic moment fires before confirmation redirect. |
| Confirmation (`/demo/ecommerce/confirmation`) | Inline diagnostic | Existing inline Metabase embeds stay. The three IAP-gated questions move inline as additional embedded panels. Page visual style leans harder into diagnostic readout. |

#### What gets removed from the ecommerce demo

- `EcommerceUnderside` component and its per-page routing in the overlay Overview tab. The overlay no longer shows demo-specific content.
- `CampaignTaxonomyUnderside`, `StagingLayerUnderside`, `DataQualityUnderside`, `WarehouseWriteUnderside`, `Tier3Underside` components — replaced by the patterns above, not by direct port. Some content in these components is worth salvaging (the UTM classification display, the BigQuery row schema readout) — it moves into toasts, sidebars, and inline blocks.
- The "Dashboards" tab routing on `/demo/ecommerce/confirmation` — no longer exists.

### 3.6 Session State — data model

Session State is visible to the visitor (in the overlay's Session State tab), drives the contextual contact-form CTA, and optionally rides along on contact form submissions.

**Storage:** `sessionStorage` keyed as `iampatterson.session_state`. Scoped to the tab lifetime. Not persisted across sessions — by design, a returning visitor starts fresh. This aligns with the SSE session cookie (`_iap_sid`) behavior today.

**Data shape:**

```typescript
interface SessionState {
  session_id: string; // matches _iap_sid cookie
  started_at: string; // ISO 8601
  page_count: number; // unique page paths visited
  events_fired: {
    [event_name: string]: number; // count by event name
  };
  event_type_coverage: {
    fired: string[]; // distinct event names fired
    total: string[]; // all distinct event names defined in the schema (denominator)
  };
  demo_progress: {
    ecommerce: {
      stages_reached: ('product_view' | 'add_to_cart' | 'begin_checkout' | 'purchase')[];
      percentage: number; // 0-100 based on stages_reached.length / 4
    };
    // subscription, leadgen: scaffolded but inactive in this pivot
  };
  consent_snapshot: {
    analytics: 'granted' | 'denied';
    marketing: 'granted' | 'denied';
    preferences: 'granted' | 'denied';
  };
  updated_at: string; // ISO 8601, updated on every change
}
```

**Update source:** The same mechanism that populates `useDataLayerEvents` / `useLiveEvents` populates Session State. A single listener subscribes to the data layer, parses iap_source events, and updates both the event buffer (existing) and the session state blob (new).

**Coverage denominator:** `event_type_coverage.total` lists every distinct `event` name defined in `src/lib/events/schema.ts`. For the first implementation, this is the 16-entry union of the `DataLayerEvent` type. Subscription and lead gen events remain in the denominator even though those demos are out of scope — the visitor sees them as unfired, which subtly communicates that more of the site exists.

**Demo progress trigger map (ecommerce):**

| Stage | Trigger event |
|---|---|
| `product_view` | Any `product_view` event fires |
| `add_to_cart` | Any `add_to_cart` event fires |
| `begin_checkout` | Any `begin_checkout` event fires |
| `purchase` | Any `purchase` event fires |

Progress is monotonic — stages can be reached but not un-reached within a session.

**Contact form serialization:**

On the contact page (`/contact`), add a visible checkbox labeled "Share my session state with this message" (default: checked if marketing consent is granted, unchecked if denied). When checked and the form is submitted, the following payload is serialized into a hidden form field named `session_state`:

```json
{
  "session_id": "89dfc3...",
  "event_types_triggered": 14,
  "event_types_total": 16,
  "ecommerce_demo_percentage": 75,
  "pages_visited": 9,
  "consent": {
    "analytics": "granted",
    "marketing": "denied",
    "preferences": "granted"
  }
}
```

The visible UI below the checkbox shows a human-readable summary of exactly what will be sent: "You've triggered 14 of 16 event types, completed 75% of the ecommerce demo, and visited 9 pages. Your consent state and session ID will ride along." Transparency is the point — the measurement stack doesn't hide from itself.

If the checkbox is unchecked, no session state is included in the submission. No silent transmission under any condition.

**Consent interaction:** When marketing consent is denied, the checkbox is unchecked by default and the UI copy adjusts: "You've denied marketing consent. Session state is off by default — check the box above if you'd like to share it anyway." This treats the visitor's consent decision as the governing signal and makes the override explicit.

---

## 4. Out of scope for this pivot

Explicitly deferred and expected to come back in later phases:

- **Subscription demo** native reveals. Current demo pages remain functional but inherit no new reveal patterns in this pivot. When this demo is reworked, it will reuse the ecommerce pattern language, adapted for the subscription business model (longitudinal reveal — cohort/retention context appearing as the visitor moves through signup and dashboard views).
- **Lead gen demo** native reveals. Same deferral. When reworked, it will emphasize consent-gated routing and PII handling reveals — likely heavy on the live sidebar pattern with consent-state visualization.
- **Tier coverage** in Session State. Today the model uses event-type coverage and ecommerce funnel. Tier-level coverage (have you seen Tier 1 / 2 / 3 demonstrated?) is a richer framing but requires a mapping from events to tiers that this pivot doesn't resolve.
- **Session State persistence across visits.** Today's model is session-scoped (sessionStorage). A returning-visitor "welcome back, continue where you left off" flow is an interesting future direction but out of scope.
- **Sound cues** for retrofuture. Mentioned as a direction earlier. Not included in this pivot — if added later, must be opt-in and `prefers-reduced-motion`-aware.

---

## 5. Design principles — restated as constraints

Rules the refactor must uphold:

1. No conventional nav links in the header. Header contains SessionPulse + brand only.
2. The overlay's default tab on open is Session State.
3. Editorial surfaces use persimmon; underside surfaces use phosphor amber. The pipeline section is allowed to show amber as bleed-through from below, but its editorial text stays persimmon.
4. All motion respects `prefers-reduced-motion`. Progressive reveal, typing effects, full-page diagnostic moment, ASCII bar animations, CRT scanlines — all disabled under reduced motion.
5. All existing data layer events continue to fire correctly. The pivot changes presentation, not instrumentation.
6. Contact form never transmits session state without an explicit, visible, checked checkbox.
7. The overlay remains reachable from the SessionPulse on every page, including demo pages. Demo-native reveals complement the overlay; they do not replace it.
8. Escape hatches from exploration to conversion must exist at the overlay (Session State tab), the footer (every page), and within the homepage scroll (Services teaser, Final CTA).
