# =============================================================================
# VEDA Malware Scanning Pipeline — Terraform Configuration
# =============================================================================
#
# Architecture:
#   [UNSCANNED Bucket] → Eventarc → [Cloud Run: ClamAV] → [CLEAN Bucket]
#                                                        → [QUARANTINE Bucket]
#
# The unscanned bucket is the existing upload bucket (nysboe-veda-interim-uploads).
# Existing Eventarc triggers on the clean bucket remain unchanged.
# =============================================================================

terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ---------------------------------------------------------------------------
# Enable required APIs
# ---------------------------------------------------------------------------

resource "google_project_service" "required_apis" {
  for_each = toset([
    "run.googleapis.com",
    "eventarc.googleapis.com",
    "storage.googleapis.com",
    "logging.googleapis.com",
    "artifactregistry.googleapis.com",
  ])

  project = var.project_id
  service = each.value

  disable_on_destroy = false
}

# ---------------------------------------------------------------------------
# Service Account for the malware scanner
# ---------------------------------------------------------------------------

resource "google_service_account" "malware_scanner" {
  count = var.scanner_service_account_email == "" ? 1 : 0

  account_id   = "veda-malware-scanner"
  display_name = "VEDA Malware Scanner Service Account"
  project      = var.project_id
}

locals {
  scanner_sa_email = (
    var.scanner_service_account_email != ""
    ? var.scanner_service_account_email
    : google_service_account.malware_scanner[0].email
  )
}

# Storage Object Admin on all three buckets
resource "google_storage_bucket_iam_member" "scanner_unscanned" {
  bucket = var.unscanned_bucket_name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${local.scanner_sa_email}"
}

resource "google_storage_bucket_iam_member" "scanner_clean" {
  bucket = var.clean_bucket_name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${local.scanner_sa_email}"
}

resource "google_storage_bucket_iam_member" "scanner_quarantine" {
  bucket = var.quarantine_bucket_name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${local.scanner_sa_email}"
}

# Cloud Logging writer
resource "google_project_iam_member" "scanner_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${local.scanner_sa_email}"
}

# Eventarc event receiver
resource "google_project_iam_member" "scanner_eventarc_receiver" {
  project = var.project_id
  role    = "roles/eventarc.eventReceiver"
  member  = "serviceAccount:${local.scanner_sa_email}"
}

# ---------------------------------------------------------------------------
# Cloud Build service account — needs Eventarc Admin to create/update triggers
# during the CI/CD pipeline (cloudbuild.yaml step: setup-scanner-trigger)
# ---------------------------------------------------------------------------

locals {
  cloud_build_sa_email = "${var.project_number}-compute@developer.gserviceaccount.com"
}

resource "google_project_iam_member" "cloudbuild_eventarc_admin" {
  project = var.project_id
  role    = "roles/eventarc.admin"
  member  = "serviceAccount:${local.cloud_build_sa_email}"
}

# ---------------------------------------------------------------------------
# GCS Buckets — already created manually:
#   - nysboe-veda-interim-uploads  (unscanned / upload target)
#   - nysboe_veda_clean            (post-scan clean files)
#   - nysboe_veda_quarantine       (infected / rejected files)
#
# Recommended: enable 90-day lifecycle on quarantine bucket and versioning
# on both new buckets via the Console if not already set.
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Cloud Run — Malware Scanner Service
# ---------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "malware_scanner" {
  name     = "veda-malware-scanner"
  location = var.region
  project  = var.project_id

  depends_on = [google_project_service.required_apis]

  template {
    service_account = local.scanner_sa_email

    scaling {
      min_instance_count = 0
      max_instance_count = var.scanner_max_instances
    }

    containers {
      image = var.scanner_image

      resources {
        limits = {
          cpu    = var.scanner_cpu
          memory = var.scanner_memory
        }
        cpu_idle = true
      }

      env {
        name  = "UNSCANNED_BUCKET"
        value = var.unscanned_bucket_name
      }

      env {
        name  = "CLEAN_BUCKET"
        value = var.clean_bucket_name
      }

      env {
        name  = "QUARANTINE_BUCKET"
        value = var.quarantine_bucket_name
      }

      env {
        name  = "GCLOUD_PROJECT"
        value = var.project_id
      }

      startup_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 10
        period_seconds        = 5
        failure_threshold     = 12
        timeout_seconds       = 5
      }

      liveness_probe {
        http_get {
          path = "/health"
        }
        period_seconds  = 30
        timeout_seconds = 5
      }
    }

    timeout = "${var.scanner_timeout_seconds}s"
  }
}

# ---------------------------------------------------------------------------
# Eventarc Trigger — GCS object.finalized on the unscanned bucket
# ---------------------------------------------------------------------------

# Grant the GCS service agent permission to publish Pub/Sub messages
# (required for Eventarc GCS triggers)
data "google_storage_project_service_account" "gcs_sa" {
  project = var.project_id
}

resource "google_project_iam_member" "gcs_pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${data.google_storage_project_service_account.gcs_sa.email_address}"
}

resource "google_eventarc_trigger" "malware_scan_trigger" {
  name     = "veda-malware-scan-trigger"
  location = var.region
  project  = var.project_id

  depends_on = [
    google_project_service.required_apis,
    google_project_iam_member.gcs_pubsub_publisher,
  ]

  matching_criteria {
    attribute = "type"
    value     = "google.cloud.storage.object.v1.finalized"
  }

  matching_criteria {
    attribute = "bucket"
    value     = var.unscanned_bucket_name
  }

  destination {
    cloud_run_service {
      service = google_cloud_run_v2_service.malware_scanner.name
      region  = var.region
    }
  }

  service_account = local.scanner_sa_email
}

# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------

output "malware_scanner_url" {
  description = "URL of the malware scanner Cloud Run service"
  value       = google_cloud_run_v2_service.malware_scanner.uri
}

output "clean_bucket" {
  description = "Name of the clean (post-scan) bucket"
  value       = var.clean_bucket_name
}

output "quarantine_bucket" {
  description = "Name of the quarantine bucket"
  value       = var.quarantine_bucket_name
}

output "eventarc_trigger" {
  description = "Name of the Eventarc trigger"
  value       = google_eventarc_trigger.malware_scan_trigger.name
}
