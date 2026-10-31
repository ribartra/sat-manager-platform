# Adopts the resources that already existed in sat-sol-gsc (created by an earlier Terraform run
# whose state was lost, plus monitoring created by hand). Import blocks are idempotent: once a
# resource is in state they are no-ops, so this file can stay. Resources NOT listed here are new
# (per-secret IAM, WIF/CI, the sts / cloudresourcemanager APIs) or re-uploaded: bucket objects
# cannot be imported, so stack/* is written again from deploy/vm/ (the bucket keeps old versions).
# Not managed on purpose: the project-wide secretAccessor of sat-vm (replaced by per-secret access;
# remove it by hand after verifying, see deploy/docs/import.md) and the default-allow-* firewalls.

import {
  to = google_project_service.api["compute.googleapis.com"]
  id = "sat-sol-gsc/compute.googleapis.com"
}

import {
  to = google_project_service.api["storage.googleapis.com"]
  id = "sat-sol-gsc/storage.googleapis.com"
}

import {
  to = google_project_service.api["secretmanager.googleapis.com"]
  id = "sat-sol-gsc/secretmanager.googleapis.com"
}

import {
  to = google_project_service.api["artifactregistry.googleapis.com"]
  id = "sat-sol-gsc/artifactregistry.googleapis.com"
}

import {
  to = google_project_service.api["cloudbuild.googleapis.com"]
  id = "sat-sol-gsc/cloudbuild.googleapis.com"
}

import {
  to = google_project_service.api["monitoring.googleapis.com"]
  id = "sat-sol-gsc/monitoring.googleapis.com"
}

import {
  to = google_project_service.api["logging.googleapis.com"]
  id = "sat-sol-gsc/logging.googleapis.com"
}

import {
  to = google_project_service.api["iam.googleapis.com"]
  id = "sat-sol-gsc/iam.googleapis.com"
}

import {
  to = google_project_service.api["iamcredentials.googleapis.com"]
  id = "sat-sol-gsc/iamcredentials.googleapis.com"
}

import {
  to = google_service_account.vm
  id = "projects/sat-sol-gsc/serviceAccounts/sat-vm@sat-sol-gsc.iam.gserviceaccount.com"
}

import {
  to = google_project_iam_member.vm_logs["roles/logging.logWriter"]
  id = "sat-sol-gsc roles/logging.logWriter serviceAccount:sat-vm@sat-sol-gsc.iam.gserviceaccount.com"
}

import {
  to = google_project_iam_member.vm_logs["roles/monitoring.metricWriter"]
  id = "sat-sol-gsc roles/monitoring.metricWriter serviceAccount:sat-vm@sat-sol-gsc.iam.gserviceaccount.com"
}

# --- registry ---
import {
  to = module.registry.google_artifact_registry_repository.repo
  id = "projects/sat-sol-gsc/locations/us-central1/repositories/sat-images"
}

import {
  to = module.registry.google_artifact_registry_repository_iam_member.reader["serviceAccount:sat-vm@sat-sol-gsc.iam.gserviceaccount.com"]
  id = "projects/sat-sol-gsc/locations/us-central1/repositories/sat-images roles/artifactregistry.reader serviceAccount:sat-vm@sat-sol-gsc.iam.gserviceaccount.com"
}

import {
  to = module.registry.google_service_account.cloudbuild
  id = "projects/sat-sol-gsc/serviceAccounts/cloudbuild-web@sat-sol-gsc.iam.gserviceaccount.com"
}

import {
  to = module.registry.google_project_iam_member.cloudbuild_builder
  id = "sat-sol-gsc roles/cloudbuild.builds.builder serviceAccount:cloudbuild-web@sat-sol-gsc.iam.gserviceaccount.com"
}

# --- storage ---
import {
  to = module.storage.google_storage_bucket.data
  id = "sat-sol-gsc-sat-data"
}

import {
  to = module.storage.google_storage_bucket.offsite
  id = "sat-sol-gsc-backups-offsite"
}

import {
  to = google_storage_bucket_iam_member.vm_data
  id = "b/sat-sol-gsc-sat-data roles/storage.objectAdmin serviceAccount:sat-vm@sat-sol-gsc.iam.gserviceaccount.com"
}

import {
  to = google_storage_bucket_iam_member.vm_offsite["roles/storage.objectCreator"]
  id = "b/sat-sol-gsc-backups-offsite roles/storage.objectCreator serviceAccount:sat-vm@sat-sol-gsc.iam.gserviceaccount.com"
}

import {
  to = google_storage_bucket_iam_member.vm_offsite["roles/storage.objectViewer"]
  id = "b/sat-sol-gsc-backups-offsite roles/storage.objectViewer serviceAccount:sat-vm@sat-sol-gsc.iam.gserviceaccount.com"
}

# --- secrets ---
import {
  to = module.secrets.google_secret_manager_secret.secret["auth-secret"]
  id = "projects/sat-sol-gsc/secrets/sat-auth-secret"
}

import {
  to = module.secrets.google_secret_manager_secret.secret["secret-encryption-key"]
  id = "projects/sat-sol-gsc/secrets/sat-secret-encryption-key"
}

import {
  to = module.secrets.google_secret_manager_secret.secret["internal-ingest-token"]
  id = "projects/sat-sol-gsc/secrets/sat-internal-ingest-token"
}

import {
  to = module.secrets.google_secret_manager_secret.secret["mistral-api-key"]
  id = "projects/sat-sol-gsc/secrets/sat-mistral-api-key"
}

import {
  to = module.secrets.google_secret_manager_secret.secret["email-pass"]
  id = "projects/sat-sol-gsc/secrets/sat-email-pass"
}

# --- vm ---
import {
  to = module.vm.google_compute_address.ip
  id = "projects/sat-sol-gsc/regions/us-east1/addresses/sat-ip"
}

import {
  to = module.vm.google_compute_firewall.http
  id = "projects/sat-sol-gsc/global/firewalls/sat-allow-http"
}

import {
  to = module.vm.google_compute_firewall.ssh_iap
  id = "projects/sat-sol-gsc/global/firewalls/sat-allow-ssh-iap"
}

import {
  to = module.vm.google_compute_disk.data
  id = "projects/sat-sol-gsc/zones/us-east1-b/disks/sat-data"
}

import {
  to = module.vm.google_compute_instance.vm
  id = "projects/sat-sol-gsc/zones/us-east1-b/instances/sat-vm"
}

# --- monitoring ---
import {
  to = module.monitoring.google_monitoring_notification_channel.email
  id = "projects/sat-sol-gsc/notificationChannels/7710533404612246014"
}

import {
  to = module.monitoring.google_monitoring_uptime_check_config.web
  id = "projects/sat-sol-gsc/uptimeCheckConfigs/sat-web-health-nRKF1s104uA"
}

import {
  to = module.monitoring.google_monitoring_uptime_check_config.backup
  id = "projects/sat-sol-gsc/uptimeCheckConfigs/sat-backup-fresh-PvewASyfOHw"
}

import {
  to = module.monitoring.google_logging_metric.http_5xx
  id = "sat_http_5xx"
}

import {
  to = module.monitoring.google_monitoring_alert_policy.web_down
  id = "projects/sat-sol-gsc/alertPolicies/351566337785740964"
}

import {
  to = module.monitoring.google_monitoring_alert_policy.backup_stale
  id = "projects/sat-sol-gsc/alertPolicies/8594952611613018435"
}

import {
  to = module.monitoring.google_monitoring_alert_policy.http_5xx
  id = "projects/sat-sol-gsc/alertPolicies/16368416787034503009"
}
