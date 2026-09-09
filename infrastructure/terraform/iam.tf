# Project-level IAM for the runtime identities.
#
# [13.4] moved every Cloud Run service off the default compute account onto
# dedicated runtime accounts with least privilege, and proved each move by
# sending events through and counting rows. What it did not do was declare the
# grants: this root held no IAM resources of any kind, so every binding existed
# only in live IAM, `terraform plan` reported "No changes" while describing none
# of it, and nothing would have detected a revocation. [14.5] closes that.
#
# `_iam_member` throughout, never `_iam_binding` or `_iam_policy`. The member
# resources are additive: they leave principals this configuration does not name
# alone. An authoritative resource on a project-level role would revoke every
# other holder of that role on first apply — including Google-managed service
# agents. A test asserts no authoritative Cloud Run IAM resource appears
# anywhere in this root for the same reason.
#
# Dataset-level grants (the `WRITER` access entries [13.4] added for three
# accounts) are NOT here: they live on the BigQuery datasets, and adding them
# would mean declaring `google_bigquery_dataset_access` alongside the existing
# `google_bigquery_dataset` resources, which is a separate change with its own
# import surface. Recorded as outstanding rather than half-done.

locals {
  # Only project-level roles, measured from the live policy on 2026-09-09.
  # sgtm-runtime and event-stream-runtime deliberately hold none: sGTM writes
  # through the BigQuery tag's own credentials and event-stream only reads a
  # push subscription, so neither needs a project role. That absence is the
  # least-privilege result [13.4] was after, and is recorded here so a future
  # reader does not "fix" it by granting something.
  runtime_project_roles = {
    claudish_proxy_aiplatform = {
      member = "serviceAccount:claudish-proxy@iampatterson.iam.gserviceaccount.com"
      role   = "roles/aiplatform.user"
    }
    data_gen_runtime_bigquery_job = {
      member = "serviceAccount:data-gen-runtime@iampatterson.iam.gserviceaccount.com"
      role   = "roles/bigquery.jobUser"
    }
    metabase_runtime_cloudsql = {
      member = "serviceAccount:metabase-runtime@iampatterson.iam.gserviceaccount.com"
      role   = "roles/cloudsql.client"
    }
    metabase_bigquery_job = {
      member = "serviceAccount:metabase-bigquery@iampatterson.iam.gserviceaccount.com"
      role   = "roles/bigquery.jobUser"
    }
  }
}

resource "google_project_iam_member" "runtime" {
  for_each = local.runtime_project_roles

  project = var.project_id
  role    = each.value.role
  member  = each.value.member
}
