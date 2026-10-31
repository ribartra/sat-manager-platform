variable "name_prefix" {
  type = string
}

variable "region" {
  type        = string
  description = "Region of the static IP (same as the VM zone's region)."
}

variable "zone" {
  type = string
}

variable "network" {
  type    = string
  default = "default"
}

variable "machine_type" {
  type        = string
  default     = "e2-medium"
  description = "e2-medium (4 GB): OCR ingest runs pdfplumber/Pillow on large inputs; 2 GB risks OOM."
}

variable "boot_image" {
  type        = string
  default     = "debian-cloud/debian-12"
  description = "Only used when the VM is created (ignored afterwards)."
}

variable "boot_disk_gb" {
  type    = number
  default = 20
}

variable "boot_disk_type" {
  type    = string
  default = "pd-standard"
}

variable "data_disk_gb" {
  type    = number
  default = 50
  validation {
    condition     = var.data_disk_gb >= 50
    error_message = "The data disk holds the DB, uploads, Docker images and backups: 50 GB minimum (it can grow, never shrink)."
  }
}

variable "data_device_name" {
  type        = string
  default     = "sat-data"
  description = "Device name of the data disk; vm-startup.sh mounts /dev/disk/by-id/google-<this>."
}

variable "service_account_email" {
  type = string
}

variable "startup_script" {
  type        = string
  description = "Rendered deploy/vm/vm-startup.sh."
}
