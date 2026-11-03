# Global Privacy Control, checked in a browser with the signal injected, then in real browsers

2026-10-12, deliverable [15.5]. Branch `feat/15.5-global-privacy-control`.

## What the site does

When a visitor's browser sends Global Privacy Control, marketing consent is
treated as declined whatever the banner says. The three advertising signals
(`ad_storage`, `ad_user_data`, `ad_personalization`) stay denied and
`consent_marketing` is false on every event. Analytics and preferences follow
the visitor's banner choice. The LiveStrip and the overlay's Consent tab both
say the signal was honored, and only while advertising consent reads denied.

For that to hold, the site's bridge in `src/lib/events/track.ts` has to be the
only thing writing Google Consent Mode. The Cookiebot loader writes it too
unless its script tag carries `data-consentmode="disabled"`, so the tag now
carries it. The Consent Mode defaults are also rendered ahead of the Cookiebot
loader.

The loader signals the raw banner choice in two more ways that attribute does
not cover, and both are turned away at the tag as well:

- A Microsoft consent update, off with `data-ms-consent-mode="disabled"`.
- Plain data-layer events named `cookie_consent_marketing`,
  `cookie_consent_statistics` and `cookie_consent_preferences`. These still
  fire, but `data-layer-name="cookiebotDataLayer"` sends them to an array of
  their own, so they never enter the `dataLayer` GTM reads. No trigger in
  either container listens for them, and a test pins that.

## What was run

A production build of this branch (`npm run build`, `npm run start`) driven by
Playwright in Chromium 1208.

What the setup does and does not prove:

- **The signal was injected.** Chromium does not send Global Privacy Control,
  so `navigator.globalPrivacyControl` was defined as `true` by an init script
  before any page script ran. A browser that sends the signal natively was not
  used.
- **The real Cookiebot loader ran.** Requests to `consent.cookiebot.com` and
  `consentcdn.cookiebot.com` were allowed. The first run of this check answered
  the loader with an empty script; that hid the loader's own Consent Mode
  writes and its result was discarded.
- **The banner was not clicked.** A stored choice granting all three
  categories was supplied as a `CookieConsent` cookie, which is the returning
  visitor's case. The loader read it and reported statistics, marketing and
  preferences all true.
- **The banner was not seen.** The run did not check that Cookiebot's banner
  rendered for the visitor with no stored choice. The loader reported consent
  normally with `data-layer-name` set, and nothing in the loader reads that
  array, but the banner's own dialog script was not inspected.
- **No tag fired.** Requests to every other host were aborted, so GTM never
  loaded and nothing reached the server container. What is observed is the
  data layer, not GTM's resolved consent state or an outgoing hit.

## Result

Returning visitor whose stored choice grants marketing. The loader fired its
accept event on page load for the stored choice, which is how the site's
bridge received it:

| | Signal on | Signal off |
| --- | --- | --- |
| First data layer entry | `consent default`, all denied | `consent default`, all denied |
| Loader's own Google Consent Mode writes | off (`consentModeDisabled` true), none seen | off, none seen |
| Loader's `cookie_consent_*` events in `dataLayer` | none (three in `cookiebotDataLayer`) | none (three in `cookiebotDataLayer`) |
| Loader's Microsoft consent queue (`window.uetq`) | not created | not created |
| Every `consent update` in the data layer: advertising signals | denied | granted |
| Every `consent update`: `analytics_storage` | granted | granted |
| `ads_data_redaction` | stays true | set false |
| `consent_marketing` on site events | false | true |
| LiveStrip consent item | `analytics:granted ad:denied · Global Privacy Control honored` | `analytics:granted ad:granted` |
| Consent tab notice | "Global Privacy Control honored" | absent |
| Consent tab, three advertising rows | denied, each with "Stays denied while your browser sends Global Privacy Control" | granted, no caption |
| Consent tab, analytics and functionality rows | granted, no caption | granted, no caption |

Visitor with the signal on and no stored choice: one `consent default` and one
`consent update`, all denied; the LiveStrip reads
`analytics:denied ad:denied · Global Privacy Control honored`; the Consent tab
shows the notice and the caption on the three advertising rows.

The Consent tab was opened and read in this same run, in all three cases.

Unit tests for the same behavior:
`tests/unit/events/global-privacy-control.test.ts`,
`tests/unit/events/track.test.ts`,
`tests/unit/components/scripts/cookiebot.test.tsx`,
`tests/unit/components/scripts/cookiebot-consent.test.tsx`,
`tests/unit/app/consent-script-order.test.ts`,
`tests/unit/components/overlay/consent-view.test.tsx` and
`tests/unit/components/chrome/live-strip.test.tsx`.

## Checked in real browsers, 2026-11-02

A scripted run against a local production build of `f211c78` and the commit
after it, with the real Cookiebot banner and the real GTM container. Both are
served to `localhost`; the Vercel preview cannot be used, because Cookiebot
does not show its banner there.

- **Firefox with the signal on** (`navigator.globalPrivacyControl === true`,
  `Sec-GPC: 1`). The banner appeared, carrying Cookiebot's own line "The GPC
  signal is honored" and still offering "Allow all". After "Allow all": one
  consent default with everything denied; the last update kept
  `ad_storage`, `ad_user_data` and `ad_personalization` denied and granted
  analytics; no consent row granted an advertising signal; Cookiebot's
  `cookie_consent_*` events went to `cookiebotDataLayer` and none to
  `dataLayer`. The consent update was queued before the `consent_update`
  event, and the GA4 hit for that event carried `gcs=G101`. The Consent tab
  showed the notice and the three "Stays denied" lines, and the LiveStrip read
  `analytics:granted ad:denied · Global Privacy Control honored`, and
  `ad:denied · Global Privacy Control honored` before the choice.
- **Firefox's own hits.** Firefox sends GA4 hits with `sendBeacon`, which the
  automation cannot observe, so they were confirmed in `events_raw`: on the
  first visit and on four reloads, every `scroll_depth` row carried analytics
  consent true and marketing consent false, and no Firefox row from the run
  carried marketing consent true. `events_raw` holds the site's own consent
  fields, not Google's `gcs`.
- **Chromium without the signal.** After "Allow all" the last update granted
  all four signals, and `scroll_depth` reached the server container with
  `gcs=G111`. No notice, no "Stays denied" lines, no mention of the signal.
- **Returning visitors.** On four reloads, and one on a Slow 4G profile,
  `scroll_depth` reached the server container with `G111`. The data layer
  showed `gtm.js` before the stored-consent update on every reload, so GTM's
  page-load evaluation runs under the denied defaults for a returning
  visitor. Analytics events after it are sent; whether `GA4 - Config` itself
  fires on that load was not established.

## Limits of the feature

- The Cookiebot banner still offers its marketing option to these visitors.
  The site ignores a grant made there and the Consent tab says why. With this
  banner type Cookiebot has no setting that hides the option for them alone.
- Cookiebot's own record of the choice is the raw banner answer: after
  "Allow all" its stored consent and its consent log show marketing granted,
  while the site applies a denial.
- A withdrawal's `consent_update` event is now judged under the denied state
  it introduces, so it is sent as GA4 sends any event without analytics
  consent. An acceptance's event is judged under the granted state, which is
  why the update goes first.
- Enforcement is in the browser. The server container does not read the
  `Sec-GPC` request header.
