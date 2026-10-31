variable "name_prefix" {
  type = string
}

variable "secret_names" {
  type        = list(string)
  description = "Secret suffixes; the secret id is <name_prefix>-<suffix>."
}

variable "accessor_members" {
  type        = list(string)
  default     = []
  description = "IAM members that may read every secret (e.g. the VM service account)."
}
