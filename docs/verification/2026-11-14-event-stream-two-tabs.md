# Event stream: every tab gets its events (15.7), 2026-11-14

## What shipped

The event-stream service keeps one connection per tab, up to five per session; a sixth is refused with 429. Closing a tab removes only its own connection. Before this change, a second tab on one session stayed connected and received nothing, because the first tab's close handler removed the second tab's entry.

## Deploy

- `scripts/deploy-cloud-run.sh deploy event-stream infrastructure/cloud-run/event-stream` built `event-stream-00013-tnx` with no traffic. Its diff against the serving `event-stream-00012-65v` showed the image digest only, with 0 other fields changed (`deploys/event-stream-00013-tnx.diff`).
- The revision reported `Ready`. `promote event-stream event-stream-00013-tnx` routed all traffic to it, and `/health` answered 200 on it.

## Live check, production

The checks ran in a scripted Chromium against `https://www.iampatterson.com`, with two pages in one browser context, so both had one session cookie. A wrapper on `EventSource` counted the messages each page received.

- **Two tabs, both opened after consent:** both streams opened with the same session ID. While all activity (a scroll, then a navigation) happened in tab B, tab A received 10 of the session's events.
- **One tab closed:** after tab B closed, tab A kept receiving on the same connection. Scrolling in A brought 2 more events.
- **Connections:** `/health` counted several connections at once, one per open tab.

## Found during the check: the session splits when the visitor consents

The check first ran with tab A opened before consent, and A received nothing once consent was given. The cause:

- When the visitor submits consent, Cookiebot deletes `_iap_sid` (`uc.js`, `resetForCookieTable`), because its cookie scan lists `_iap_sid` as Unclassified.
- The site then mints a new session ID.
- A stream opened before consent stays subscribed to the old ID, so on a first visit the open page's panel stops receiving stream events until a reload.

This happens on any first visit where the visitor accepts, whether one tab is open or several. It predates 15.7 and is tracked separately.

These runs added a handful of rows to production `events_raw`, from a headless browser with consent granted.
