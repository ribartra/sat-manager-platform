# Secret Manager containers only. Values are added out-of-band (deploy/scripts/load-secrets.sh) so
# they never land in Terraform state; there is no google_secret_manager_secret_version here.

resource "google_secret_manager_secret" "secret" {
  for_each  = toset(var.secret_names)
  secret_id = "${var.name_prefix}-${each.value}"

  replication {
    auto {}
  }
}

# Read access per secret (not project-wide).
resource "google_secret_manager_secret_iam_member" "accessor" {
  for_each  = { for pair in setproduct(var.secret_names, var.accessor_members) : "${pair[0]}|${pair[1]}" => pair }
  secret_id = google_secret_manager_secret.secret[each.value[0]].id
  role      = "roles/secretmanager.secretAccessor"
  member    = each.value[1]
}
