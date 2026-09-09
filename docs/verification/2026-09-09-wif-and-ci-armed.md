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
| `roles/run.admin` | the six Cloud Run services in `cloud-run.tf` |
| `roles/compute.networkAdmin` | the LB: forwarding rule, URL map, proxy, backends, NEG, address |
| `roles/compute.loadBalancerAdmin` | managed certificate and the backend service IAP block |
| `roles/cloudsql.admin` | `metabase-app-db` instance, database and user |
| `roles/pubsub.admin` | the events topic and push subscription |
| `roles/bigquery.admin` | the four datasets in `bigquery.tf` |
| `roles/secretmanager.secretAccessor` | reads the IAP client secret *payload* at plan time |
| `roles/secretmanager.viewer` | reads that secret's *metadata* — added 2026-09-09, see below |
| `roles/serviceusage.serviceUsageAdmin` | the twenty-one entries in `project-services.tf` |
| `roles/iam.serviceAccountAdmin` | the ten accounts in `service-accounts.tf` |
| `roles/iam.serviceAccountUser` | acting as runtime accounts when setting them on services |
| `roles/resourcemanager.projectIamAdmin` | the project IAM members in `iam.tf` |
| `roles/storage.objectAdmin` on `gs://iampatterson-tfstate` | the remote state |

### The grant was incomplete, and the first real plan proved it

The list above originally ended at eleven roles. The first CI `terraform plan` —
run against PR #75 on 2026-09-09, the first time this identity did real work —
failed:

```
Error: error retrieving available secret manager secret versions:
googleapi: Error 403: Permission 'secretmanager.versions.get' denied
```

`roles/secretmanager.secretAccessor` carries `secretmanager.versions.access` and
nothing else. The `google_secret_manager_secret_version` data source at
`metabase-lb.tf:75` reads the version's **metadata** before its payload, and
`versions.get` lives in `roles/secretmanager.viewer`. Verified by diffing the two
role definitions rather than guessing:

| Role | Relevant permissions |
|---|---|
| `secretmanager.secretAccessor` | `versions.access` |
| `secretmanager.viewer` | `secrets.get`, `secrets.list`, `versions.get`, `versions.list` |

Granted at project level (Ian's call, offered against a secret-scoped
alternative): it is read-only metadata with no payload access, consistent with
how the other eleven were granted, and it does not break again when the root
gains a second secret data source. The plan then reported **"No changes. Your
infrastructure matches the configuration."**

The lesson is the phase's own: a role list that had been *recorded and justified*
on paper still had a hole, and only running the thing found it. Twelve roles now,
plus `storage.objectAdmin` on the state bucket.

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

## Armed

Ian added `infra-deployer@iampatterson.iam.gserviceaccount.com` to GTM account
`6346433751` with **Publish** on both containers. The Tag Manager API authorises
on that membership, not on GCP IAM — federation produces an identity, not
access — so without it the workflow would have authenticated and then failed on
its first API call.

The repository variables were then set, which is the step that arms **both**
workflows:

```
GCP_WIF_PROVIDER = projects/262727068689/locations/global/workloadIdentityPools/github/providers/github
GCP_DEPLOYER_SA  = infra-deployer@iampatterson.iam.gserviceaccount.com
```

`terraform plan` was confirmed a no-op immediately beforehand, so the apply job
this arms has nothing outstanding to perform.

## Open

**Verified on the first run.** PR #75 fired `infra-reconcile` and it posted:

```
## GTM reconciler — dry run
── web container ──── no drift
── server container ──── no drift
```

That single comment exercises the whole chain at once: WIF minted a token from a
GitHub OIDC assertion, the attribute condition admitted it, the deployer's GTM
membership let it read both containers, the reconciler diffed the committed
specs against live, and the comment step posted the result — read from `env:`,
not compiled into the script body. `no drift` is the correct answer: the web
container is at version 10 and the server spec was captured from live.

It also settles the open question below. Had the GTM membership been missing,
this would have failed with a Tag Manager permission error rather than a diff.

**Superseded — the deployer's GTM access was not independently verified before
the run.** The intended check
was to impersonate `infra-deployer` and call the accounts endpoint, but the
`serviceAccountTokenCreator` binding created for that test was still propagating
when the session ended — the same lag the `gtm-reconciler` grant showed earlier,
which cleared after a few minutes. The membership Ian granted is what matters
and is not in doubt; only my shortcut for confirming it early is missing.

**The real verification was [14.3]'s own acceptance, and it has since run**
(see "Verified on the first run" above; this paragraph is superseded as of
2026-09-09). At the time of writing it had not run: one
pull request showing the dry-run comment, one merge showing the approval gate
and a successful apply. Both need the branch pushed, which `bash-guard` reserves
to a person. Until that happens this deliverable is armed but unproven.

If the first dry run fails with a Tag Manager permission error rather than a
diff, the cause is that membership rather than anything in the workflow — check
it in the GTM UI before debugging the CI.
