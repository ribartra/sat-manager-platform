output "static_ip" {
  value       = google_compute_address.ip.address
  description = "Point the domain's A record here."
}

output "registry" {
  value       = local.registry
  description = "Artifact Registry base path. Push web:<tag> and ingest:<tag> here."
}

output "config_bucket" {
  value       = google_storage_bucket.data.name
  description = "Bucket for stack config, seed data and DB backups."
}

output "instance_name" {
  value = google_compute_instance.vm.name
}

output "next_steps" {
  value = <<-EOT
    1) Load secret VALUES (they are NOT in Terraform state) — do this before the
       VM finishes booting, or re-run the startup script afterwards:
         PROJECT=${var.project_id} PREFIX=${var.name_prefix} deploy/load-secrets.sh
    2) Build & push images to: ${local.registry}
         REGION=${var.region} PROJECT=${var.project_id} REPO=${google_artifact_registry_repository.repo.repository_id} TAG=$(git rev-parse --short HEAD) deploy/build-and-push.sh
    3) (optional) Seed data into the bucket:
         gsutil cp dev.db gs://${google_storage_bucket.data.name}/seed/dev.db
         gsutil -m rsync -r public/uploads gs://${google_storage_bucket.data.name}/seed/uploads
         gsutil -m rsync -r .private       gs://${google_storage_bucket.data.name}/seed/private
    4) Point ${var.domain} A record to: ${google_compute_address.ip.address}
    5) SSH: gcloud compute ssh ${var.name_prefix}-vm --zone ${var.zone} --tunnel-through-iap
  EOT
}
