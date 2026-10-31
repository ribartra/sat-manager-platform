output "workload_identity_provider" {
  value       = google_iam_workload_identity_pool_provider.github.name
  description = "GitHub variable GCP_WIF_PROVIDER."
}

output "service_account" {
  value       = google_service_account.ci.email
  description = "GitHub variable GCP_WIF_SERVICE_ACCOUNT."
}
