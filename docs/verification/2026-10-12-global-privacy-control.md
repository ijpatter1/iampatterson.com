# Global Privacy Control, checked in a browser with the signal injected

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

## Still to check

On a preview deployment, in a browser that sends the signal natively (Firefox
with "Tell websites not to sell or share my data" on, or Brave):

1. Confirm the Cookiebot banner appears, then click "Allow all".
2. In the console, read `dataLayer` and confirm no `consent update` grants an
   advertising signal.
3. In GTM preview, confirm the consent state on the next hit shows the three
   advertising signals denied.
4. Open the overlay's Consent tab and confirm the notice and the three rows.

Also on the preview, without the signal: accept in the banner and confirm
analytics tags still fire. Turning off the loader's own Consent Mode writes
changes who grants consent for every visitor, not only those sending the
signal.

## Limits of the feature

- The Cookiebot banner still offers its marketing option to these visitors.
  The site ignores a grant made there and the Consent tab says why. Whether
  Cookiebot's settings can hide or pre-decline that option for them has not
  been checked.
- Enforcement is in the browser. The server container does not read the
  `Sec-GPC` request header.
