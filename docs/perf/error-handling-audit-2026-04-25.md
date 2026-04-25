# Error handling — graceful degradation audit

**Phase:** 10d D2
**Date:** 2026-04-25
**Branch:** `phase/10d-launch-prep`

## Scope

The Phase 10d D2 deliverable, verbatim:

> **Error handling: graceful degradation.** WebSocket drop → overlay
> Timeline tab shows last-known-good state, not an infinite spinner.
> BigQuery slow → confirmation page falls back cleanly. Pub/Sub
> latency spikes → event stream catches up without losing events. Pin
> each path with a regression test.

This audit walks each path against the current code, names what's
already protective, identifies the one remaining gap, and points at
the regression test that pins the behavior.

## Path A — WebSocket / SSE drop → Timeline last-known-good

### Architecture

The real-time pipeline uses Server-Sent Events (`EventSource`), not a
WebSocket. The deliverable's wording predates the SSE choice and the
behaviour is identical: a long-lived stream from a Cloud Run service
that the browser holds open, and the question is what happens when
that stream drops.

The pipeline is:

```
sGTM → Pub/Sub → Cloud Run SSE service → browser EventSource → useEventStream → useLiveEvents → Overlay Timeline tab
```

### What protects this path today

`src/hooks/useEventStream.ts`:

- **Buffer state is independent of connection state.** The `events`
  array is React state in the hook; it survives `connecting →
  connected → reconnecting → disconnected` transitions because
  nothing in the connection lifecycle clears the buffer
  (`clearEvents` is opt-in, called only from session-state reset).
- **Exponential backoff with ±20% jitter** (lines 154-180). Phase 10b
  D5: prevents thundering-herd on shared-network blips. Base
  `1000 × 2^(retry-1)`, capped at 30s, multiplied by `0.8 + random ×
  0.4`. Pinned by `tests/unit/hooks/useEventStream.test.ts:397`.
- **`maxRetries=5` ceiling, then `disconnected`** (lines 161-165).
  Status flips to `disconnected` after exhaustion; events buffer is
  preserved. Pinned by `tests/unit/hooks/useEventStream.test.ts:139`.
- **`online` event recovery** (lines 71-86). When the browser goes
  offline → online and we're not currently connected, force a fresh
  reconnect. Pinned by `tests/unit/hooks/useEventStream.test.ts:427`.
- **`useLiveEvents` dataLayer fallback** (`src/hooks/useLiveEvents.ts`).
  When SSE is disabled or has never delivered, the consumer reads
  from `window.dataLayer` instead. Pinned by
  `tests/unit/hooks/useLiveEvents.test.ts`.

`src/components/overlay/event-timeline.tsx`:

- **Renders purely off `events.length`, not connection status.** Two
  branches: empty buffer (line 156) shows a "Waiting for events"
  prose with interaction guidance; populated buffer (line 173)
  shows the row list. There is no spinner branch tied to
  `status='reconnecting'` or `status='disconnected'` — the buffer
  state is what determines what renders. This is the architectural
  invariant that makes "last-known-good" work: as long as something
  has been received once, that something stays visible across drops.

### Gap

None. The architecture is graceful. What was missing was an
explicit pin asserting buffer persistence across an `error → retry`
cycle. Added in this session.

### New regression pin

`tests/unit/hooks/useEventStream.test.ts` — new test in a new
"D2 graceful degradation" describe block: `connect → message → error
→ reconnect cycle preserves the events buffer`. Asserts:

1. Buffer carries one event after `simulateOpen + simulateMessage`.
2. `simulateError` flips status to `reconnecting`; buffer length
   unchanged.
3. After backoff fires and a fresh EventSource is created,
   `simulateOpen` on the new instance flips status to `connected`;
   buffer length still unchanged.
4. A new event delivered on the reconnected stream prepends to the
   preserved buffer (does not start fresh).

## Path B — BigQuery / Metabase slow → confirmation page falls back cleanly

### Architecture

The ecommerce confirmation page (`/demo/ecommerce/confirmation`) is
where the demo's Tier 3 payoff lands: the same dashboard a real BI
team would consume, embedded via a server-signed JWT. The signing
chain:

```
Vercel env (METABASE_EMBED_CONFIG + MB_EMBEDDING_SECRET_KEY)
  → mintConfirmationDashboardUrl()
  → DashboardPayoff <iframe src=signedUrl>
  → bi.iampatterson.com/embed/dashboard/<jwt>
  → Metabase queries BigQuery via metabase-bigquery@ SA
  → returns rendered dashboard HTML/JS
```

Two failure modes need graceful degradation:

1. **Env vars missing** — happens in local dev / preview without
   Vercel env wired. `mintConfirmationDashboardUrl` returns `null`;
   the page renders a visible fallback with a deep-link to the
   IAP-gated dashboard.
2. **Metabase slow / cold-start / unreachable** — env vars are
   wired, JWT signing succeeds, the iframe is mounted, but the
   target either takes >15s (cold-start under
   `cpu-throttling=true` per the 9B follow-up #1) or never loads.

### What protects this path today

- **Null-signer fallback** in `DashboardPayoff` (lines 35-55).
  When `dashboardUrl` is null, the iframe is not mounted and the
  visitor sees prose with a deep-link to `bi.iampatterson.com/dashboard/2`
  behind Google SSO. Pinned by
  `tests/unit/components/demo/ecommerce/dashboard-payoff.test.tsx:26`.

### Gap (closed in this session)

When the iframe IS mounted but never loads — Metabase is cold,
unreachable, or returning a non-loadable response — the iframe just
hangs. The 1100px-tall blank rectangle is the visitor's experience.
The browser-native iframe load behaviour gives no signal we can
graceful-degrade on its own.

This was carried as **9B follow-up #2** ("`LiveEmbedFrame`
load-failure timeout") and re-evaluated against the current
`DashboardPayoff` shape (the 9F rebuild collapsed three iframes into
one full-dashboard iframe; the load-timeout concern is unchanged).

### Fix

`DashboardPayoff` now sets a 15-second `useEffect` timer when
`dashboardUrl` is non-null. The iframe's `onLoad` callback clears
the timer (and sets a `loaded` flag). If the timer fires before
`onLoad`, the component flips into a load-timeout fallback variant
that mirrors the null-signer fallback's shape: `InlineDiagnostic`
chrome, prose explaining the situation honestly ("dashboard didn't
load — Metabase may be in cold-start"), and the same deep-link CTA
to `bi.iampatterson.com/dashboard/<id>`.

The 15-second budget is chosen against the 9B follow-up #1's
observation that JVM warmup can take ~60s with `cpu-throttling=true`.
15s is well under that cold-start envelope, but it's also long
enough that a typical warm load (single-digit seconds at most)
cleanly clears the timer. If we later set `--no-cpu-throttling`
(per 9B follow-up #1), the budget can drop to 8-10s.

### New regression pins

`tests/unit/components/demo/ecommerce/dashboard-payoff.test.tsx`,
new "load timeout" describe block:

1. Iframe load timer fires at 15s without `onLoad` → fallback prose +
   deep-link render; iframe is unmounted.
2. Iframe `onLoad` before 15s → timer cancelled, iframe stays
   mounted, no fallback rendered.
3. Null `dashboardUrl` → no timer scheduled (existing null-fallback
   path is unchanged).

## Path C — Pub/Sub latency spikes → event stream catches up without losing events

### Architecture

Pub/Sub is the reliable buffer between sGTM (publisher) and the
Cloud Run SSE service (subscriber via push). Latency spikes can come
from any of:

- sGTM container slowness on a publish burst
- Pub/Sub backend congestion or eventual-delivery semantics
- Cloud Run SSE service auto-scaling delay during a connection burst
- Subscriber redelivery after an ack timeout

"Catches up without losing events" means: when latency normalises and
a backlog flushes, the browser receives the backlog as a burst of SSE
messages, displays them in the Timeline, and the per-message dedupe
prevents redelivery from inflating the counts.

### What protects this path today

`src/hooks/useEventStream.ts`:

- **Per-message deduplication** (lines 138-150). On every incoming
  message, the hook checks if the buffer already contains an event
  with the same `event_name`, `timestamp`, AND `page_path` triple.
  If so, the message is dropped. This catches both:
  - Pub/Sub at-least-once redelivery (same logical event delivered
    twice by Pub/Sub itself)
  - Duplicate GTM tags firing the same event into the data layer
  Pinned by `tests/unit/hooks/useEventStream.test.ts:304`.
- **Buffer cap at `maxBufferSize=100`** (line 150). When a backlog
  burst exceeds 100 events, the oldest events are evicted in
  newest-first order. The buffer never grows unbounded; the visible
  Timeline always shows the most recent 100 events. Memory footprint
  is bounded. Pinned by `tests/unit/hooks/useEventStream.test.ts:271`
  (`maxBufferSize=2`) and `:289` (default 100 with 110 events).

`Cloud Run SSE service` (out of scope for this audit, but for
completeness): the push subscription's ack deadline determines how
fast Pub/Sub will redeliver an unacked message. The service acks
on Pub/Sub message receipt before fanning out to SSE listeners, so
slow listeners can't trigger redelivery. (This is the right
trade-off because the events are visible-on-this-visit only —
non-delivery to a listener that disconnected mid-flight is
acceptable.)

### Gap

None. The architecture handles backlog catch-up correctly: dedupe
prevents inflation, buffer cap prevents memory growth, the visitor
sees a burst of events in their Timeline that catches up to current
state. What was missing was an explicit pin combining the two
behaviours into a single backlog-burst scenario.

### New regression pin

`tests/unit/hooks/useEventStream.test.ts`, new "D2 graceful
degradation" describe block: `simulated Pub/Sub backlog burst caps
the buffer and dedupes redeliveries`. Asserts that delivering a
mixed burst of:

- 60 unique events
- 10 redelivered duplicates of the previous 10 (same event_name +
  timestamp + page_path triple)
- 50 more unique events

…yields a buffer of exactly 100 events (the cap), with the 10
redelivered duplicates not in the buffer (deduped on arrival), and
the buffer ordering is most-recent-first across the cap.

## Out of scope

- **Server-side error handling** (Cloud Run SSE service exception
  paths, Pub/Sub publish failures, sGTM container errors). These
  would be Phase 11 monitoring + alerting concerns; D2 is purely
  the client-side graceful-degradation surface.
- **`useLiveEvents` dataLayer-fallback path** is already pinned by
  its own test file; this audit walks past it because it was
  shipped in 9A-redesign (commit `b013a0c`) and the pin already
  exists.
- **Generic error boundaries.** No top-level React `ErrorBoundary`
  exists today and adding one is a net-new feature, not graceful
  degradation of an existing path. Phase 10d D2 stays scoped to
  the three paths the deliverable names.

## Summary

| Path | Pre-D2 state | D2 work | Test pin |
| --- | --- | --- | --- |
| A · WebSocket drop → Timeline | Architecturally graceful (buffer state independent of connection status) | Added explicit buffer-survives-reconnect pin | `useEventStream.test.ts` D2 block |
| B · BigQuery slow → confirmation | Null-signer fallback only; iframe-load timeout missing | Added 15s `useEffect` timer in `DashboardPayoff` + load-timeout fallback variant | `dashboard-payoff.test.tsx` "load timeout" block |
| C · Pub/Sub latency → event stream | Architecturally graceful (dedupe + buffer cap) | Added explicit backlog-burst pin combining dedupe + cap | `useEventStream.test.ts` D2 block |

**Result:** all three paths the deliverable names are covered.
Architecture changes were minimal (one new timer); the bulk of D2
is verifying-and-pinning what was already protective.
