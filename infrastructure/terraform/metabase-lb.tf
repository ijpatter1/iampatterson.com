# Metabase external HTTPS load balancer + IAP, serving https://bi.iampatterson.com.
#
# Traffic shape (the surface behind the Phase 9F /app/* incident):
#   host "*" -> path matcher "direct-paths"
#     default            -> metabase-backend         (IAP-gated: UI requires Google SSO)
#     /api/*,/app/*,/embed/* -> metabase-backend-direct (non-IAP: API key + signed-JWT embeds)
# A path missing from that carve-out becomes IAP-gated and breaks. The url_map
# below is the single source of truth for that split.

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

# Non-IAP backend — reached only via the /api·/app·/embed carve-out. Protected by
# Metabase's own auth (session/API key) and signed-JWT embed validation.
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

  # Fallback when no host rule matches; host "*" below routes everything through
  # the direct-paths matcher, so this is effectively a safety default.
  default_service = google_compute_backend_service.metabase_backend_direct.id

  host_rule {
    hosts        = ["*"]
    path_matcher = "direct-paths"
  }

  path_matcher {
    name = "direct-paths"
    # Anything NOT carved out below is IAP-gated.
    default_service = google_compute_backend_service.metabase_backend.id

    path_rule {
      paths   = ["/api/*", "/app/*", "/embed/*"]
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
