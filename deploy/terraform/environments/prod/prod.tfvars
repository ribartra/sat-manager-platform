# Production values (none secret; committed so they are never lost again).
# Secret VALUES live only in Secret Manager: deploy/scripts/load-secrets.sh.
project_id     = "sat-sol-gsc"
region         = "us-central1" # Artifact Registry, data bucket, Cloud Build
vm_region      = "us-east1"    # static IP
vm_zone        = "us-east1-b"  # VM + data disk
offsite_region = "us-west1"
name_prefix    = "sat"
domain         = "satsol.org"

machine_type = "e2-medium"
data_disk_gb = 50

# Only used if the VM is ever recreated. The running version is set by `make release`.
initial_image_tag = "ws-20261030-student-roles"

# SMTP fallback (non-secret part; the password is the sat-email-pass secret). Admin › Settings › SMTP
# overrides these field by field (that is where the Gmail app password is entered).
email_from = "sgadeab@gmail.com"
email_host = "smtp.gmail.com"
email_port = 587
email_user = "sgadeab@gmail.com"

alert_email = "admin@nordmetric.com"

github_repository = "ribartra/sat-manager-platform"

registry_cleanup_dry_run = true
