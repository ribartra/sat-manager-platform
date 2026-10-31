output "secret_ids" {
  value = [for secret in google_secret_manager_secret.secret : secret.secret_id]
}
