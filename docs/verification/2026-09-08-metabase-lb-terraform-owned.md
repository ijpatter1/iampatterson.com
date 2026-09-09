# Metabase load balancer, retired onto Terraform

2026-09-08, session-2026-09-08-002, deliverable [14.2].

## The plan is a no-op

```
terraform -chdir=infrastructure/terraform plan
...
No changes. Your infrastructure matches the configuration.
```

Eight resources refreshed against live: the serverless NEG, the global address,
both backend services, the URL map, the managed certificate, the HTTPS proxy and
the forwarding rule. `metabase-lb.tf` describes the load balancer as it actually
runs, which is the whole premise of retiring the scripts.

This is the first acceptance criterion and it is why [14.2] was rewritten. As
originally worded the deliverable would have built a second reconciler over
resources Terraform already owned — two writers on one URL map, which is the 9F
`/app/*` drift family re-armed.

## The IAP service agent is now declared

`google_cloud_run_v2_service_iam_member.metabase_iap_agent` grants
`roles/run.invoker` to `service-262727068689@gcp-sa-iap.iam.gserviceaccount.com`
on the `metabase` Cloud Run service, with an import block because it already
exists live.

```
Plan: 1 to import, 0 to add, 0 to change, 0 to destroy.
```

**Applied 2026-09-08** by Ian, from his own shell after the classifier blocked
an unattended production apply:

```
Apply complete! Resources: 1 imported, 0 added, 0 changed, 0 destroyed.
```

A following `terraform plan` reports no differences, and the live surfaces are
unaffected: `bi.iampatterson.com` 302 (the IAP sign-in redirect, which is the
healthy response), the site 200, sGTM 200.

**The apply refreshed the entire root, not just the load balancer** — all five
Cloud Run services, the SQL instance and database, the Pub/Sub topic and push
subscription, four BigQuery datasets, ten service accounts and twenty-one
project services. Every one came back with no drift. That is a stronger
statement than this deliverable's acceptance asked for: the whole declarative
layer matches live, not only the topology under review.

The resource type carries the safety property: `_iam_member` is additive and
leaves members this configuration does not name alone. `_iam_binding` or
`_iam_policy` would have revoked every other holder of `run.invoker` on first
apply, including the `allUsers` binding below. A test asserts neither
authoritative type appears in the file.

## Where the residue went

| What | Home | Why not Terraform |
| --- | --- | --- |
| IAP OAuth brand | `docs/runbook/metabase-access.md` | Console-only for Internal user type; gcloud cannot configure the consent screen |
| IAP OAuth client | same | Created once against the brand; its id is a literal in `metabase-lb.tf`, its secret read from Secret Manager |
| `metabase-iap-client-id` / `-secret` versions | same | Secret *values* never enter state; the runbook says add a version, not recreate |
| `roles/iap.httpsResourceAccessor` allowlist | same | Additive-only by design. Declared, a deleted line would revoke access on the next merge and restoring it would be a pull request |
| IAP service agent `run.invoker` | **declared** in `metabase-lb.tf` | Losing it 403s every browser while the service is healthy, with nothing naming the cause |

## Rehearsed

The runbook's read path was run against live IAP:
`roles/iap.httpsResourceAccessor` returns one member,
`user:Ian@tunameltsmyheart.com`. The service-agent check returned the expected
binding. Grant and revoke are deliberately not rehearsed — the only account
available is the sole allowlist member, so a revoke drill would lock the only
person out and the restore would run from credentials just revoked.

## Found on the way

`allUsers` holds `roles/run.invoker` on the `metabase` Cloud Run service. Not an
active exposure: the service is `INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER`, so the
public internet cannot reach it and IAP is the only route in. But the controls
are independent, and loosening ingress would make Metabase publicly invokable
with no IAP check. Recorded in `metabase-lb.tf`, the runbook and here, for a
person to decide rather than revoked in passing.

## Retired

`infrastructure/metabase/setup-domain.sh` (399 lines) and `setup-iap.sh` (356).
Seven test assertions moved rather than deleted: the URL-map split assertions in
`tests/unit/metabase/dashboards.test.ts` were parsing the script's source, and
`tests/unit/infrastructure/terraform-metabase-lb.test.ts` already pins the same
split against `metabase-lb.tf` as an exact set — stronger than the substring
checks were, and it catches what the script could not, since `setup-domain.sh`
never learned about the `/app/*` path added after the 9F incident.
