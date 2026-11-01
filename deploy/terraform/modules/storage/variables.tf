variable "region" {
  type        = string
  description = "Location of the data bucket."
}

variable "offsite_region" {
  type        = string
  description = "Location of the off-site backup bucket (must differ from region and the VM region)."
}

variable "data_bucket_name" {
  type = string
}

variable "offsite_bucket_name" {
  type = string
}

variable "stack_files" {
  type        = map(string)
  description = "Object name under stack/ => local source path."
}
