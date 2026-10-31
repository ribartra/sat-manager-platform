# GitHub Actions -> GCP without key files (Workload Identity Federation), restricted to one
# repository. The CI account can only start Cloud Build builds as the Cloud Build service account
# (which pushes the images); it cannot deploy to the VM or change infrastructure.

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = var.pool_id
  display_name              = "GitHub Actions"
  description               = "OIDC tokens from GitHub Actions (${var.github_repository})"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-actions"
  display_name                       = "GitHub Actions OIDC"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }
  # Only this repository can exchange tokens.
  attribute_condition = "assertion.repository == '${var.github_repository}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account" "ci" {
  account_id   = var.ci_account_id
  display_name = "GitHub Actions: build images"
}

resource "google_service_account_iam_member" "ci_wif" {
  service_account_id = google_service_account.ci.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}

# Submit builds and read their status/logs.
resource "google_project_iam_member" "ci_project" {
  for_each = toset(["roles/cloudbuild.builds.editor", "roles/serviceusage.serviceUsageConsumer", "roles/logging.viewer"])
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.ci.email}"
}

# Run the build as the Cloud Build service account.
resource "google_service_account_iam_member" "ci_act_as_cloudbuild" {
  service_account_id = var.cloudbuild_service_account_id
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.ci.email}"
}

# `gcloud builds submit` uploads the source to gs://<project>_cloudbuild.
resource "google_storage_bucket_iam_member" "ci_source_upload" {
  bucket = var.cloudbuild_source_bucket
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.ci.email}"
}

# Check which tags exist (no push: Cloud Build pushes).
resource "google_artifact_registry_repository_iam_member" "ci_reader" {
  location   = var.registry_location
  repository = var.registry_repository_id
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.ci.email}"
}
