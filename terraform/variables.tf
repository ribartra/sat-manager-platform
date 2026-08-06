variable "project_id" {
  type        = string
  description = "GCP project id."
}

variable "region" {
  type        = string
  default     = "us-central1"
  description = "Region for the bucket, Artifact Registry, static IP and disk."
}

variable "zone" {
  type        = string
  default     = "us-central1-a"
  description = "Zone for the VM and data disk."
}

variable "name_prefix" {
  type        = string
  default     = "sat"
  description = "Prefix for resource names (VM, disk, secrets, SA, tags)."
}

variable "domain" {
  type        = string
  description = "Domain served over HTTPS (Caddy issues a Let's Encrypt cert). Point its A record to the output static IP."
}

variable "machine_type" {
  type        = string
  default     = "e2-small"
  description = "VM size. e2-small (2 GB) is the safe minimum for build+ingest; e2-micro risks OOM."
}

variable "data_disk_gb" {
  type        = number
  default     = 20
  description = "Persistent data disk size (holds dev.db, uploads, staging)."
}

variable "image_tag" {
  type        = string
  default     = "latest"
  description = "Image tag deployed by the VM (must exist in Artifact Registry)."
}

# --- non-sensitive email config (SMTP relay, e.g. Brevo) ---------------------
variable "email_from" {
  type    = string
  default = "noreply@yourdomain.com"
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

# --- secrets (stored in Secret Manager; never printed) -----------------------
variable "auth_secret" {
  type      = string
  sensitive = true
}
variable "secret_encryption_key" {
  type      = string
  sensitive = true
}
variable "internal_ingest_token" {
  type      = string
  sensitive = true
}
variable "mistral_api_key" {
  type      = string
  sensitive = true
  default   = ""
}
variable "email_pass" {
  type      = string
  sensitive = true
  default   = ""
}
