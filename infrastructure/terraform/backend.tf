terraform {
  # Remote state in a versioned, uniform-bucket-level-access GCS bucket created
  # out-of-band (terraform cannot create its own backend bucket). State locking
  # is automatic for the gcs backend.
  backend "gcs" {
    bucket = "iampatterson-tfstate"
    prefix = "terraform/state"
  }
}
