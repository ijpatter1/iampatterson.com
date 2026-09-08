# Certificate renewal failure

**Alert that leads here:** `TLS certificate expiring within 14 days on a
monitored surface`.

## How certificates work here, and how they are watched

`bi.iampatterson.com` uses a Google-managed SSL certificate on the Metabase load
balancer. Google renews it automatically. `io.iampatterson.com` and the site are
fronted by Cloud Run and Vercel respectively, which manage their own.

The monitoring is indirect and worth understanding, because it constrains what
this alert can see. **Google publishes no metric for managed certificate
expiry.** Expiry is measured instead by
`monitoring.googleapis.com/uptime_check/time_until_ssl_cert_expires`, which comes
from the Phase 12 uptime checks. The consequence: a host has certificate
monitoring only if it also has an uptime check. Add a public surface without an
uptime check and its certificate is unwatched.

## Diagnose

What does the certificate actually say?

```bash
echo | openssl s_client -servername bi.iampatterson.com \
  -connect bi.iampatterson.com:443 2>/dev/null \
| openssl x509 -noout -dates -issuer
```

What does Google think its status is?

```bash
gcloud compute ssl-certificates list --project=iampatterson \
  --format='value(name, type, managed.status, managed.domainStatus)'
```

`ACTIVE` with a domain status of `ACTIVE` is healthy. `PROVISIONING` means a
renewal is in flight. `FAILED_NOT_VISIBLE` is the one that matters: it means
Google cannot validate the domain, almost always because DNS no longer points at
the load balancer's IP.

## Fix

**If the domain status is `FAILED_NOT_VISIBLE`**, check DNS against the load
balancer address:

```bash
gcloud compute addresses list --project=iampatterson --global \
  --format='value(name, address)'
dig +short bi.iampatterson.com
```

Those must match. If they do not, the DNS record was changed and fixing it lets
the renewal proceed on its own; provisioning takes up to about an hour after DNS
is correct.

**If the certificate is genuinely stuck**, a managed certificate can be replaced,
but that is a load balancer change and belongs in
`infrastructure/terraform/metabase-lb.tf` rather than being done by hand — the
topology is declared there and a hand change will show as drift.

**Do not** let it lapse quietly. The alert fires at 14 days, which is deliberate
slack: DNS propagation plus provisioning is measured in hours, so two weeks is
comfortable rather than tight.

## How you know it worked

```bash
echo | openssl s_client -servername bi.iampatterson.com \
  -connect bi.iampatterson.com:443 2>/dev/null | openssl x509 -noout -enddate
```

The expiry date has moved out, and the uptime check `metabase-lb` stays green.

## Rehearsal

Not rehearsed. You cannot fail a certificate renewal on demand: the failure is
Google declining to renew, usually because of a DNS condition, and staging it
means pointing production DNS away from the load balancer and waiting weeks for
the alert window.

Two honest qualifications. The uptime rehearsal of 2026-09-04 was performed on
`claudish-proxy-health`, not on a certificate-bearing host, so it establishes the
mechanism rather than this signal — the inference from a sibling is an inference.
And the alert is a metric threshold, so it *could* be fired without touching DNS
by temporarily raising the threshold above the live days-to-expiry, the same
misconfigure-and-restore technique used twice on uptime checks here. That was
considered and not done: it mutates a live alert policy for a signal whose
delivery path is already evidenced, and a policy left misconfigured by a crashed
rehearsal is a worse outcome than an unrehearsed entry. The trade is recorded so
the next person can weigh it differently.
