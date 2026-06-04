# Cloud SQL (Metabase app DB) — brownfield import blocks. Instance config is
# generated via generate-config-out then cleaned into cloud-sql.tf; the database
# and user are hand-written. The default `postgres` database and `postgres` user
# are left provider-unmanaged (auto-created with the instance).

import {
  to = google_sql_database_instance.metabase_app_db
  id = "projects/iampatterson/instances/metabase-app-db"
}

import {
  to = google_sql_database.metabase
  id = "projects/iampatterson/instances/metabase-app-db/databases/metabase"
}

import {
  to = google_sql_user.metabase
  id = "iampatterson/metabase-app-db/metabase"
}
