# Cloud Run services. Bootstrapped from `terraform plan -generate-config-out`
# against the live services, so the imported plan is a no-op.
#
# Deploy-volatile fields are ignored so Terraform owns the durable service shell
# (ingress, service account, scaling, resources, env wiring, secret refs, VPC)
# while the app deploy pipeline (gcloud / source builds) owns the rolling image,
# build source, and client annotations. data-generator + event-stream are
# source-deploy (build_config is regenerated each deploy); metabase + sgtm +
# sgtm-preview run published images. The spec said sgtm 'tracks
# gtm-cloud-image:stable, Google's recommended auto-updating tag'; 13.2 measured
# that on 2026-09-05 and it is not true in the way it reads. Cloud Run resolves a
# tag to a digest at revision-creation time, so both services had been serving the
# 2026-04-03 digest for five months while :stable moved on without them. The image
# is in ignore_changes either way; updates go through
# infrastructure/sgtm/update-image.sh, which pins the digest deliberately.
#
# `traffic` is ignored on every service for the same reason, added by 13.7 on
# 2026-09-05. `scripts/deploy-cloud-run.sh promote` exists to route traffic to
# one exact revision after its field diff is reviewed, so live traffic is pinned
# to a revision while this configuration asks for LATEST. Left unignored, the two
# fight: a plan reports drift after every promote, and an apply would silently
# undo the operator's deliberate choice of which revision serves. Traffic routing
# belongs to the deploy scripts; Terraform owns the service shell.

resource "google_cloud_run_v2_service" "event_stream" {
  lifecycle {
    ignore_changes = [
      client,
      client_version,
      build_config,
      template[0].containers[0].image,
      traffic,
    ]
  }

  annotations          = {}
  client               = "gcloud"
  client_version       = "562.0.0"
  custom_audiences     = []
  deletion_protection  = true
  description          = null
  ingress              = "INGRESS_TRAFFIC_ALL"
  invoker_iam_disabled = false
  labels               = {}
  launch_stage         = "GA"
  location             = "us-central1"
  name                 = "event-stream"
  project              = "iampatterson"
  build_config {
    base_image               = null
    enable_automatic_updates = false
    environment_variables    = {}
    function_target          = null
    image_uri                = "us-central1-docker.pkg.dev/iampatterson/cloud-run-source-deploy/event-stream"
    service_account          = null
    source_location          = "gs://run-sources-iampatterson-us-central1/services/event-stream/1774639598.729245-b28da7c088fa4b21b047c5a01511742a.zip#1774639606725908"
    worker_pool              = null
  }
  scaling {
    manual_instance_count = 0
    min_instance_count    = 0
    scaling_mode          = null
  }
  template {
    annotations                      = {}
    encryption_key                   = null
    execution_environment            = null
    gpu_zonal_redundancy_disabled    = false
    labels                           = {}
    max_instance_request_concurrency = 80
    revision                         = null
    service_account                  = "262727068689-compute@developer.gserviceaccount.com"
    session_affinity                 = true
    timeout                          = "3600s"
    containers {
      args           = []
      base_image_uri = null
      command        = []
      depends_on     = []
      image          = "us-central1-docker.pkg.dev/iampatterson/cloud-run-source-deploy/event-stream@sha256:509ff798c3985bd6138fc5f97cd194b239fa5007c9c6689fc7448b5ab4d08c2c"
      name           = null
      working_dir    = null
      env {
        name  = "ALLOWED_ORIGINS"
        value = "https://iampatterson-com.vercel.app,https://iampatterson.com"
      }
      ports {
        container_port = 8080
        name           = "http1"
      }
      resources {
        cpu_idle = true
        limits = {
          cpu    = "1"
          memory = "256Mi"
        }
        startup_cpu_boost = true
      }
      startup_probe {
        failure_threshold     = 1
        initial_delay_seconds = 0
        period_seconds        = 240
        timeout_seconds       = 240
        tcp_socket {
          port = 8080
        }
      }
    }
    scaling {
      max_instance_count = 1
      min_instance_count = 1
    }
  }
  traffic {
    percent  = 100
    revision = null
    tag      = null
    type     = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }
}

# __generated__ by Terraform from "projects/iampatterson/locations/us-central1/services/sgtm-preview"
resource "google_cloud_run_v2_service" "sgtm_preview" {
  lifecycle {
    ignore_changes = [
      client,
      client_version,
      template[0].containers[0].image,
      traffic,
    ]
  }

  annotations          = {}
  client               = "gcloud"
  client_version       = "562.0.0"
  custom_audiences     = []
  deletion_protection  = true
  description          = null
  ingress              = "INGRESS_TRAFFIC_ALL"
  invoker_iam_disabled = false
  labels               = {}
  launch_stage         = "GA"
  location             = "us-central1"
  name                 = "sgtm-preview"
  project              = "iampatterson"
  scaling {
    manual_instance_count = 0
    min_instance_count    = 0
    scaling_mode          = null
  }
  template {
    annotations                      = {}
    encryption_key                   = null
    execution_environment            = "EXECUTION_ENVIRONMENT_GEN2"
    gpu_zonal_redundancy_disabled    = false
    labels                           = {}
    max_instance_request_concurrency = 80
    revision                         = null
    service_account                  = "262727068689-compute@developer.gserviceaccount.com"
    session_affinity                 = false
    timeout                          = "300s"
    containers {
      args           = []
      base_image_uri = null
      command        = []
      depends_on     = []
      image          = "gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable"
      name           = null
      working_dir    = null
      env {
        name  = "CONTAINER_CONFIG"
        value = "aWQ9R1RNLU5UVEtaRldEJmVudj0xJmF1dGg9NFdjUnRFRFFVRFdiOUJRdG5GNDhwdw=="
      }
      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = "iampatterson"
      }
      env {
        name  = "RUN_AS_PREVIEW_SERVER"
        value = "true"
      }
      ports {
        container_port = 8080
        name           = "http1"
      }
      resources {
        cpu_idle = false
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        startup_cpu_boost = true
      }
      startup_probe {
        failure_threshold     = 1
        initial_delay_seconds = 0
        period_seconds        = 240
        timeout_seconds       = 240
        tcp_socket {
          port = 8080
        }
      }
    }
    scaling {
      max_instance_count = 1
      min_instance_count = 0
    }
  }
  traffic {
    percent  = 100
    revision = null
    tag      = null
    type     = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }
}

# __generated__ by Terraform from "projects/iampatterson/locations/us-central1/services/sgtm"
resource "google_cloud_run_v2_service" "sgtm" {
  lifecycle {
    ignore_changes = [
      client,
      client_version,
      template[0].containers[0].image,
      traffic,
    ]
  }

  annotations          = {}
  client               = "gcloud"
  client_version       = "562.0.0"
  custom_audiences     = []
  deletion_protection  = true
  description          = null
  ingress              = "INGRESS_TRAFFIC_ALL"
  invoker_iam_disabled = false
  labels               = {}
  launch_stage         = "GA"
  location             = "us-central1"
  name                 = "sgtm"
  project              = "iampatterson"
  scaling {
    manual_instance_count = 0
    min_instance_count    = 0
    scaling_mode          = null
  }
  template {
    annotations                      = {}
    encryption_key                   = null
    execution_environment            = "EXECUTION_ENVIRONMENT_GEN2"
    gpu_zonal_redundancy_disabled    = false
    labels                           = {}
    max_instance_request_concurrency = 80
    revision                         = null
    service_account                  = "262727068689-compute@developer.gserviceaccount.com"
    session_affinity                 = false
    timeout                          = "300s"
    containers {
      args           = []
      base_image_uri = null
      command        = []
      depends_on     = []
      image          = "gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable"
      name           = null
      working_dir    = null
      env {
        name  = "CONTAINER_CONFIG"
        value = "aWQ9R1RNLU5UVEtaRldEJmVudj0xJmF1dGg9NFdjUnRFRFFVRFdiOUJRdG5GNDhwdw=="
      }
      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = "iampatterson"
      }
      env {
        name  = "PREVIEW_SERVER_URL"
        value = "https://sgtm-preview-262727068689.us-central1.run.app"
      }
      ports {
        container_port = 8080
        name           = "http1"
      }
      resources {
        cpu_idle = false
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        startup_cpu_boost = true
      }
      startup_probe {
        failure_threshold     = 1
        initial_delay_seconds = 0
        period_seconds        = 240
        timeout_seconds       = 240
        tcp_socket {
          port = 8080
        }
      }
    }
    scaling {
      max_instance_count = 3
      min_instance_count = 1
    }
  }
  traffic {
    percent  = 100
    revision = null
    tag      = null
    type     = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }
}

# __generated__ by Terraform from "projects/iampatterson/locations/us-central1/services/data-generator"
resource "google_cloud_run_v2_service" "data_generator" {
  lifecycle {
    ignore_changes = [
      client,
      client_version,
      build_config,
      template[0].containers[0].image,
      traffic,
    ]
  }

  annotations          = {}
  client               = "gcloud"
  client_version       = "562.0.0"
  custom_audiences     = []
  deletion_protection  = true
  description          = null
  ingress              = "INGRESS_TRAFFIC_ALL"
  invoker_iam_disabled = false
  labels               = {}
  launch_stage         = "GA"
  location             = "us-central1"
  name                 = "data-generator"
  project              = "iampatterson"
  build_config {
    base_image               = null
    enable_automatic_updates = false
    environment_variables    = {}
    function_target          = null
    image_uri                = "us-central1-docker.pkg.dev/iampatterson/cloud-run-source-deploy/data-generator"
    service_account          = null
    source_location          = "gs://run-sources-iampatterson-us-central1/services/data-generator/1777042254.30433-9692a10eaa804fb2b4455d7511cc6344.zip#1777042265618441"
    worker_pool              = null
  }
  scaling {
    manual_instance_count = 0
    min_instance_count    = 0
    scaling_mode          = null
  }
  template {
    annotations                      = {}
    encryption_key                   = null
    execution_environment            = null
    gpu_zonal_redundancy_disabled    = false
    labels                           = {}
    max_instance_request_concurrency = 80
    revision                         = null
    service_account                  = "262727068689-compute@developer.gserviceaccount.com"
    session_affinity                 = false
    timeout                          = "3600s"
    containers {
      args           = []
      base_image_uri = null
      command        = []
      depends_on     = []
      image          = "us-central1-docker.pkg.dev/iampatterson/cloud-run-source-deploy/data-generator@sha256:a924d9e143cf2a55fa88ac8134666a3049210d939d2d88bb53593a3ab32f02a8"
      name           = null
      working_dir    = null
      ports {
        container_port = 8080
        name           = "http1"
      }
      resources {
        cpu_idle = true
        limits = {
          cpu    = "1000m"
          memory = "1Gi"
        }
        startup_cpu_boost = true
      }
      startup_probe {
        failure_threshold     = 1
        initial_delay_seconds = 0
        period_seconds        = 240
        timeout_seconds       = 240
        tcp_socket {
          port = 8080
        }
      }
    }
    scaling {
      max_instance_count = 10
      min_instance_count = 0
    }
  }
  traffic {
    percent  = 100
    revision = null
    tag      = null
    type     = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }
}

# __generated__ by Terraform from "projects/iampatterson/locations/us-central1/services/metabase"
resource "google_cloud_run_v2_service" "metabase" {
  lifecycle {
    ignore_changes = [
      client,
      client_version,
      template[0].containers[0].image,
      traffic,
    ]
  }

  annotations          = {}
  client               = "gcloud"
  client_version       = "562.0.0"
  custom_audiences     = []
  deletion_protection  = true
  description          = null
  ingress              = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"
  invoker_iam_disabled = false
  labels               = {}
  launch_stage         = "GA"
  location             = "us-central1"
  name                 = "metabase"
  project              = "iampatterson"
  scaling {
    manual_instance_count = 0
    min_instance_count    = 0
    scaling_mode          = null
  }
  template {
    annotations                      = {}
    encryption_key                   = null
    execution_environment            = "EXECUTION_ENVIRONMENT_GEN2"
    gpu_zonal_redundancy_disabled    = false
    labels                           = {}
    max_instance_request_concurrency = 10
    revision                         = null
    service_account                  = "metabase-runtime@iampatterson.iam.gserviceaccount.com"
    session_affinity                 = false
    timeout                          = "300s"
    containers {
      args           = []
      base_image_uri = null
      command        = []
      depends_on     = []
      image          = "metabase/metabase:v0.59.6"
      name           = null
      working_dir    = null
      env {
        name  = "JAVA_TOOL_OPTIONS"
        value = "-Xmx1800m"
      }
      env {
        name  = "MB_DB_DBNAME"
        value = "metabase"
      }
      env {
        name  = "MB_DB_HOST"
        value = "10.13.0.3"
      }
      env {
        name  = "MB_DB_PASS"
        value = null
        value_source {
          secret_key_ref {
            secret  = "metabase-db-password"
            version = "latest"
          }
        }
      }
      env {
        name  = "MB_DB_PORT"
        value = "5432"
      }
      env {
        name  = "MB_DB_TYPE"
        value = "postgres"
      }
      env {
        name  = "MB_DB_USER"
        value = "metabase"
      }
      env {
        name  = "MB_ENCRYPTION_SECRET_KEY"
        value = null
        value_source {
          secret_key_ref {
            secret  = "metabase-encryption-key"
            version = "latest"
          }
        }
      }
      env {
        name  = "MB_JETTY_PORT"
        value = "8080"
      }
      env {
        name  = "MB_SITE_URL"
        value = "https://bi.iampatterson.com"
      }
      ports {
        container_port = 8080
        name           = "http1"
      }
      resources {
        cpu_idle = false
        limits = {
          cpu    = "1"
          memory = "2Gi"
        }
        startup_cpu_boost = false
      }
      startup_probe {
        failure_threshold     = 12
        initial_delay_seconds = 30
        period_seconds        = 10
        timeout_seconds       = 5
        http_get {
          path = "/api/health"
          port = 8080
        }
      }
    }
    scaling {
      max_instance_count = 3
      min_instance_count = 1
    }
    vpc_access {
      connector = null
      egress    = "PRIVATE_RANGES_ONLY"
      network_interfaces {
        network    = "default"
        subnetwork = "default"
        tags       = []
      }
    }
  }
  traffic {
    percent  = 100
    revision = null
    tag      = null
    type     = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }
}
