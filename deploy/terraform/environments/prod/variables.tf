variable "project_id" {
  type = string
}

variable "region" {
  type        = string
  description = "Artifact Registry, data bucket and the Cloud Build source bucket."
}

# Compute lives in another region than storage (us-central1 had no e2-medium capacity on
# 2026-08-07). The VM pulls images and reads the bucket cross-region (same project).
variable "vm_region" {
  type = string
}

variable "vm_zone" {
  type = string
}

variable "offsite_region" {
  type        = string
  description = "Off-site backup bucket region: must differ from region and vm_region."
}

variable "name_prefix" {
  type    = string
  default = "sat"
}

variable "domain" {
  type        = string
  description = "Served by Caddy (Let's Encrypt); its A record points to the static IP output."
}

variable "machine_type" {
  type    = string
  default = "e2-medium"
}

variable "data_disk_gb" {
  type    = number
  default = 50
}

variable "initial_image_tag" {
  type        = string
  description = "Image tag a NEW VM starts with. An existing VM keeps the TAG deploy.sh wrote (/data/stack/.env); Terraform never changes the running version."
  validation {
    condition     = var.initial_image_tag != "latest"
    error_message = "Use an immutable tag (scripts/build-and-push.sh prints it), never latest."
  }
}

variable "secret_names" {
  type    = list(string)
  default = ["auth-secret", "secret-encryption-key", "internal-ingest-token", "mistral-api-key", "email-pass"]
}

variable "email_from" {
  type = string
}

variable "email_host" {
  type    = string
  default = "smtp-relay.brevo.com"
}

variable "email_port" {
  type    = number
  default = 587
}

variable "email_user" {
  type    = string
  default = ""
}

variable "alert_email" {
  type        = string
  description = "Receives uptime / backup / 5xx alerts."
}

variable "github_repository" {
  type        = string
  default     = ""
  description = "owner/name for GitHub Actions (WIF). Empty = no CI resources."
}

variable "registry_cleanup_dry_run" {
  type        = bool
  default     = true
  description = "Artifact Registry cleanup policies only log (true) or delete (false)."
}
