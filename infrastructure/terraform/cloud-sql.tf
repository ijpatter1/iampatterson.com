# Cloud SQL — Metabase application database. Private IP only (no public IPv4),
# reachable from the metabase Cloud Run service over the default VPC. Backups +
# point-in-time recovery enabled.

resource "google_sql_database_instance" "metabase_app_db" {
  project          = var.project_id
  name             = "metabase-app-db"
  region           = var.region
  database_version = "POSTGRES_15"

  # TF-level guard against `terraform destroy` deleting the app DB. The GCP-level
  # settings.deletion_protection_enabled is separately false, matching live.
  deletion_protection = true

  settings {
    tier                        = "db-f1-micro"
    edition                     = "ENTERPRISE"
    availability_type           = "ZONAL"
    disk_type                   = "PD_SSD"
    disk_size                   = 10
    disk_autoresize             = true
    deletion_protection_enabled = false

    backup_configuration {
      enabled                        = true
      location                       = var.region
      point_in_time_recovery_enabled = true
      start_time                     = "03:00"
      transaction_log_retention_days = 7

      backup_retention_settings {
        retained_backups = 7
        retention_unit   = "COUNT"
      }
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = "projects/${var.project_id}/global/networks/default"
      ssl_mode        = "ALLOW_UNENCRYPTED_AND_ENCRYPTED"
      server_ca_mode  = "GOOGLE_MANAGED_INTERNAL_CA"
    }

    location_preference {
      zone = "us-central1-f"
    }
  }
}

resource "google_sql_database" "metabase" {
  project   = var.project_id
  instance  = google_sql_database_instance.metabase_app_db.name
  name      = "metabase"
  charset   = "UTF8"
  collation = "en_US.UTF8"
}

resource "google_sql_user" "metabase" {
  project  = var.project_id
  instance = google_sql_database_instance.metabase_app_db.name
  name     = "metabase"

  # The password lives in Secret Manager (metabase-db-password), is write-only,
  # and is not readable from the API. Leave it unmanaged so Terraform never
  # resets the live password the metabase service authenticates with.
  lifecycle {
    ignore_changes = [password]
  }
}
