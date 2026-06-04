locals {
  # User-created service accounts. The Google-managed default compute SA
  # (<project_number>-compute@) is intentionally excluded — it is provider-managed
  # and referenced for IAM bindings rather than declared as a resource.
  # `description` mirrors the live value so import converges to a no-op plan.
  service_accounts = {
    metabase_runtime = {
      account_id   = "metabase-runtime"
      display_name = "Metabase Cloud Run runtime"
      description  = null
    }
    metabase_bigquery = {
      account_id   = "metabase-bigquery"
      display_name = "Metabase BigQuery reader"
      description  = null
    }
    data_gen_scheduler = {
      account_id   = "data-gen-scheduler"
      display_name = "Cloud Scheduler → Data Generator"
      description  = null
    }
    stape_sgtm = {
      account_id   = "stape-sgtm"
      display_name = "stape-sgtm"
      description  = "Service account for Stape Google Service Account power-up"
    }
    claude_code_sandbox = {
      account_id   = "claude-code-sandbox"
      display_name = "Claude Code Sandbox"
      description  = null
    }
  }
}

resource "google_service_account" "managed" {
  for_each = local.service_accounts

  project      = var.project_id
  account_id   = each.value.account_id
  display_name = each.value.display_name
  description  = each.value.description
}
