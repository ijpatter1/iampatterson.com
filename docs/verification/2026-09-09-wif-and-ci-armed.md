# Workload Identity Federation, and the CI deployer

2026-09-09, session-2026-09-08-002, deliverable [14.3]. Created with Ian's
explicit permission, from `docs/manual/task-2026-09-09-001.md`.

## What exists now

| Resource | Value |
| --- | --- |
| Pool | `projects/262727068689/locations/global/workloadIdentityPools/github` |
| Provider | `.../providers/github`, issuer `https://token.actions.githubusercontent.com` |
| Attribute condition | `assertion.repository == 'ijpatter1/iampatterson.com'` |
| Deployer | `infra-deployer@iampatterson.iam.gserviceaccount.com` |
| Federation binding | `roles/iam.workloadIdentityUser` on the principal set for that one repository |
| Environment | `infra-production`, **1 protection rule**, required reviewer `ijpatter1` |

**No service-account key exists and none should.** The federation binding is
scoped to `attribute.repository/ijpatter1/iampatterson.com`, so a token minted
by any other repository cannot assume this identity. The attribute condition on
the provider is the second half of that: without it the pool would accept an
OIDC token from any GitHub repository on earth.

## The deployer's roles, recorded and justified

[14.3]'s amended wording asks for these to be **recorded and justified rather
than minimised**. Deriving true least privilege for an identity that applies a
whole Terraform root is a research task that would consume the deliverable; the
boundary (one repository) and the approval gate (a required reviewer) are what
the phase delivers. Narrowing this set is a legitimate follow-up.

| Role | Why it is needed |
| --- | --- |
| `roles/run.admin` | the five Cloud Run services in `cloud-run.tf` |
| `roles/compute.networkAdmin` | the LB: forwarding rule, URL map, proxy, backends, NEG, address |
| `roles/compute.loadBalancerAdmin` | managed certificate and the backend service IAP block |
| `roles/cloudsql.admin` | `metabase-app-db` instance, database and user |
| `roles/pubsub.admin` | the events topic and push subscription |
| `roles/bigquery.admin` | the four datasets in `bigquery.tf` |
| `roles/secretmanager.secretAccessor` | reads the IAP client secret version at plan time |
| `roles/serviceusage.serviceUsageAdmin` | the twenty-one entries in `project-services.tf` |
| `roles/iam.serviceAccountAdmin` | the ten accounts in `service-accounts.tf` |
| `roles/iam.serviceAccountUser` | acting as runtime accounts when setting them on services |
| `roles/resourcemanager.projectIamAdmin` | the project IAM members in `iam.tf` |
| `roles/storage.objectAdmin` on `gs://iampatterson-tfstate` | the remote state |

**This is close to the `roles/editor` that [13.4] spent a deliverable removing
from a runtime identity, now reachable from a push to `main`.** That is stated
plainly rather than buried: the difference is that this identity is federated to
one repository, holds no key, and every apply it performs waits on a human
approval. Those three properties are the control, not the role list.

## Order, and why it was followed

The environment was created **before** `vars.GCP_WIF_PROVIDER` was set. GitHub
creates a referenced-but-missing environment implicitly and **unprotected**, so
setting the variable first would have produced an unreviewed auto-apply on every
push to `main` — and that variable also arms `infra-terraform.yml`, which has
been inert behind it since Phase 11.

The five [14.5] Terraform imports were applied first, so no in-flight import
could be performed by an unattended apply.

## Open

**The deployer is not yet a member of GTM account `6346433751`.** The Tag
Manager API authorises on GTM account membership, not GCP IAM: federation
produces an identity, not access. Until that grant exists, `infra-reconcile.yml`
would authenticate and then fail on the first API call. It is a browser step —
`docs/manual/task-2026-09-09-001.md` step 4 — and the repository variables are
deliberately not set until it is done.
