variable "project_id" {
  type = string
}

variable "domain" {
  type        = string
  description = "Host the uptime checks call over HTTPS."
}

variable "alert_email" {
  type = string
}

variable "runbook_path" {
  type        = string
  default     = "deploy/docs/runbook.md"
  description = "Linked from every alert."
}
