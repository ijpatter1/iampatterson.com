# [14.5] — every binding below already exists in live IAM; these adopt them.
# The id format for google_project_iam_member is "PROJECT ROLE MEMBER".
import {
  to = google_project_iam_member.runtime["claudish_proxy_aiplatform"]
  id = "iampatterson roles/aiplatform.user serviceAccount:claudish-proxy@iampatterson.iam.gserviceaccount.com"
}

import {
  to = google_project_iam_member.runtime["data_gen_runtime_bigquery_job"]
  id = "iampatterson roles/bigquery.jobUser serviceAccount:data-gen-runtime@iampatterson.iam.gserviceaccount.com"
}

import {
  to = google_project_iam_member.runtime["metabase_runtime_cloudsql"]
  id = "iampatterson roles/cloudsql.client serviceAccount:metabase-runtime@iampatterson.iam.gserviceaccount.com"
}

import {
  to = google_project_iam_member.runtime["metabase_bigquery_job"]
  id = "iampatterson roles/bigquery.jobUser serviceAccount:metabase-bigquery@iampatterson.iam.gserviceaccount.com"
}
