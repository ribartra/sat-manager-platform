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

# Compute region/zone may differ from the storage region (`region`) to work
# around zonal capacity shortages. Bucket, Artifact Registry and secrets stay in
# `region`; the IP, data disk and VM live in `vm_region`/`vm_zone`. The VM pulls
# images and reads the seed cross-region (same project, minor egress).
variable "vm_region" {
  type        = string
  default     = "us-central1"
  description = "Region for the VM's external static IP. Defaults to `region`; override to relocate compute."
}

variable "vm_zone" {
  type        = string
  default     = "us-central1-a"
  description = "Zone for the VM and data disk. Override together with vm_region to relocate compute."
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
  default     = "e2-medium"
  description = "VM size. e2-medium (4 GB) is the recommended default: OCR ingest runs pdfplumber/Pillow on 256 MB inputs and 2 GB risks OOM. Drop to e2-small only for a demo with light, off-hours ingest."
}

variable "data_disk_gb" {
  type        = number
  default     = 50
  description = "Persistent data disk size (holds dev.db+WAL, uploads, staging, Docker data-root, local backups). 50 GB is the recommended default; 20 GB only if Docker images and ZIP/staging stay small."
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

# --- secrets ------------------------------------------------------------------
# Secret *values* are deliberately NOT Terraform variables: anything passed to
# Terraform is written to the state file in plaintext (marking a variable
# `sensitive` only hides it from CLI output, not from state). Terraform creates
# empty Secret Manager containers here; load the values out-of-band after apply
# with `deploy/load-secrets.sh` (uses `gcloud secrets versions add`). See
# DEPLOY_GCP.md → "Manejo de secretos".
variable "secret_names" {
  type        = list(string)
  default     = ["auth-secret", "secret-encryption-key", "internal-ingest-token", "mistral-api-key", "email-pass"]
  description = "Secret Manager container names (suffixes) created empty by Terraform; values are loaded post-apply."
}
