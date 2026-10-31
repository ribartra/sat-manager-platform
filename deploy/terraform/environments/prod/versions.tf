terraform {
  required_version = ">= 1.9"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  # Created by ../../bootstrap (make bootstrap). Versioned: earlier states can be restored.
  backend "gcs" {
    bucket = "sat-sol-gsc-tfstate"
    prefix = "prod"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.vm_zone
}
