# Certificate renewal failure

**Alert that leads here:** `TLS certificate expiring within 14 days on a
monitored surface`.

## How certificates work here, and how they are watched

Nothing in this project issues a certificate by hand. Each monitored host gets
its certificate from whoever serves it, and each renews on its own:

| Host | Served by | Certificate |
| --- | --- | --- |
| `io.iampatterson.com` | Cloud Run domain mapping onto `sgtm` | Google-managed, issued through the mapping. DNS is a CNAME to `ghs.googlehosted.com`. |
| `www.iampatterson.com` | Vercel | Vercel-managed (Let's Encrypt). DNS is a CNAME into Vercel. |
| `event-stream-eb4xrwmo3q-uc.a.run.app` | Cloud Run | Google's `*.run.app` certificate. Nothing of ours to renew. |
| `claudish-proxy-eb4xrwmo3q-uc.a.run.app` | Cloud Run | Google's `*.run.app` certificate. Nothing of ours to renew. |

The hosts are the ones in `infrastructure/monitoring/spec/uptime.json`. The
`bi.iampatterson.com` certificate on the Metabase load balancer was the one
certificate this project declared itself; it went with Metabase in [18.3].

The monitoring is indirect and worth understanding, because it constrains what
this alert can see. **Google publishes no metric for managed certificate
expiry.** Expiry is measured instead by
`monitoring.googleapis.com/uptime_check/time_until_ssl_cert_expires`, which comes
from the Phase 12 uptime checks. The consequence: a host has certificate
monitoring only if it also has an uptime check. Add a public surface without an
uptime check and its certificate is unwatched.

## Diagnose

The alert groups by `resource.labels.host`; read it first. Then see what the
certificate on that host actually says:

```bash
HOST=io.iampatterson.com   # the host named in the alert
echo | openssl s_client -servername "$HOST" -connect "$HOST:443" 2>/dev/null \
| openssl x509 -noout -dates -issuer
```

**`io.iampatterson.com`.** Ask Cloud Run what it thinks of the mapping, and check
DNS still points at Google:

```bash
gcloud beta run domain-mappings describe --domain=io.iampatterson.com \
  --project=iampatterson --region=us-central1 \
  --format='yaml(status.conditions, status.resourceRecords)'
dig +short io.iampatterson.com CNAME
```

`Ready`, `CertificateProvisioned` and `DomainRoutable` all `True` is healthy, and
the CNAME should be `ghs.googlehosted.com.`. `CertificateProvisioned` going
`False` almost always means Google can no longer validate the domain because DNS
stopped pointing there.

**`www.iampatterson.com`.** The certificate is Vercel's. The project's Domains
page in the Vercel dashboard shows it and any validation error. There is no CLI
path configured in this project.

**A `*.run.app` host.** Google renews that certificate for every Cloud Run
service. An expiring one is Google's incident, not ours: check the Google Cloud
status page rather than changing anything here.

## Fix

**If DNS for `io` changed**, put the CNAME back to `ghs.googlehosted.com.` at the
registrar. The mapping re-provisions on its own once DNS is correct, which takes
up to about an hour.

**If the `io` mapping is stuck with DNS correct**, stop and take it to Ian. The
mapping is not in Terraform, and the remaining lever is deleting and re-creating
it, which leaves sGTM unreachable on `io` until the new certificate is issued and
loses every visitor's events for that window. That is a decision, not a step.

**If it is `www`**, follow the error Vercel shows. A failed renewal there is
almost always a DNS change.

**Do not** let it lapse quietly. The alert fires at 14 days, which is deliberate
slack: DNS propagation plus provisioning is measured in hours, so two weeks is
comfortable rather than tight.

## How you know it worked

```bash
echo | openssl s_client -servername "$HOST" -connect "$HOST:443" 2>/dev/null \
| openssl x509 -noout -enddate
```

The expiry date has moved out, and the host's uptime check stays green.

## Rehearsal

Not rehearsed. You cannot fail a certificate renewal on demand: the failure is
the provider declining to renew, usually because of a DNS condition, and staging
it means pointing production DNS away from the service and waiting weeks for the
alert window.

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
