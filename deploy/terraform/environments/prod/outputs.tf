output "static_ip" {
  value       = module.vm.static_ip
  description = "The domain's A record points here."
}

output "registry" {
  value = module.registry.registry
}

output "data_bucket" {
  value = module.storage.data_bucket
}

output "instance_name" {
  value = module.vm.instance_name
}

output "zone" {
  value = var.vm_zone
}

output "cloudbuild_service_account" {
  value = module.registry.cloudbuild_service_account
}

output "github_wif_provider" {
  value       = try(module.ci[0].workload_identity_provider, null)
  description = "GitHub repository variable GCP_WIF_PROVIDER."
}

output "github_ci_service_account" {
  value       = try(module.ci[0].service_account, null)
  description = "GitHub repository variable GCP_WIF_SERVICE_ACCOUNT."
}

output "ssh" {
  value = "gcloud compute ssh ${module.vm.instance_name} --zone ${var.vm_zone} --project ${var.project_id} --tunnel-through-iap"
}
