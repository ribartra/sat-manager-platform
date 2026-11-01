#!/bin/bash
# VM startup script: a Terraform template (deploy/terraform/environments/prod, templatefile()).
# Placeholders like ${DOMAIN} are filled at apply time; bash variables are written $${...} so they
# survive to runtime. Runs on every boot; safe to re-run: `sudo google_metadata_script_runner startup`.
#
# It prepares the machine (disk, Docker, Ops Agent, secrets -> /data/app.env) and installs the stack
# files with apply-stack.sh. It never changes the running image: the TAG in /data/stack/.env belongs
# to deploy.sh (`make release`); INITIAL_TAG is only used on a brand-new disk.
set -euo pipefail

REGION="${REGION}"
CONFIG_BUCKET="${CONFIG_BUCKET}"
OFFSITE_BUCKET="${OFFSITE_BUCKET}"
PROJECT_ID="${PROJECT_ID}"
REGISTRY="${REGISTRY}"
INITIAL_TAG="${INITIAL_TAG}"
DOMAIN="${DOMAIN}"
PREFIX="${PREFIX}"

DATA_DISK="/dev/disk/by-id/google-${DATA_DEVICE}"
MOUNT="/data"

log() { echo "[startup] $*"; }

# --- 1) mount the persistent data disk ------------------------------------------------------------
if ! blkid "$DATA_DISK" >/dev/null 2>&1; then
  log "formatting data disk"
  mkfs.ext4 -m 0 -F "$DATA_DISK"
fi
mkdir -p "$MOUNT"
grep -q " $MOUNT " /etc/fstab || echo "$DATA_DISK $MOUNT ext4 discard,defaults,nofail 0 2" >> /etc/fstab
mount -a
mkdir -p /data/db /data/uploads /data/private/uploads/ingest \
         /data/caddy/conf /data/caddy/data /data/caddy/config /data/stack /data/docker /data/backups-local

# --- 2) docker (data-root + logs on the data disk) + registry auth --------------------------------
# Docker's storage lives on the data disk so images and logs never fill the 20 GB boot disk.
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'DJSON'
{
  "data-root": "/data/docker",
  "log-driver": "json-file",
  "log-opts": { "max-size": "20m", "max-file": "5" }
}
DJSON
if ! command -v docker >/dev/null 2>&1; then
  log "installing docker"
  curl -fsSL https://get.docker.com | sh
fi
systemctl restart docker
gcloud auth configure-docker "$${REGION}-docker.pkg.dev" --quiet

# sqlite3 for online DB backups
command -v sqlite3 >/dev/null 2>&1 || (apt-get update && apt-get install -y --no-install-recommends sqlite3)

# --- 2b) Cloud Ops Agent (its config is installed by apply-stack.sh) ------------------------------
if ! systemctl is-active --quiet google-cloud-ops-agent 2>/dev/null; then
  log "installing Cloud Ops Agent"
  curl -fsSL https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh | bash -s -- --also-install || \
    log "ops agent install failed (non-fatal)"
fi

# --- 3) first-boot seeding (a prebuilt DB is REQUIRED) --------------------------------------------
# The migration chain is not replayable from an empty file, so `migrate deploy` cannot bootstrap
# one. The operator builds it with `npm run db:init:prod` (or pushes one, scripts/push-db-to-cloud.sh).
if [ ! -f /data/db/dev.db ]; then
  gsutil -q stat "gs://$${CONFIG_BUCKET}/seed/dev.db" && \
    gsutil cp "gs://$${CONFIG_BUCKET}/seed/dev.db" /data/db/dev.db || \
    log "WARNING: no seed DB at gs://$${CONFIG_BUCKET}/seed/dev.db"
fi
[ -z "$(ls -A /data/uploads 2>/dev/null)" ] && \
  gsutil -m rsync -r "gs://$${CONFIG_BUCKET}/seed/uploads" /data/uploads 2>/dev/null || true
[ -z "$(ls -A /data/private/uploads/ingest 2>/dev/null)" ] && \
  gsutil -m rsync -r "gs://$${CONFIG_BUCKET}/seed/private" /data/private 2>/dev/null || true

# --- 4) runtime env from Secret Manager -----------------------------------------------------------
# Values are loaded out-of-band (deploy/scripts/load-secrets.sh), so on a first boot they may not
# exist yet: wait for the required ones instead of failing hard.
umask 077
sv() { gcloud secrets versions access latest --secret="$${PREFIX}-$1" 2>/dev/null; }

wait_secs=0
until sv auth-secret >/dev/null && sv secret-encryption-key >/dev/null && sv internal-ingest-token >/dev/null; do
  if [ "$wait_secs" -ge 600 ]; then
    log "ERROR: required secrets missing after 10 min. Run deploy/scripts/load-secrets.sh, then:"
    log "  sudo google_metadata_script_runner startup"
    exit 1
  fi
  log "waiting for secrets (deploy/scripts/load-secrets.sh)... $${wait_secs}s"
  sleep 20; wait_secs=$((wait_secs + 20))
done

{
  echo "AUTH_URL=https://$${DOMAIN}"
  # NextAuth v5 sits behind Caddy: without this it rejects the proxied Host (UntrustedHost).
  echo "AUTH_TRUST_HOST=true"
  echo "AUTH_SECRET=$(sv auth-secret)"
  echo "SECRET_ENCRYPTION_KEY=$(sv secret-encryption-key)"
  echo "INTERNAL_INGEST_TOKEN=$(sv internal-ingest-token)"
  echo "MISTRAL_API_KEY=$(sv mistral-api-key || true)"
  echo "MISTRAL_OCR_MODEL=mistral-ocr-latest"
  echo "MISTRAL_STRUCTURING_MODEL=mistral-large-latest"
  echo "CORS_ALLOWED_ORIGINS=https://$${DOMAIN}"
  echo "EMAIL_FROM=${EMAIL_FROM}"
  echo "EMAIL_HOST=${EMAIL_HOST}"
  echo "EMAIL_PORT=${EMAIL_PORT}"
  echo "EMAIL_USER=${EMAIL_USER}"
  echo "EMAIL_PASS=$(sv email-pass || true)"
  # Runtime media bucket (objects under media/questions/).
  echo "GCS_BUCKET=$${CONFIG_BUCKET}"
  echo "GCS_PROJECT_ID=$${PROJECT_ID}"
} > /data/app.env

# The image TAG is owned by deploy.sh: keep the one already deployed; INITIAL_TAG only on a new disk.
current_tag=$(grep '^TAG=' /data/stack/.env 2>/dev/null | cut -d= -f2 || true)
cat > /data/stack/.env <<EOF
REGISTRY=$${REGISTRY}
TAG=$${current_tag:-$${INITIAL_TAG}}
DOMAIN=$${DOMAIN}
EOF
chmod 600 /data/stack/.env

# Buckets for the backup script and apply-stack.sh.
cat > /etc/sat-backup.env <<BKENV
DATA_BUCKET=$${CONFIG_BUCKET}
OFFSITE_BUCKET=$${OFFSITE_BUCKET}
BKENV

# --- 5) stack files (compose, Caddyfile, deploy/backup/notification scripts, Ops Agent, cron) ------
# Caddy used to read /data/caddy/Caddyfile (single-file mount): keep it as the starting config.
[ -f /data/caddy/conf/Caddyfile ] || { [ -f /data/caddy/Caddyfile ] && cp /data/caddy/Caddyfile /data/caddy/conf/Caddyfile; } || true
gsutil cp "gs://$${CONFIG_BUCKET}/stack/apply-stack.sh" /data/stack/apply-stack.sh
chmod 755 /data/stack/apply-stack.sh
/data/stack/apply-stack.sh

# --- 6) launch the stack --------------------------------------------------------------------------
# Refuse to launch against an empty DB: `migrate deploy` would fail on the non-replayable chain.
if [ ! -f /data/db/dev.db ]; then
  log "ERROR: no database at /data/db/dev.db - a prebuilt DB is required."
  log "  build:  DATABASE_URL=file:./prisma/prod.db npm run db:init:prod"
  log "  upload: gsutil cp prisma/prod.db gs://$${CONFIG_BUCKET}/seed/dev.db"
  log "  retry:  sudo google_metadata_script_runner startup"
  exit 1
fi
cd /data/stack
docker compose -p sat-platform --env-file /data/stack/.env -f /data/stack/docker-compose.yml pull
docker compose -p sat-platform --env-file /data/stack/.env -f /data/stack/docker-compose.yml up -d
log "done (TAG $(grep '^TAG=' /data/stack/.env | cut -d= -f2))"
