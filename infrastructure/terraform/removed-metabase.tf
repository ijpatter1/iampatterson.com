# [18.3] Metabase is retired. Its service, app database instance, load balancer,
# service accounts and project grants were deleted from this root and plan as
# destroys; [18.10] lifted the deletion protection that would have refused them.
#
# The database and the user inside the instance are forgotten, not destroyed.
# Nothing orders their deletion after the metabase service's, so the database
# delete can run while Metabase still holds connections, which Postgres refuses,
# and Postgres also refuses to drop a role that still owns objects. Either would
# stop the apply part-way through the teardown. Deleting the instance removes
# both, so Terraform only needs to stop tracking them.
#
# Once the apply has run, these blocks do nothing and can be deleted.

removed {
  from = google_sql_database.metabase

  lifecycle {
    destroy = false
  }
}

removed {
  from = google_sql_user.metabase

  lifecycle {
    destroy = false
  }
}
