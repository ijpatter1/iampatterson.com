locals {
  # User-created service accounts. The Google-managed default compute SA
  # (<project_number>-compute@) is intentionally excluded — it is provider-managed
  # and referenced for IAM bindings rather than declared as a resource.
  # `description` mirrors the live value so import converges to a no-op plan.
  service_accounts = {
    # Adopted by 13.4. claudish-proxy predates this phase; the four *-runtime
    # accounts were created by 13.4 to move sgtm, sgtm-preview, event-stream and
    # data-generator off the default compute service account, which held
    # roles/editor. The for_each import block in imports.tf picks all of these up.
    claudish_proxy = {
      account_id   = "claudish-proxy"
      display_name = "Claudish translator proxy (Cloud Run)"
      description  = "Runtime SA for claudish-proxy: Vertex AI lanes + Anthropic WIF lane"
    }
    sgtm_runtime = {
      account_id   = "sgtm-runtime"
      display_name = "sgtm-runtime"
      description  = "sGTM server container runtime (13.4)"
    }
    sgtm_preview_runtime = {
      account_id   = "sgtm-preview-runtime"
      display_name = "sgtm-preview-runtime"
      description  = "sGTM preview container runtime (13.4)"
    }
    event_stream_runtime = {
      account_id   = "event-stream-runtime"
      display_name = "event-stream-runtime"
      description  = "event-stream runtime, no project roles by design (13.4)"
    }
    data_gen_runtime = {
      account_id   = "data-gen-runtime"
      display_name = "data-gen-runtime"
      description  = "data-generator runtime, BigQuery writer (13.4)"
    }
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
