# The four BigQuery datasets.
#
# These were imported into state on 2026-06-08 by a session that never committed
# their configuration. For three months afterwards `terraform plan` proposed to
# destroy them — the whole warehouse — because state held resources no `.tf` file
# described. The configuration below is written to match what is live, so the
# plan converges to a no-op. It is a recovery of lost work, not a new
# declaration, and the resource addresses are the ones already in state, so no
# import blocks are needed here.
#
# `delete_contents_on_destroy` stays at its default of false on every dataset. A
# destroy against a non-empty dataset has to fail loudly rather than drop tables.
#
# Table schemas are not managed here. They are created by
# `infrastructure/bigquery/setup.sh` from the committed `schema.json` files, and
# the event-schema checklist in `.claude/rules/project-coding-standards.md` owns
# their evolution. Terraform owns the dataset; the scripts own its contents.

resource "google_bigquery_dataset" "raw" {
  project     = var.project_id
  dataset_id  = "iampatterson_raw"
  location    = "US"
  description = "Raw event stream from sGTM for iampatterson.com"

  # Sixty days, on tables and partitions alike. 13.1 owns whether this value is
  # right; this line records what is live so the plan is honest in the meantime.
  default_table_expiration_ms     = 5184000000
  default_partition_expiration_ms = 5184000000
}

resource "google_bigquery_dataset" "staging" {
  project    = var.project_id
  dataset_id = "iampatterson_staging"
  location   = "US"
}

resource "google_bigquery_dataset" "marts" {
  project    = var.project_id
  dataset_id = "iampatterson_marts"
  location   = "US"
}

resource "google_bigquery_dataset" "assertions" {
  project    = var.project_id
  dataset_id = "iampatterson_assertions"
  location   = "US"
}
