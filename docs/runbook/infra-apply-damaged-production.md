# An infrastructure apply damaged production

Phase 14 put two apply paths behind CI: `infra-terraform.yml` applies the
Terraform root on merge to `main`, and `infra-reconcile.yml` applies and
publishes the GTM web container. Both sit behind the `infra-production`
environment's approval gate, and both can still do damage that an approver did
not foresee — an approved plan is not a correct one.

No alert points here. You arrive because something visible broke shortly after a
merge: the site stopped recording events, the real-time overlay went quiet,
Metabase started refusing everyone, or a demo surface began showing nothing.

**Read this before touching anything: the two systems roll back differently, and
the GTM one is fast.**

## First, decide which apply did it

```bash
gh run list --repo ijpatter1/iampatterson.com --limit 10 \
  --json name,conclusion,createdAt,headSha \
  --jq '.[] | "\(.createdAt) \(.name) \(.conclusion) \(.headSha[0:7])"'
```

`infra-reconcile` touched the GTM container. `infra-terraform` touched GCP
resources. If both ran, treat the GTM one first — it is faster to reverse and
its blast radius is the visitor-facing pipeline.

## GTM: republish the previous version

GTM keeps every published version, which is why the reconciler names them. This
is the fastest rollback in the stack — seconds, no build, no deploy.

```bash
TOKEN=$(CLOUDSDK_CORE_PROJECT=iampatterson gcloud auth print-access-token \
  --impersonate-service-account=gtm-reconciler@iampatterson.iam.gserviceaccount.com \
  --scopes=https://www.googleapis.com/auth/tagmanager.readonly)

curl -s -H "Authorization: Bearer $TOKEN" \
  "https://tagmanager.googleapis.com/tagmanager/v2/accounts/6346433751/containers/247511905/versions" \
  | python3 -c "import json,sys; [print(v['containerVersionId'], v.get('name','(unnamed)')) for v in json.load(sys.stdin).get('containerVersion',[])]"
```

Pick the last known-good id, then publish it with a token minted with the
`tagmanager.publish` scope:

```bash
curl -s -X POST -H "Authorization: Bearer $PUBLISH_TOKEN" \
  "https://tagmanager.googleapis.com/tagmanager/v2/accounts/6346433751/containers/247511905/versions/<ID>:publish"
```

Known-good references as of 2026-09-09: **version 9** is Claudish wiring plus
`analytics_storage` gating; **version 10** adds `web_vital` and
`page_engagement`; **version 11** (`ci: 80a2ff1 on 2026-09-09`) is the first
version CI published and is content-identical to 10 — the apply that made it
reported `no drift`. Going back past 9 removes the consent gate — a privacy
regression, not just a rollback. Do not go past it without meaning to.

**Expect version churn, and do not read a high version number as a change.**
The publish step is deliberately not gated on drift, so every merge touching
`infrastructure/gtm/**` mints a version even when the container is already
converged. Names carry the commit (`ci: <sha> on <date>`), so identify a
known-good version by its name and its commit rather than by assuming the newest
one changed something. If you need to know whether two adjacent versions differ,
diff them rather than trusting the numbering.

**Then reconcile the spec to what you published**, or the next merge re-applies
the bad state. Republishing changes the container; it does not change the
committed spec that CI applies from.

```bash
node infrastructure/gtm/reconcile.js --container=web        # what does the spec now want?
node infrastructure/gtm/reconcile.js --container=web --capture   # or bring the spec to live
```

## Terraform: apply from the previous commit

There is no "undo apply". You re-apply a known-good configuration.

```bash
git log --oneline -10 -- infrastructure/terraform/
git checkout <last-good-sha> -- infrastructure/terraform/
GOOGLE_OAUTH_ACCESS_TOKEN=$(gcloud auth print-access-token) \
  terraform -chdir=infrastructure/terraform plan
```

**Read that plan before applying it.** The brownfield contract in ARCHITECTURE
is explicit: *a destructive plan against the load balancer, IAP, the managed
certificate or Cloud SQL is a release blocker, not an acceptable convergence
step.* If the rollback plan proposes to destroy any of those, stop — you are
about to turn one incident into a worse one. `deletion_protection = true` on
every Cloud Run service will refuse the destroy, which is a backstop and not a
plan you should be running.

If the plan is clean:

```bash
GOOGLE_OAUTH_ACCESS_TOKEN=$(gcloud auth print-access-token) \
  terraform -chdir=infrastructure/terraform apply
```

## Stop the bleeding first if it is still running

Unset the variable that arms both applies. This is a two-second change and it
stops any further automatic apply while you work:

```bash
gh variable delete GCP_WIF_PROVIDER --repo ijpatter1/iampatterson.com
```

Both workflows are gated on `vars.GCP_WIF_PROVIDER != ''`, so removing it
returns them to the inert state they held from Phase 11 until [14.3]. Set it
back when the cause is understood.

## How you know it worked

**GTM:** load `https://www.iampatterson.com/`, accept analytics, and open the
under-the-hood overlay. Events should appear in the timeline within a second or
two. Then confirm they are reaching the warehouse — note that streaming rows
carry a NULL `_PARTITIONTIME` until committed, so a partition filter will hide
them:

```sql
SELECT event_name, COUNT(*) n, MAX(received_timestamp) latest
FROM `iampatterson.iampatterson_raw.events_raw`
WHERE _PARTITIONTIME IS NULL
GROUP BY event_name ORDER BY latest DESC
```

**Terraform:** `terraform plan` reports no changes, and the affected surface
answers — site 200, `/claudish` 200, `io.iampatterson.com/healthy` 200,
`bi.iampatterson.com` 302 (the IAP redirect is the healthy response).

**Both:** the uptime checks from [12.2] clear on their own within their window.
If they do not, the rollback did not address the cause.

## Rehearsal

**Not rehearsed, and deliberately so.** Rehearsing it means applying a knowingly
bad configuration to production, which is the incident this entry exists to
recover from. The GTM half is partly exercised by history: versions 9 and 10
were published through this same path, and the version list the rollback reads
is the one those publishes created.

The Terraform half rests on `terraform plan` being trustworthy, which was
measured on 2026-09-09: a plan across the entire root — five Cloud Run services,
Cloud SQL, Pub/Sub, four BigQuery datasets, ten service accounts, twenty-one
project services — reported no changes. A rollback plan is only readable if the
baseline is honest, and on that date it was.
