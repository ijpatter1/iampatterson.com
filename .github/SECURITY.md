# Reporting a security issue

This repository is a consulting site that also runs the measurement stack it
describes: a Next.js front end on Vercel, several Cloud Run services, a
BigQuery pipeline, and a Metabase instance behind Identity-Aware Proxy. It is
maintained by one person, so this policy says what one person can actually do.

## How to report

Use **[private vulnerability reporting](https://github.com/ijpatter1/iampatterson.com/security/advisories/new)**
on this repository. It is the fastest route and it keeps the details out of
public issues until there is a fix.

Please do not open a public issue for a security problem.

Expect an acknowledgement within about three days. If something is being
actively exploited, say so in the first line and I will treat it that way.
I will tell you what I find, whether I am fixing it, and when it ships. If I
decide not to fix something, I will say that too, with the reasoning.

## In scope

- `www.iampatterson.com` and the Next.js application in `src/`
- The embed surface at `bi.iampatterson.com` — `/api/embed/*`, `/embed/*`, `/app/*` are deliberately public; every other Metabase path is IAP-gated and should stay that way
- The Cloud Run services that accept public requests: the Claudish translation proxy, the event-stream relay, and server-side GTM
- The infrastructure definitions in `infrastructure/` — a Terraform or IAM mistake that exposes something is as real as a code bug

## Known and already decided

Reports of these are welcome as *new information*, but the current state is deliberate and documented, so a scanner result alone will not change it:

- **The Claudish proxy accepts unauthenticated requests.** The browser calls it directly, so IAM cannot distinguish a page visitor from `curl`. What bounds it is a daily budget cap, per-IP rate limits, an instance ceiling and a kill switch. The origin check reads a header and is not an authentication control. Replacing this with a real IAM boundary is on the backlog.
- **Demo data is synthetic.** The storefronts and dashboards are generated; there is no customer data in them.
- Findings that amount to a missing hardening header on a demo page, or automated tool output without a demonstrated impact, will usually be closed with thanks and no change.

## Please don't

Test against production carefully, or not at all. Specifically: no automated
scanning or fuzzing against the live hosts, no load testing, no attempts to
reach data that is not yours, and nothing that degrades the service for other
visitors. This site was compromised in September 2026 by an automated scanner
chaining a published CVE, so traffic of that shape gets blocked and reported
rather than read as research.

If you need to demonstrate impact and cannot do it safely, describe the steps
and I will reproduce it myself.

## Good faith

Research that follows this policy is welcome, and I will not pursue or support
action against anyone acting within it. If you find something real, I am happy
to credit you in the advisory — or to keep you anonymous, whichever you prefer.
