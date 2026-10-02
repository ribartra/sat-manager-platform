locals {
  apis = [
    "compute.googleapis.com",
    "storage.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
  ]

  registry = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.repository_id}"
}

resource "google_project_service" "enabled" {
  for_each           = toset(local.apis)
  service            = each.value
  disable_on_destroy = false
}

# --- container registry ------------------------------------------------------
resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = "${var.name_prefix}-images"
  format        = "DOCKER"
  description   = "SAT platform web + ingest images"
  depends_on    = [google_project_service.enabled]
}

# --- data + config bucket (uploads/staging seed, config, backups) ------------
resource "google_storage_bucket" "data" {
  name                        = "${var.project_id}-${var.name_prefix}-data"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age        = 30
      with_state = "ARCHIVED"
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.enabled]
}

# stack config consumed by the VM startup script
resource "google_storage_bucket_object" "compose" {
  name   = "stack/docker-compose.prod.yml"
  bucket = google_storage_bucket.data.name
  source = "${path.module}/../deploy/docker-compose.prod.yml"
}

resource "google_storage_bucket_object" "caddyfile" {
  name   = "stack/Caddyfile"
  bucket = google_storage_bucket.data.name
  source = "${path.module}/../deploy/Caddyfile"
}

resource "google_storage_bucket_object" "deploy_script" {
  name   = "stack/deploy.sh"
  bucket = google_storage_bucket.data.name
  source = "${path.module}/../deploy/deploy.sh"
}

resource "google_storage_bucket_object" "backup_script" {
  name   = "stack/sat-db-backup.sh"
  bucket = google_storage_bucket.data.name
  source = "${path.module}/../deploy/sat-db-backup.sh"
}

# --- off-site backups (RNF-14/15) --------------------------------------------
# Separate bucket in another region. The VM may create and read objects but never delete or
# overwrite them (no objectAdmin), so a compromised VM or a bad script cannot erase history.
# Daily DB copies expire after 190 days (>= 6 months retention); media copies are kept.
resource "google_storage_bucket" "offsite" {
  name                        = "${var.project_id}-backups-offsite"
  location                    = var.offsite_region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  lifecycle_rule {
    condition {
      age            = 190
      matches_prefix = ["db/"]
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.enabled]
}

resource "google_storage_bucket_iam_member" "offsite_create" {
  bucket = google_storage_bucket.offsite.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.vm.email}"
}

resource "google_storage_bucket_iam_member" "offsite_read" {
  bucket = google_storage_bucket.offsite.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.vm.email}"
}

# --- secrets -----------------------------------------------------------------
# Containers only. Values are added out-of-band (deploy/load-secrets.sh) so they
# never touch Terraform state. No google_secret_manager_secret_version here.
resource "google_secret_manager_secret" "s" {
  for_each  = toset(var.secret_names)
  secret_id = "${var.name_prefix}-${each.value}"

  replication {
    auto {}
  }

  depends_on = [google_project_service.enabled]
}

# --- VM service account + least-privilege IAM --------------------------------
resource "google_service_account" "vm" {
  account_id   = "${var.name_prefix}-vm"
  display_name = "SAT platform VM"
}

resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.vm.email}"
}

resource "google_storage_bucket_iam_member" "bucket_rw" {
  bucket = google_storage_bucket.data.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.vm.email}"
}

resource "google_artifact_registry_repository_iam_member" "registry_reader" {
  location   = google_artifact_registry_repository.repo.location
  repository = google_artifact_registry_repository.repo.repository_id
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.vm.email}"
}

resource "google_project_iam_member" "log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.vm.email}"
}

resource "google_project_iam_member" "metric_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.vm.email}"
}

# --- networking --------------------------------------------------------------
resource "google_compute_address" "ip" {
  name       = "${var.name_prefix}-ip"
  region     = var.vm_region
  depends_on = [google_project_service.enabled]
}

resource "google_compute_firewall" "http" {
  name    = "${var.name_prefix}-allow-http"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["${var.name_prefix}-web"]
}

# SSH only from Google Identity-Aware Proxy range (use `gcloud compute ssh --tunnel-through-iap`).
resource "google_compute_firewall" "ssh_iap" {
  name    = "${var.name_prefix}-allow-ssh-iap"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["35.235.240.0/20"]
  target_tags   = ["${var.name_prefix}-web"]
}

# --- persistent data disk ----------------------------------------------------
resource "google_compute_disk" "data" {
  name = "${var.name_prefix}-data"
  type = "pd-balanced"
  zone = var.vm_zone
  size = var.data_disk_gb
}

# --- VM ----------------------------------------------------------------------
resource "google_compute_instance" "vm" {
  name         = "${var.name_prefix}-vm"
  machine_type = var.machine_type
  zone         = var.vm_zone
  tags         = ["${var.name_prefix}-web"]

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = 20
    }
  }

  attached_disk {
    source      = google_compute_disk.data.id
    device_name = "sat-data" # -> /dev/disk/by-id/google-sat-data
  }

  network_interface {
    network = "default"
    access_config {
      nat_ip = google_compute_address.ip.address
    }
  }

  service_account {
    email  = google_service_account.vm.email
    scopes = ["cloud-platform"]
  }

  metadata = {
    startup-script = templatefile("${path.module}/../deploy/vm-startup.sh", {
      REGION         = var.region
      CONFIG_BUCKET  = google_storage_bucket.data.name
      OFFSITE_BUCKET = google_storage_bucket.offsite.name
      PROJECT_ID     = var.project_id
      REGISTRY       = local.registry
      TAG            = var.image_tag
      DOMAIN         = var.domain
      PREFIX         = var.name_prefix
      EMAIL_FROM     = var.email_from
      EMAIL_HOST     = var.email_host
      EMAIL_PORT     = tostring(var.email_port)
      EMAIL_USER     = var.email_user
    })
  }

  allow_stopping_for_update = true

  depends_on = [
    google_storage_bucket_object.compose,
    google_storage_bucket_object.caddyfile,
    google_secret_manager_secret.s,
    google_project_iam_member.secret_accessor,
    google_storage_bucket_iam_member.bucket_rw,
    google_artifact_registry_repository_iam_member.registry_reader,
  ]
}
