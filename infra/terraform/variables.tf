variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for resources"
  type        = string
  default     = "us-east1"
}

variable "unscanned_bucket_name" {
  description = "Name of the unscanned (upload) bucket — this is the existing upload bucket"
  type        = string
  default     = "nysboe-veda-interim-uploads"
}

variable "clean_bucket_name" {
  description = "Name of the clean (post-scan) bucket"
  type        = string
  default     = "nysboe_veda_clean"
}

variable "quarantine_bucket_name" {
  description = "Name of the quarantine bucket for infected files"
  type        = string
  default     = "nysboe_veda_quarantine"
}

variable "scanner_image" {
  description = "Container image for the malware scanner Cloud Run service"
  type        = string
}

variable "scanner_service_account_email" {
  description = "Service account email for the malware scanner Cloud Run service"
  type        = string
  default     = ""
}

variable "scanner_memory" {
  description = "Memory allocation for the scanner service (ClamAV needs ~1.5GB)"
  type        = string
  default     = "2Gi"
}

variable "scanner_cpu" {
  description = "CPU allocation for the scanner service"
  type        = string
  default     = "1"
}

variable "scanner_timeout_seconds" {
  description = "Request timeout for the scanner service"
  type        = number
  default     = 300
}

variable "scanner_max_instances" {
  description = "Max instances for the scanner service"
  type        = number
  default     = 3
}
