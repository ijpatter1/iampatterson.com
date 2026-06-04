# Terraform — GCP infrastructure-as-code

Canonical declarative source of truth for the Terraform-supported GCP resources in the `iampatterson` project (Phase 11 deliverable 9). See `../../docs/REQUIREMENTS.md` (Phase 11 D9) and `../../docs/ARCHITECTURE.md` (Phase 11 IaC section) for scope, carve-outs, and the brownfield-import contract. `IMPORT_INVENTORY.md` is the live-resource census this config adopts.

## Layout

Flat root module (import-friendly for a project this size):

| file | purpose |
|---|---|
| `versions.tf` | Terraform + provider version constraints |
| `backend.tf` | GCS remote state (`gs://iampatterson-tfstate`) |
| `providers.tf` | `google` provider config |
| `variables.tf` / `terraform.tfvars` | project id/number + region (non-secret) |
| `project-services.tf` | curated enabled APIs |
| `service-accounts.tf` | user-created service accounts |
| `imports.tf` | one-time brownfield `import {}` blocks |

Resource modules (networking/LB, Cloud Run, Cloud SQL, Pub/Sub, BigQuery, Scheduler, secrets, IAM, monitoring) land in subsequent files as each is imported — see the build order in `IMPORT_INVENTORY.md`.

## Prerequisites

- Terraform `>= 1.7` (uses `for_each` in `import {}` blocks).
- Application Default Credentials for an `iampatterson`-project admin:
  ```
  gcloud auth application-default login
  gcloud auth application-default set-quota-project iampatterson
  ```

## Usage

```bash
cd infrastructure/terraform
terraform init        # configures the GCS backend, downloads providers
terraform fmt -check  # formatting gate
terraform validate    # config validity gate
terraform plan        # shows the import set + any drift (read-only)
```

### Brownfield adoption

`imports.tf` adopts existing live resources. The sequence:

1. `terraform plan` — review: it should report resources **to import** and **no** create/destroy. A planned *destroy* of any live resource (LB, IAP, SSL, Cloud SQL) is a release blocker, not an acceptable convergence step.
2. `terraform apply` — persists the imports to state. With a clean plan this mutates **state only**, not infrastructure.
3. `terraform plan` again — must be a no-op. That no-op is the standing proof the config matches reality.

Never run `apply` on this stack without reviewing the plan first.

## Carve-outs (not managed here)

GTM/sGTM container *config* (no TF provider — `../gtm/` reconciler), the GA4 export dataset, Google-managed default SAs, the Cloud Build / Cloud Run source buckets, the state bucket itself, and the Vercel frontend. Full list in `IMPORT_INVENTORY.md`.
