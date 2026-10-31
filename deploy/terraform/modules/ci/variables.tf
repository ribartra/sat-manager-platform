variable "project_id" {
  type = string
}

variable "github_repository" {
  type        = string
  description = "owner/name allowed to authenticate."
  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "Use owner/name."
  }
}

variable "pool_id" {
  type    = string
  default = "github"
}

variable "ci_account_id" {
  type    = string
  default = "sat-github-ci"
}

variable "cloudbuild_service_account_id" {
  type        = string
  description = "Full id (projects/.../serviceAccounts/...) of the account Cloud Build runs as."
}

variable "cloudbuild_source_bucket" {
  type        = string
  description = "Bucket gcloud builds submit uploads the source to (<project>_cloudbuild)."
}

variable "registry_location" {
  type = string
}

variable "registry_repository_id" {
  type = string
}
