# Metabase load-balancer topology — brownfield import blocks.
# Resource config is generated via `terraform plan -generate-config-out=...` then
# cleaned into metabase-lb.tf. IAM (IAP allowlist) is handled separately.

import {
  to = google_compute_global_address.metabase_lb_ip
  id = "projects/iampatterson/global/addresses/metabase-lb-ip"
}

import {
  to = google_compute_region_network_endpoint_group.metabase_neg
  id = "projects/iampatterson/regions/us-central1/networkEndpointGroups/metabase-neg"
}

import {
  to = google_compute_backend_service.metabase_backend
  id = "projects/iampatterson/global/backendServices/metabase-backend"
}

import {
  to = google_compute_backend_service.metabase_backend_direct
  id = "projects/iampatterson/global/backendServices/metabase-backend-direct"
}

import {
  to = google_compute_url_map.metabase
  id = "projects/iampatterson/global/urlMaps/metabase-url-map"
}

import {
  to = google_compute_managed_ssl_certificate.metabase
  id = "projects/iampatterson/global/sslCertificates/metabase-cert"
}

import {
  to = google_compute_target_https_proxy.metabase
  id = "projects/iampatterson/global/targetHttpsProxies/metabase-https-proxy"
}

import {
  to = google_compute_global_forwarding_rule.metabase
  id = "projects/iampatterson/global/forwardingRules/metabase-forwarding-rule"
}
