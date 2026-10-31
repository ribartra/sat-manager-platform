# Artifact Registry for the web + ingest images, and the service account Cloud Build runs as.

resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = var.repository_id
  format        = "DOCKER"
  description   = "SAT platform web + ingest images"

  # Keep the newest images and drop old ones (the repo was ~25 GB on 2026-10-31). Starts as a dry
  # run: Artifact Registry only logs what it would delete. Set cleanup_dry_run = false to enforce.
  cleanup_policy_dry_run = var.cleanup_dry_run

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = var.keep_recent_versions
    }
  }

  cleanup_policies {
    id     = "delete-old"
    action = "DELETE"
    condition {
      older_than = "${var.delete_older_than_days * 24}h"
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_artifact_registry_repository_iam_member" "reader" {
  for_each   = toset(var.reader_members)
  location   = google_artifact_registry_repository.repo.location
  repository = google_artifact_registry_repository.repo.repository_id
  role       = "roles/artifactregistry.reader"
  member     = each.value
}

# Cloud Build runs as this account (deploy/cloudbuild.yaml): builds the images and pushes them.
resource "google_service_account" "cloudbuild" {
  account_id   = var.cloudbuild_account_id
  display_name = var.cloudbuild_display_name
}

resource "google_project_iam_member" "cloudbuild_builder" {
  project = var.project_id
  role    = "roles/cloudbuild.builds.builder"
  member  = "serviceAccount:${google_service_account.cloudbuild.email}"
}
