# Brownfield import blocks. Every resource below already exists in the live
# `iampatterson` project; these blocks adopt them into Terraform state without
# recreating anything. After `terraform apply` persists the imports, a follow-up
# `terraform plan` must report no changes. Once state is established and stable,
# these blocks can be deleted (they are a one-time adoption mechanism).

import {
  for_each = toset(local.enabled_services)
  to       = google_project_service.enabled[each.value]
  id       = "${var.project_id}/${each.value}"
}

import {
  for_each = local.service_accounts
  to       = google_service_account.managed[each.key]
  id       = "projects/${var.project_id}/serviceAccounts/${each.value.account_id}@${var.project_id}.iam.gserviceaccount.com"
}
