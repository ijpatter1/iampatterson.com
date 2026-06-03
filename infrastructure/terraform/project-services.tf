locals {
  # Curated subset of the project's enabled APIs that this stack depends on.
  # Terraform only manages what is listed here; it will not disable the other
  # enabled services (it only knows about resources in state).
  enabled_services = [
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "sql-component.googleapis.com",
    "compute.googleapis.com",
    "pubsub.googleapis.com",
    "bigquery.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudscheduler.googleapis.com",
    "iap.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "dataform.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "artifactregistry.googleapis.com",
    "serviceusage.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "servicenetworking.googleapis.com",
  ]
}

resource "google_project_service" "enabled" {
  for_each = toset(local.enabled_services)

  project = var.project_id
  service = each.value

  # Keep production APIs enabled even if a resource is removed from Terraform;
  # disabling an API is far more disruptive than leaving it on.
  disable_on_destroy         = false
  disable_dependent_services = false
}
