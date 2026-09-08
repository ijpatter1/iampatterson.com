variable "project_id" {
  description = "GCP project ID hosting the measurement infrastructure."
  type        = string
  default     = "iampatterson"
}

variable "project_number" {
  description = "GCP project number, used for default-SA and IAM member strings."
  type        = string
  default     = "262727068689"
}

variable "region" {
  description = "Default region for regional resources (Cloud Run, Cloud SQL, Cloud Scheduler)."
  type        = string
  default     = "us-central1"
}
