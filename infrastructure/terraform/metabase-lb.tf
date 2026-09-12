# Metabase external HTTPS load balancer + IAP, serving https://bi.iampatterson.com.
#
# Traffic shape (the surface behind the Phase 9F /app/* incident):
#   host "*" -> path matcher "direct-paths"
#     default            -> metabase-backend         (IAP-gated: UI requires Google SSO)
#     /api/embed/*,/app/*,/embed/* -> metabase-backend-direct (non-IAP: signed-JWT embeds only)
# A path missing from that carve-out becomes IAP-gated and breaks. The url_map
# below is the single source of truth for that split.
#
# Until 2026-09-11 the carve-out was /api/*, which left every Metabase API endpoint
# reachable without IAP. CVE-2026-72898, an unauthenticated SQL injection in
# /api/session/reset_password, was exploited through it on 2026-09-03, 09-04 and
# 09-10. Only the embed API may bypass IAP now; admin API calls go through IAP.
# The embed surface is only as safe as the embedding secret, which that admin
# access exposed. Rotated 2026-09-11: Cloud Run supplies it from Secret Manager
# (see cloud-run.tf), and the exposed value is disabled.

# Serverless NEG fronting the Cloud Run `metabase` service.
resource "google_compute_region_network_endpoint_group" "metabase_neg" {
  project               = var.project_id
  name                  = "metabase-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = "metabase"
  }
}

# Reserved global anycast IP (DNS A record for bi.iampatterson.com points here).
resource "google_compute_global_address" "metabase_lb_ip" {
  project      = var.project_id
  name         = "metabase-lb-ip"
  address_type = "EXTERNAL"
  ip_version   = "IPV4"
}

# IAP-gated backend — the default route; Google SSO challenge on every request.
resource "google_compute_backend_service" "metabase_backend" {
  project               = var.project_id
  name                  = "metabase-backend"
  protocol              = "HTTP"
  port_name             = "http"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  timeout_sec           = 30
  # Matches live (LB was created with draining disabled); omitting defaults to 300.
  connection_draining_timeout_sec = 0

  backend {
    group           = google_compute_region_network_endpoint_group.metabase_neg.id
    balancing_mode  = "UTILIZATION"
    capacity_scaler = 1
  }

  iap {
    enabled              = true
    oauth2_client_id     = "262727068689-sicd0f0ngah9o22u1fdgv1l02mk0p7hv.apps.googleusercontent.com"
    oauth2_client_secret = data.google_secret_manager_secret_version.metabase_iap_client_secret.secret_data
  }
}

# Non-IAP backend — reached only via the /api/embed·/app·/embed carve-out. Protected
# only by Metabase's signed-JWT embed validation, i.e. by the embedding secret.
resource "google_compute_backend_service" "metabase_backend_direct" {
  project               = var.project_id
  name                  = "metabase-backend-direct"
  protocol              = "HTTP"
  port_name             = "http"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  timeout_sec           = 30
  # Matches live (LB was created with draining disabled); omitting defaults to 300.
  connection_draining_timeout_sec = 0

  backend {
    group           = google_compute_region_network_endpoint_group.metabase_neg.id
    balancing_mode  = "UTILIZATION"
    capacity_scaler = 1
  }
}

# OAuth client secret for IAP, read from Secret Manager (never inlined in state as
# a literal). Requires roles/secretmanager.secretAccessor on the running identity.
data "google_secret_manager_secret_version" "metabase_iap_client_secret" {
  project = var.project_id
  secret  = "metabase-iap-client-secret"
}

resource "google_compute_url_map" "metabase" {
  project = var.project_id
  name    = "metabase-url-map"

  # Fallback when no host rule matches. Fails closed on the IAP-gated backend, so
  # adding or narrowing a host rule cannot expose Metabase. Until 2026-09-11 this
  # was the non-IAP backend, safe only while the host rule below matched every
  # host ("*") — a fail-open default on the surface CVE-2026-72898 was exploited through.
  default_service = google_compute_backend_service.metabase_backend.id

  host_rule {
    hosts        = ["*"]
    path_matcher = "direct-paths"
  }

  path_matcher {
    name = "direct-paths"
    # Anything NOT carved out below is IAP-gated.
    default_service = google_compute_backend_service.metabase_backend.id

    path_rule {
      # Signed-JWT embeds only: the embed page, its static assets and the embed API.
      paths   = ["/api/embed/*", "/app/*", "/embed/*"]
      service = google_compute_backend_service.metabase_backend_direct.id
    }
  }
}

resource "google_compute_managed_ssl_certificate" "metabase" {
  project = var.project_id
  name    = "metabase-cert"

  managed {
    domains = ["bi.iampatterson.com"]
  }
}

resource "google_compute_target_https_proxy" "metabase" {
  project          = var.project_id
  name             = "metabase-https-proxy"
  url_map          = google_compute_url_map.metabase.id
  ssl_certificates = [google_compute_managed_ssl_certificate.metabase.id]
}

resource "google_compute_global_forwarding_rule" "metabase" {
  project               = var.project_id
  name                  = "metabase-forwarding-rule"
  target                = google_compute_target_https_proxy.metabase.id
  ip_address            = google_compute_global_address.metabase_lb_ip.address
  port_range            = "443-443"
  ip_protocol           = "TCP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

# ─── IAP service agent ───────────────────────────────────────────────────────

# Without this binding IAP authenticates a browser request and then cannot
# forward it: every request through the load balancer returns 403 while the
# Cloud Run service itself is healthy, and nothing in the LB or the service logs
# names the cause. `setup-iap.sh` created it with
# `gcloud beta services identity create` followed by an add-iam-policy-binding;
# that script is retired by [14.2], so the binding is declared here.
#
# `_iam_member` is deliberate, not `_iam_binding` or `_iam_policy`. The member
# resources are additive: they leave members this configuration does not name
# alone. An authoritative resource here would revoke everything else holding
# run.invoker on this service the first time it applied — see the note below
# about `allUsers`.
resource "google_cloud_run_v2_service_iam_member" "metabase_iap_agent" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.metabase.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:service-${var.project_number}@gcp-sa-iap.iam.gserviceaccount.com"
}

# Recorded, not managed: `allUsers` also holds roles/run.invoker on this
# service. It is not an active exposure — the service is
# INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER, so the public internet cannot reach
# it directly and IAP remains the only route in. But the two controls are
# independent, and loosening ingress would make Metabase publicly invokable
# with no IAP check. Removing the binding is a production IAM change with its
# own blast radius, so it is named here for a person to decide rather than
# revoked in passing.
