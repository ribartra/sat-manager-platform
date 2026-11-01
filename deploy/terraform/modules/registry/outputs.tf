output "repository_id" {
  value = google_artifact_registry_repository.repo.repository_id
}

output "registry" {
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.repository_id}"
  description = "Image base path: <registry>/web:<tag>, <registry>/ingest:<tag>."
}

output "cloudbuild_service_account" {
  value = google_service_account.cloudbuild.email
}

output "cloudbuild_service_account_id" {
  value = google_service_account.cloudbuild.name
}
