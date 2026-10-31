variable "project_id" {
  type = string
}

variable "region" {
  type        = string
  description = "Artifact Registry location."
}

variable "repository_id" {
  type = string
}

variable "reader_members" {
  type        = list(string)
  default     = []
  description = "IAM members allowed to pull images (e.g. the VM service account)."
}

variable "cloudbuild_account_id" {
  type    = string
  default = "cloudbuild-web"
}

variable "cloudbuild_display_name" {
  type    = string
  default = "Cloud Build: web image"
}

variable "cleanup_dry_run" {
  type        = bool
  default     = true
  description = "true = cleanup policies only log what they would delete."
}

variable "keep_recent_versions" {
  type    = number
  default = 20
  validation {
    condition     = var.keep_recent_versions >= 5
    error_message = "Keep at least 5 versions: rollbacks need the previous images."
  }
}

variable "delete_older_than_days" {
  type    = number
  default = 60
}
