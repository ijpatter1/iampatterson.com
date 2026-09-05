# A public surface is down

**Alerts that lead here:** the uptime checks `site-www`
(`https://www.iampatterson.com/`) and `metabase-lb`
(`https://bi.iampatterson.com/`).

These two are grouped because the diagnosis is the same shape and the systems
behind them are entirely different.

## `site-www` — the website itself

The site is a Next.js application on Vercel. It is not on Google Cloud, so none
of the `gcloud` commands elsewhere in this runbook apply to it.

**Diagnose.** Confirm the failure from outside, then check whether Vercel knows:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://www.iampatterson.com/
curl -s -o /dev/null -w '%{http_code}\n' https://iampatterson.com/
```

The apex redirects to `www` in production, so both should end at 200. If the
apex works and `www` does not, the problem is DNS or the redirect rather than the
application.

Then look at the Vercel dashboard for the most recent deployment. A failed build
does not take the site down — the previous deployment keeps serving — so a site
that is down with a green build is a different problem from a site that is down
after a red one.

**Fix.** If a bad deployment is serving, roll back to the previous one from the
Vercel dashboard. This is a browser action; there is no CLI path configured in
this project. If the build itself is failing, see
[Vercel build failing](vercel-build-failing.md).

## `metabase-lb` — the BI surface

Metabase runs as a Cloud Run service reachable only through an HTTPS load
balancer at `bi.iampatterson.com`, with Identity-Aware Proxy in front of it.

**An important quirk:** an unauthenticated request to `bi.iampatterson.com` gets
an IAP redirect, and the uptime check treats that as healthy. That is correct —
it proves the load balancer, the certificate and IAP are all working. A failure
here therefore means something structural, not a login problem.

**Diagnose.** Work outward from the service:

```bash
gcloud run services describe metabase --project=iampatterson --region=us-central1 \
  --format='value(status.conditions[0].message, status.traffic[0].revisionName)'

gcloud compute backend-services get-health metabase-backend --global --project=iampatterson

gcloud compute ssl-certificates list --project=iampatterson \
  --format='value(name, managed.status, managed.domainStatus)'
```

The three usual causes, in order of likelihood: the Cloud Run service is down,
the backend has no healthy instances, or the managed certificate has a problem —
for which see [certificate renewal failure](certificate-renewal-failure.md).

**Fix.** If Metabase itself is down, it is an ordinary Cloud Run service and
[a revision that will not start](revision-will-not-start.md) applies. If the load
balancer topology is wrong, it is described in
`infrastructure/terraform/metabase-lb.tf` and `terraform plan` will show any
drift between what is declared and what exists.

## How you know it worked

```bash
curl -s -o /dev/null -w 'site:     %{http_code}\n' https://www.iampatterson.com/
curl -s -o /dev/null -w 'metabase: %{http_code}\n' https://bi.iampatterson.com/
```

The uptime check runs on its own schedule and the alert closes by itself once two
consecutive probes succeed. You do not need to close it.

## Rehearsal

Rehearsed on 2026-09-05 against `site-www`, the check that guards the public
site, using the same technique Phase 12 used on a sibling check: the check is
pointed at a path that does not exist, so the *check* fails while the site is
untouched.

The check's own probe results, read back from
`monitoring.googleapis.com/uptime_check/check_passed`:

```
15:19  1.00
15:20  0.50   <-- failing
15:21  0.00
15:22  0.00
15:23  0.00
15:24  0.00
15:25  0.00
15:26  0.50   <-- recovering
15:27  1.00
```

Six continuous minutes of total failure against a policy whose duration is `60s`
with a trigger count of 1, routed to both notification channels. The alert fired.
`https://www.iampatterson.com/` returned 200 throughout, which is the property
that makes this rehearsal safe to run: the site was never affected.

**What was not machine-confirmed, and why it is recorded rather than glossed.**
The rehearsal script reads its own alert back off the Pub/Sub channel to prove
delivery. Its read timed out client-side while waiting for the recovery
notification, and the subscription was empty afterwards — consistent with the
OPEN notification having been pulled and acknowledged before the timeout, but not
proof of it. So the firing is established from the probe series and the policy
configuration rather than from the notification itself.

Two things this cost, worth carrying: the script restored the check anyway,
because the restore is in a `finally` block rather than after the wait — a
crashed rehearsal left the check correct, which is the behaviour you want from
something that deliberately breaks production monitoring. And the run was
captured through `tail`, which discarded the progress output and left only a
traceback; a rehearsal's log is evidence and should be captured whole.
