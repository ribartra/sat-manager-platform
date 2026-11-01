# The single VM that runs the stack (web + ingest + Caddy under docker compose), its static IP,
# firewall and persistent data disk. Stateful pieces are protected from destroy.

resource "google_compute_address" "ip" {
  name   = "${var.name_prefix}-ip"
  region = var.region

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_compute_firewall" "http" {
  name    = "${var.name_prefix}-allow-http"
  network = var.network

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = [local.web_tag]
}

# SSH only from Google's Identity-Aware Proxy range (`gcloud compute ssh --tunnel-through-iap`).
resource "google_compute_firewall" "ssh_iap" {
  name    = "${var.name_prefix}-allow-ssh-iap"
  network = var.network

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["35.235.240.0/20"]
  target_tags   = [local.web_tag]
}

# /data: SQLite DB + WAL, uploads, ingest staging, Docker data-root, local backups.
resource "google_compute_disk" "data" {
  name = "${var.name_prefix}-data"
  type = "pd-balanced"
  zone = var.zone
  size = var.data_disk_gb

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_compute_instance" "vm" {
  name         = "${var.name_prefix}-vm"
  machine_type = var.machine_type
  zone         = var.zone
  tags         = [local.web_tag]

  boot_disk {
    auto_delete = true
    initialize_params {
      image = var.boot_image
      size  = var.boot_disk_gb
      type  = var.boot_disk_type
    }
  }

  attached_disk {
    source      = google_compute_disk.data.id
    device_name = var.data_device_name # -> /dev/disk/by-id/google-<device_name> (vm-startup.sh)
  }

  network_interface {
    network = var.network
    access_config {
      nat_ip       = google_compute_address.ip.address
      network_tier = "PREMIUM"
    }
  }

  service_account {
    email  = var.service_account_email
    scopes = ["cloud-platform"]
  }

  shielded_instance_config {
    enable_secure_boot          = false
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }

  # Changing the startup script updates metadata in place (it runs on the next boot, or with
  # `sudo google_metadata_script_runner startup`); it never recreates the VM.
  metadata = {
    startup-script = var.startup_script
  }

  allow_stopping_for_update = true

  lifecycle {
    prevent_destroy = true
    # The boot disk was created from a dated Debian image; a newer image must never recreate the VM.
    ignore_changes = [boot_disk[0].initialize_params[0].image]
  }
}

locals {
  web_tag = "${var.name_prefix}-web"
}
