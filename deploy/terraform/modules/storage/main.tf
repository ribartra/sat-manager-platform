# Data bucket (stack config, seed, media, 6-hourly DB backups) and the off-site backup bucket.

resource "google_storage_bucket" "data" {
  name                        = var.data_bucket_name
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false

  versioning {
    enabled = true
  }

  # Old object versions go after 30 days.
  lifecycle_rule {
    condition {
      age        = 30
      with_state = "ARCHIVED"
    }
    action {
      type = "Delete"
    }
  }

  # 6-hourly cron DB copies (backups/dev-*) live 30 days on-site; the off-site bucket keeps a daily
  # copy for 190 days. Manual backups (pre-push-*, pre-*-*) are not matched and stay.
  lifecycle_rule {
    condition {
      age            = 30
      with_state     = "LIVE"
      matches_prefix = ["backups/dev-"]
    }
    action {
      type = "Delete"
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

# Off-site backups (RNF-14/15): another region; the VM may create and read objects but never
# delete or overwrite them, so a compromised VM or a bad script cannot erase history. Daily DB
# copies expire after 190 days; media copies are kept.
resource "google_storage_bucket" "offsite" {
  name                        = var.offsite_bucket_name
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

  lifecycle {
    prevent_destroy = true
  }
}

# Files the VM installs from gs://<data>/stack/ (deploy/vm/apply-stack.sh). Terraform is the only
# writer: edit deploy/vm/*, `make apply`, then `make sync-stack` installs them on the VM.
resource "google_storage_bucket_object" "stack" {
  for_each = var.stack_files
  name     = "stack/${each.key}"
  bucket   = google_storage_bucket.data.name
  source   = each.value
}
