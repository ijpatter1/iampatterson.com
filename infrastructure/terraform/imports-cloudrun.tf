# Cloud Run services — brownfield import blocks. Config generated via
# `terraform plan -generate-config-out=...` then cleaned into cloud-run.tf with
# lifecycle ignore_changes on the rolling image (deploy pipeline owns that).

import {
  to = google_cloud_run_v2_service.data_generator
  id = "projects/iampatterson/locations/us-central1/services/data-generator"
}

import {
  to = google_cloud_run_v2_service.event_stream
  id = "projects/iampatterson/locations/us-central1/services/event-stream"
}

import {
  to = google_cloud_run_v2_service.metabase
  id = "projects/iampatterson/locations/us-central1/services/metabase"
}

import {
  to = google_cloud_run_v2_service.sgtm
  id = "projects/iampatterson/locations/us-central1/services/sgtm"
}

import {
  to = google_cloud_run_v2_service.sgtm_preview
  id = "projects/iampatterson/locations/us-central1/services/sgtm-preview"
}
