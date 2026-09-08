# The event pipeline's transport: one topic, one push subscription to
# event-stream.
#
# Imported into state on 2026-06-08 alongside the BigQuery datasets, and left
# without configuration for the same reason. This pair is the more dangerous half
# of that gap: neither resource carries a deletion guard, so an apply would have
# destroyed them outright and stopped events reaching event-stream and BigQuery.
#
# There is no dead-letter topic. That is the live shape, recorded rather than
# quietly fixed — adding one is a design decision, and 13.5's "event pipeline
# backlog" runbook entry is where its absence has to be explained, since without
# it a poisoned message has no recovery path beyond draining or ageing out.

resource "google_pubsub_topic" "events" {
  project = var.project_id
  name    = "iampatterson-events"
}

resource "google_pubsub_subscription" "events_push" {
  project = var.project_id
  name    = "iampatterson-events-push"
  topic   = google_pubsub_topic.events.id

  ack_deadline_seconds       = 30
  message_retention_duration = "604800s"
  retain_acked_messages      = false

  push_config {
    push_endpoint = "https://event-stream-eb4xrwmo3q-uc.a.run.app/pubsub/push"
  }

  expiration_policy {
    ttl = "2678400s"
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }
}
