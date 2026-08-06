#!/bin/bash
# VM startup script (Terraform template). Placeholders like ${DOMAIN} are filled
# by templatefile() at apply time; bash $VARS and $(...) survive to runtime.
set -euo pipefail

REGION="${REGION}"
CONFIG_BUCKET="${CONFIG_BUCKET}"
REGISTRY="${REGISTRY}"
TAG="${TAG}"
DOMAIN="${DOMAIN}"
PREFIX="${PREFIX}"

DATA_DISK="/dev/disk/by-id/google-sat-data"
MOUNT="/data"

log() { echo "[startup] $*"; }

# --- 1) mount the persistent data disk ---------------------------------------
if ! blkid "$DATA_DISK" >/dev/null 2>&1; then
  log "formatting data disk"
  mkfs.ext4 -m 0 -F "$DATA_DISK"
fi
mkdir -p "$MOUNT"
grep -q "$MOUNT" /etc/fstab || echo "$DATA_DISK $MOUNT ext4 discard,defaults,nofail 0 2" >> /etc/fstab
mount -a
mkdir -p /data/db /data/uploads /data/private/uploads/ingest /data/caddy/data /data/caddy/config /data/stack

# --- 2) docker + registry auth -----------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  log "installing docker"
  curl -fsSL https://get.docker.com | sh
fi
gcloud auth configure-docker "$${REGION}-docker.pkg.dev" --quiet

# sqlite3 for online DB backups
command -v sqlite3 >/dev/null 2>&1 || (apt-get update && apt-get install -y --no-install-recommends sqlite3)

# --- 3) pull stack config from the config bucket -----------------------------
gsutil cp "gs://$${CONFIG_BUCKET}/stack/docker-compose.prod.yml" /data/stack/docker-compose.yml
gsutil cp "gs://$${CONFIG_BUCKET}/stack/Caddyfile" /data/caddy/Caddyfile

# --- 4) first-boot seeding (optional) ----------------------------------------
if [ ! -f /data/db/dev.db ]; then
  gsutil -q stat "gs://$${CONFIG_BUCKET}/seed/dev.db" && \
    gsutil cp "gs://$${CONFIG_BUCKET}/seed/dev.db" /data/db/dev.db || \
    log "no seed DB found (migrations will create schema on first web start)"
fi
[ -z "$(ls -A /data/uploads 2>/dev/null)" ] && \
  gsutil -m rsync -r "gs://$${CONFIG_BUCKET}/seed/uploads" /data/uploads 2>/dev/null || true
[ -z "$(ls -A /data/private 2>/dev/null)" ] && \
  gsutil -m rsync -r "gs://$${CONFIG_BUCKET}/seed/private" /data/private 2>/dev/null || true

# --- 5) render runtime env from Secret Manager -------------------------------
umask 077
sv() { gcloud secrets versions access latest --secret="$${PREFIX}-$1"; }
{
  echo "AUTH_URL=https://$${DOMAIN}"
  echo "AUTH_SECRET=$(sv auth-secret)"
  echo "SECRET_ENCRYPTION_KEY=$(sv secret-encryption-key)"
  echo "INTERNAL_INGEST_TOKEN=$(sv internal-ingest-token)"
  echo "MISTRAL_API_KEY=$(sv mistral-api-key)"
  echo "MISTRAL_OCR_MODEL=mistral-ocr-latest"
  echo "MISTRAL_STRUCTURING_MODEL=mistral-large-latest"
  echo "CORS_ALLOWED_ORIGINS=https://$${DOMAIN}"
  echo "EMAIL_FROM=${EMAIL_FROM}"
  echo "EMAIL_HOST=${EMAIL_HOST}"
  echo "EMAIL_PORT=${EMAIL_PORT}"
  echo "EMAIL_USER=${EMAIL_USER}"
  echo "EMAIL_PASS=$(sv email-pass)"
} > /data/app.env

cat > /data/stack/.env <<EOF
REGISTRY=$${REGISTRY}
TAG=$${TAG}
DOMAIN=$${DOMAIN}
EOF
chmod 600 /data/stack/.env

# --- 6) daily SQLite backup to the config bucket -----------------------------
cat > /usr/local/bin/sat-db-backup.sh <<BK
#!/bin/bash
set -e
ts=\$(date +%F-%H%M)
sqlite3 /data/db/dev.db ".backup /tmp/dev-\$ts.db"
gsutil cp "/tmp/dev-\$ts.db" "gs://$${CONFIG_BUCKET}/backups/dev-\$ts.db"
rm -f "/tmp/dev-\$ts.db"
BK
chmod +x /usr/local/bin/sat-db-backup.sh
ln -sf /usr/local/bin/sat-db-backup.sh /etc/cron.daily/sat-db-backup

# --- 7) launch the stack -----------------------------------------------------
cd /data/stack
docker compose --env-file /data/stack/.env pull
docker compose --env-file /data/stack/.env up -d
log "done"
