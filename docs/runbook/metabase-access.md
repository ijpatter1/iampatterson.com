# Granting and revoking Metabase access

Metabase at `bi.iampatterson.com` sits behind an Identity-Aware Proxy. Reaching
it requires two things: a Google account on the allowlist, and the IAP service
agent being able to invoke the Cloud Run service behind the load balancer.

No alert points here. This is a procedure you run deliberately, not a response
to something breaking — with one exception, the 403 case at the bottom, which is
what a missing service-agent binding looks like.

## Why this is a procedure and not configuration

Everything else about the load balancer is declared in
`infrastructure/terraform/metabase-lb.tf` and applied by Terraform. The
allowlist deliberately is not.

`setup-iap.sh`, retired in [14.2], reconciled the allowlist **additively** —
adding members, never removing them — and said why:

> if someone's entry gets accidentally commented out or removed from git and
> the script is re-run, a remove-on-drift design would silently lock them out.
> Manual removal keeps the failure mode visible.

Declaring the allowlist in Terraform would reverse exactly that. With
`infra-terraform.yml` applying on merge to `main`, deleting a line from a file
would revoke a person's access on the next push, and restoring it would be a
pull request. Access to the BI tool should not be a merge away from vanishing,
so the allowlist stays here, as a command a person runs on purpose.

The one IAM binding that *is* declared is the IAP service agent's
`run.invoker`, because losing it breaks the tool for everyone at once and
nothing in the logs says why.

## Grant access

```bash
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=metabase-backend \
  --member='user:someone@example.com' \
  --role='roles/iap.httpsResourceAccessor' \
  --project=iampatterson
```

`--member` takes the usual IAM forms: `user:`, `group:`, or
`serviceAccount:`. Group membership is the better lever if this list grows past
a handful of people.

Access is immediate. Ask them to open <https://bi.iampatterson.com> and sign in
with the Google account you named — not a different one they happen to be
signed into, which is the usual reason a fresh grant appears not to work.

## Revoke access

```bash
gcloud iap web remove-iam-policy-binding \
  --resource-type=backend-services \
  --service=metabase-backend \
  --member='user:someone@example.com' \
  --role='roles/iap.httpsResourceAccessor' \
  --project=iampatterson
```

Revocation is deliberate and manual by design. Nothing reconciles this list, so
nothing will remove a member you forgot about either — see the audit below.

## See who has access

```bash
gcloud iap web get-iam-policy \
  --resource-type=backend-services \
  --service=metabase-backend \
  --project=iampatterson \
  --format='table(bindings.role, bindings.members)'
```

Worth running at the dependency-cadence review (`dependency-cadence.md`), since
nothing else will surface a stale member.

## Everyone gets 403, and the service is healthy

This is the failure the declared binding exists to prevent. If IAP can
authenticate a browser but not forward the request, every user sees 403 while
`metabase` itself answers fine and neither the load balancer nor the service
logs name a cause.

Check the binding is present:

```bash
gcloud run services get-iam-policy metabase \
  --project=iampatterson --region=us-central1 \
  --format=json | grep -A3 'run.invoker'
```

`serviceAccount:service-262727068689@gcp-sa-iap.iam.gserviceaccount.com` must
hold `roles/run.invoker`. If it is missing, `terraform apply` restores it — it
is declared at `metabase-lb.tf`, resource
`google_cloud_run_v2_service_iam_member.metabase_iap_agent`. If the service
agent itself no longer exists, recreate it first:

```bash
gcloud beta services identity create --service=iap.googleapis.com --project=iampatterson
```

## Rebuilding IAP from nothing

Only needed if the OAuth brand or client is deleted. Neither is in Terraform:
the brand is created through the console for Internal user type and cannot be
automated, and the client is created once against that brand. The client id is
recorded in `metabase-lb.tf` and the secret is read from Secret Manager.

1. **OAuth consent screen** — console only. APIs & Services → OAuth consent
   screen, User Type **Internal**, app name "iampatterson BI", your address as
   the support email. gcloud cannot configure this.
2. **OAuth client:**
   ```bash
   gcloud iap oauth-brands list --project=iampatterson
   gcloud iap oauth-clients create <BRAND_NAME> --display_name='Metabase IAP' --project=iampatterson
   ```
3. **Store the credentials.** Both secrets already exist; add a new version to
   each rather than recreating them. Note the asymmetry, because stopping here
   leaves IAP broken: only the **secret** is read from Secret Manager by
   Terraform (`data.google_secret_manager_secret_version.metabase_iap_client_secret`).
   The client **id** is a literal in `metabase-lb.tf`, so storing it here
   records it but changes nothing until step 4:
   ```bash
   printf '%s' '<client-id>'     | gcloud secrets versions add metabase-iap-client-id     --data-file=- --project=iampatterson
   printf '%s' '<client-secret>' | gcloud secrets versions add metabase-iap-client-secret --data-file=- --project=iampatterson
   ```
4. **Update the client id** in `metabase-lb.tf` and `terraform apply`. This is
   not optional bookkeeping — it is what puts the new client on the backend
   service. Skip it and IAP keeps failing against the old client.
5. **Re-grant the allowlist** using the command above — it does not survive a
   brand rebuild.

## How you know it worked

**After a grant:** the person opens <https://bi.iampatterson.com>, signs in with
the account you named, and lands on Metabase rather than a Google error page. If
they see "You don't have access", they are signed into a different Google
account than the one on the allowlist — the commonest cause by far, and it looks
identical to a failed grant.

**After a revoke:** the audit command above no longer lists them. An already-open
browser session may keep working until its IAP cookie expires, so revocation is
not instant for someone currently signed in.

**After restoring the service-agent binding:** any allowlisted person can load
the tool again. The 403 clears immediately; there is no cache to wait out.

**In every case** the audit command is the ground truth, not the browser:

```bash
gcloud iap web get-iam-policy --resource-type=backend-services \
  --service=metabase-backend --project=iampatterson
```

## Rehearsal

**Partially rehearsed 2026-09-08**, during [14.2].

The read path was run against live IAP and returned what this entry says it
does: `roles/iap.httpsResourceAccessor` with one member,
`user:Ian@tunameltsmyheart.com`. The service-agent check was run the same way
and confirmed
`serviceAccount:service-262727068689@gcp-sa-iap.iam.gserviceaccount.com` holds
`roles/run.invoker` on the `metabase` service — which is also how the `allUsers`
binding noted below was found.

**The grant and revoke paths are deliberately not rehearsed.** Both change who
can reach the BI tool in production, and the only account available to rehearse
against is the sole member of the allowlist — so a revoke rehearsal would lock
the only person out of the tool, and the restore would have to run from the same
credentials that had just been revoked. The commands are the ones `setup-iap.sh`
ran on every invocation before it was retired, so they are exercised by history
rather than by a drill.

**The rebuild-from-nothing path is not rehearsed** and cannot be safely: it
requires deleting the OAuth brand, which would revoke everyone's access and put
the recovery behind a console step that cannot be scripted.

## Recorded, not managed

`allUsers` holds `roles/run.invoker` on the `metabase` Cloud Run service. This
is not an active exposure: the service is
`INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER`, so the public internet cannot reach it
directly and IAP is the only route in. But the two controls are independent, and
loosening ingress would make Metabase publicly invokable with no IAP check.
Removing the binding is a production IAM change with its own blast radius, so it
is named here rather than revoked in passing.
