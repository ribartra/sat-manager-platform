# Production: one VM (docker compose: web + ingest + Caddy, SQLite on a persistent disk) on
# sat-sol-gsc, serving satsol.org. Modules hold the resources; this root wires them together and
# owns the cross-module IAM (factored-hackathon layout). Imported from the live project on
# 2026-10-31 (imports.tf): an apply must never destroy or replace the VM, the disk, the IP or a
# bucket (prevent_destroy guards them).

locals {
  vm_dir = "${path.module}/../../../vm"

  apis = [
    "compute.googleapis.com",
    "storage.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "cloudresourcemanager.googleapis.com",
  ]

  # Everything the VM installs from gs://<data>/stack/ (deploy/vm/apply-stack.sh).
  stack_files = {
    "apply-stack.sh"          = "${local.vm_dir}/apply-stack.sh"
    "docker-compose.prod.yml" = "${local.vm_dir}/docker-compose.prod.yml"
    "Caddyfile"               = "${local.vm_dir}/Caddyfile"
    "deploy.sh"               = "${local.vm_dir}/deploy.sh"
    "sat-db-backup.sh"        = "${local.vm_dir}/sat-db-backup.sh"
    "sat-notifications.sh"    = "${local.vm_dir}/sat-notifications.sh"
    "ops-agent.yaml"          = "${local.vm_dir}/ops-agent.yaml"
  }

  vm_member = "serviceAccount:${google_service_account.vm.email}"
}

resource "google_project_service" "api" {
  for_each           = toset(local.apis)
  service            = each.value
  disable_on_destroy = false
}

# --- identity of the VM ---------------------------------------------------------------------------
resource "google_service_account" "vm" {
  account_id   = "${var.name_prefix}-vm"
  display_name = "SAT platform VM"
}

resource "google_project_iam_member" "vm_logs" {
  for_each = toset(["roles/logging.logWriter", "roles/monitoring.metricWriter"])
  project  = var.project_id
  role     = each.value
  member   = local.vm_member
}

# --- modules --------------------------------------------------------------------------------------
module "registry" {
  source         = "../../modules/registry"
  project_id     = var.project_id
  region         = var.region
  repository_id  = "${var.name_prefix}-images"
  reader_members = [local.vm_member]

  cleanup_dry_run = var.registry_cleanup_dry_run
}

module "storage" {
  source              = "../../modules/storage"
  region              = var.region
  offsite_region      = var.offsite_region
  data_bucket_name    = "${var.project_id}-${var.name_prefix}-data"
  offsite_bucket_name = "${var.project_id}-backups-offsite"
  stack_files         = local.stack_files
}

module "secrets" {
  source           = "../../modules/secrets"
  name_prefix      = var.name_prefix
  secret_names     = var.secret_names
  accessor_members = [local.vm_member]
}

module "vm" {
  source                = "../../modules/vm"
  name_prefix           = var.name_prefix
  region                = var.vm_region
  zone                  = var.vm_zone
  machine_type          = var.machine_type
  data_disk_gb          = var.data_disk_gb
  service_account_email = google_service_account.vm.email

  startup_script = templatefile("${local.vm_dir}/vm-startup.sh", {
    REGION         = var.region
    CONFIG_BUCKET  = module.storage.data_bucket
    OFFSITE_BUCKET = module.storage.offsite_bucket
    PROJECT_ID     = var.project_id
    REGISTRY       = module.registry.registry
    INITIAL_TAG    = var.initial_image_tag
    DOMAIN         = var.domain
    PREFIX         = var.name_prefix
    DATA_DEVICE    = "sat-data"
    EMAIL_FROM     = var.email_from
    EMAIL_HOST     = var.email_host
    EMAIL_PORT     = tostring(var.email_port)
    EMAIL_USER     = var.email_user
  })

  depends_on = [
    google_storage_bucket_iam_member.vm_data,
    module.secrets,
    module.registry,
  ]
}

module "monitoring" {
  source      = "../../modules/monitoring"
  project_id  = var.project_id
  domain      = var.domain
  alert_email = var.alert_email
}

module "ci" {
  source                        = "../../modules/ci"
  count                         = var.github_repository == "" ? 0 : 1
  project_id                    = var.project_id
  github_repository             = var.github_repository
  cloudbuild_service_account_id = module.registry.cloudbuild_service_account_id
  cloudbuild_source_bucket      = "${var.project_id}_cloudbuild"
  registry_location             = var.region
  registry_repository_id        = module.registry.repository_id

  depends_on = [google_project_service.api]
}

# --- cross-module IAM -----------------------------------------------------------------------------
resource "google_storage_bucket_iam_member" "vm_data" {
  bucket = module.storage.data_bucket
  role   = "roles/storage.objectAdmin"
  member = local.vm_member
}

# Off-site: the VM can add and read copies, never delete or overwrite them.
resource "google_storage_bucket_iam_member" "vm_offsite" {
  for_each = toset(["roles/storage.objectCreator", "roles/storage.objectViewer"])
  bucket   = module.storage.offsite_bucket
  role     = each.value
  member   = local.vm_member
}
