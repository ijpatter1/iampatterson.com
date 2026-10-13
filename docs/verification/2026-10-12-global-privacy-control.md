# Global Privacy Control, checked in a browser

2026-10-12, deliverable [15.5]. Branch `feat/15.5-global-privacy-control`.

## What the site does

When a visitor's browser sends Global Privacy Control, marketing consent is
treated as declined whatever the banner says. The three advertising signals
(`ad_storage`, `ad_user_data`, `ad_personalization`) stay denied and
`consent_marketing` is false on every event. Analytics and preferences follow
the visitor's banner choice. The LiveStrip and the overlay's Consent tab both
say the signal was honored.

## What was run

A production build of this branch (`npm run build`, `npm run start`) driven by
Playwright in Chromium 1208, once with the signal and once without.

Three things about the setup limit what this proves:

- **The signal was injected.** Chromium does not send Global Privacy Control,
  so `navigator.globalPrivacyControl` was defined as `true` by an init script
  before any page script ran. A browser that sends the signal natively was not
  used.
- **The banner click was simulated.** The page was told that Cookiebot reported
  all three categories accepted and that its accept event fired, which is what
  the site listens for. Cookiebot's own banner was not on screen.
- **Nothing left the machine.** Every request to a host other than `localhost`
  was aborted, so no tag fired and nothing reached GTM or the server container.
  The Cookiebot loader was answered with an empty script, so Cookiebot's own
  code did not run.

## Result

After the simulated "Accept all":

| | Signal on | Signal off |
| --- | --- | --- |
| `navigator.globalPrivacyControl` | `true` | undefined |
| Consent default, before the choice | all denied | all denied |
| `analytics_storage` | granted | granted |
| `ad_storage`, `ad_user_data`, `ad_personalization` | denied | granted |
| `functionality_storage`, `personalization_storage` | granted | granted |
| `consent_marketing` on the `consent_update` event | false | true |
| LiveStrip consent item | `analytics:granted ad:denied · GPC honored` | `analytics:granted ad:granted` |
| Notice in the overlay's Consent tab | shown | absent |
| Rows marked "Held at denied by Global Privacy Control" | the three advertising rows | none |

The unit tests cover the same behavior without a browser:
`tests/unit/events/global-privacy-control.test.ts`, the "Global Privacy
Control" blocks in `tests/unit/events/track.test.ts`,
`tests/unit/components/overlay/consent-view.test.tsx` and
`tests/unit/components/chrome/live-strip.test.tsx`.

## Still to check

One pass on a preview deployment in a browser that sends the signal natively
(Firefox with "Tell websites not to sell or share my data" on, or Brave),
clicking "Allow all" in the real Cookiebot banner. Two things to look for: the
Consent tab's notice, and the three advertising rows still denied.

## Limits of the feature

- The Cookiebot banner still offers its marketing option to these visitors.
  The site ignores a grant made there and the Consent tab says why.
- Enforcement is in the browser. The server container does not read the
  `Sec-GPC` request header.
