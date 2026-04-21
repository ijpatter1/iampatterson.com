# Phase 9e UAT Feedback

## Scenario 1

The three tab labels should be amber, not just the active tab label. The active tab is indicated by the terminal bracket framing.
I think the Explore the Site section should be at the top of the Session State page.
I think the Session State page should be renamed Overview. And then the Overview page will have two main sections- the nav at the top, and the Session State sections comprising the rest of the page.
On desktop, the font is on the small side. Can we adhere to general guidelines for body text size and WCAG 2.2 standards for resizing?
On desktop, the page feels sparse and the elements are stacked when it seems like the smaller elements could be in columns.

## Scenario 2

Due to the lack of nav, each non-homepage page needs a "Back to Homepage" CTA. Navigating back to / via footer is too much friction.

## Scenario 4

I don't see a typewriter effect.
I don't like the "watch it live" copy. I feel like we need to consolidate the language around the underside. So far we have "Look under the hood" "Watch it Live" "Flip" "Watch it run first" "Under the Hood". To be honest, I don't particularily like any of these.
I think I only want the pipeline bleed effect to happen once. Once the user has opened the underside overlay, remove the effect and don't have it activate on scroll.
The metadata on the Pipeline section has the values clipping the keys. Also, I want you to critically review the kv pairs and determine if sharing them adds anything or it's just clutter. Or if it's wise to share the sGTM host subdomain for example.

## Scenario 5

I don't like the language "The subscription demo is being rebuilt, **it'll return after the ecommerce rebuild ships.**" we can just say "Returning soon" something.
Step 5.3 showed an error message:
```
1 of 1 error
Next.js (14.2.35) is outdated (learn more)
Unhandled Runtime Error
Error: There was an error while hydrating this Suspense boundary. Switched to client rendering.
See more info here: https://nextjs.org/docs/messages/react-hydration-error
Call Stack
React
```
I don't like the language "The lead gen demo is being rebuilt, **it'll return after the ecommerce rebuild ships.**" we can just say "Returning soon" something.

## Scenario 6

Sorry, for step 6.4 I accidently failed the step. Coverage milestone fired at 25% and 50% but didn't refire on reload.
Some of the events cannot be triggered right now, click_nav and the ones from the demos that aren't live. Maybe the should be hidden.

## Scenario 7

Since we moved the "Explore the Site" section to the top of the Overview page, the Contextual contact CTA should also show the top of the Overview page.
Sorry for step 7.4 I mistakenly failed the step

## Scenario 8

Backdrop click does NOT close overlay.

## Scenario 11 - Mobile-viewport visitor navigates the pivot [mobile]

SessionPulse is top-left
NavHint fires but is too big and clips
The Hero section CTAs aren't above the fold on mobile
Overlay header is too cluttered, between the logo, the "Under the Hood" title, "Live - this sessions, under the hood". It's too much, needs to be cut back to what is useful.
On mobile (360px), the terminal bracket framing is being pushed on to new lines, like this:
"""
[
    Terminal
]
""".We need to make sure it all stays on one line.
On mobile (360px), some of the events under Event Coverage are a) spilling over the boundaries of their boxes and b) being pushed on to new lines, like this:
"""
>
session_state_tab_view
""". It all needs to stay on one line.
The metadata on the Pipeline section has the values clipping the keys.
The collapsing and expanding readouts cause the elements on the screen to move up and down when not scrolling and it is annoying.
On the demo section, the eyebrow takes up too much of the screen. It's basically 7-8 lines.

## Scenario 12

I'm not sure how I feel about the hover label. It's kind of undermining the experimental navigation concept we're doing. Also, same reservation about the "Under the Hood" language that I raised earlier.

## Scenario 16

Tab A reload did not preserve session state
Tab B shared Tab A's session ID but did not share activity