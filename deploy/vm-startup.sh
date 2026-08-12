#!/bin/bash
# VM startup script (Terraform template). Placeholders like ${DOMAIN} are filled
# by templatefile() at apply time; bash $VARS ($${...}) and $(...) survive to
# runtime. Safe to re-run: `sudo google_metadata_script_runner startup`.
set -euo pipefail

REGION="${REGION}"
CONFIG_BUCKET="${CONFIG_BUCKET}"
PROJECT_ID="${PROJECT_ID}"
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
mkdir -p /data/db /data/uploads /data/private/uploads/ingest \
         /data/caddy/data /data/caddy/config /data/stack /data/docker /data/backups-local

# --- 2) docker (data-root + logs on the data disk) + registry auth -----------
# Point Docker's storage at the big data disk so images/layers/logs never fill
# the 20 GB boot disk, and cap container log growth.
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

# --- 2b) Cloud Ops Agent (logs + metrics; logging.logWriter alone does nothing)
if ! systemctl is-active --quiet google-cloud-ops-agent 2>/dev/null; then
  log "installing Cloud Ops Agent"
  curl -fsSL https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh | bash -s -- --also-install || \
    log "ops agent install failed (non-fatal)"
fi

# --- 3) pull stack config from the config bucket -----------------------------
gsutil cp "gs://$${CONFIG_BUCKET}/stack/docker-compose.prod.yml" /data/stack/docker-compose.yml
gsutil cp "gs://$${CONFIG_BUCKET}/stack/Caddyfile" /data/caddy/Caddyfile

# --- 4) first-boot seeding (REQUIRED) ----------------------------------------
# A prebuilt DB is mandatory: the migration chain is NOT replayable from empty
# (see DEPLOY_GCP.md), so `migrate deploy` cannot bootstrap an empty file. The
# operator builds it locally with `npm run db:init:prod` and uploads it.
if [ ! -f /data/db/dev.db ]; then
  gsutil -q stat "gs://$${CONFIG_BUCKET}/seed/dev.db" && \
    gsutil cp "gs://$${CONFIG_BUCKET}/seed/dev.db" /data/db/dev.db || \
    log "WARNING: no seed DB at gs://$${CONFIG_BUCKET}/seed/dev.db"
fi
[ -z "$(ls -A /data/uploads 2>/dev/null)" ] && \
  gsutil -m rsync -r "gs://$${CONFIG_BUCKET}/seed/uploads" /data/uploads 2>/dev/null || true
[ -z "$(ls -A /data/private 2>/dev/null)" ] && \
  gsutil -m rsync -r "gs://$${CONFIG_BUCKET}/seed/private" /data/private 2>/dev/null || true

# --- 5) render runtime env from Secret Manager -------------------------------
# Values are loaded out-of-band (deploy/load-secrets.sh), so on a first boot
# they may not exist yet. Wait for the required ones instead of failing hard.
umask 077
sv() { gcloud secrets versions access latest --secret="$${PREFIX}-$1" 2>/dev/null; }

wait_secs=0
until sv auth-secret >/dev/null && sv secret-encryption-key >/dev/null && sv internal-ingest-token >/dev/null; do
  if [ "$wait_secs" -ge 600 ]; then
    log "ERROR: required secrets missing after 10min. Run deploy/load-secrets.sh, then:"
    log "  sudo google_metadata_script_runner startup"
    exit 1
  fi
  log "waiting for secrets to be loaded (deploy/load-secrets.sh)... $${wait_secs}s"
  sleep 20; wait_secs=$((wait_secs + 20))
done

{
  echo "AUTH_URL=https://$${DOMAIN}"
  # NextAuth v5 sits behind Caddy: without this it rejects the proxied Host
  # with UntrustedHost and login fails.
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
  # Runtime media bucket (same project data bucket; objects under media/questions/).
  echo "GCS_BUCKET=$${CONFIG_BUCKET}"
  echo "GCS_PROJECT_ID=$${PROJECT_ID}"
} > /data/app.env

cat > /data/stack/.env <<EOF
REGISTRY=$${REGISTRY}
TAG=$${TAG}
DOMAIN=$${DOMAIN}
EOF
chmod 600 /data/stack/.env

# --- 6) SQLite backup every 6h to the config bucket --------------------------
# RPO target ~6h. Uses sqlite3 .backup (safe on a live WAL DB), keeps a local
# copy for fast restore, and prunes local copies older than 3 days.
cat > /usr/local/bin/sat-db-backup.sh <<BK
#!/bin/bash
set -e
ts=\$(date +%F-%H%M)
sqlite3 /data/db/dev.db ".backup /data/backups-local/dev-\$ts.db"
gsutil cp "/data/backups-local/dev-\$ts.db" "gs://$${CONFIG_BUCKET}/backups/dev-\$ts.db"
find /data/backups-local -name 'dev-*.db' -mtime +3 -delete
BK
chmod +x /usr/local/bin/sat-db-backup.sh
cat > /etc/cron.d/sat-db-backup <<'CRON'
0 */6 * * * root /usr/local/bin/sat-db-backup.sh >> /var/log/sat-db-backup.log 2>&1
CRON

# --- 7) launch the stack -----------------------------------------------------
# Refuse to launch against an empty DB: the web entrypoint's `migrate deploy`
# would fail on the non-replayable chain and leave a corrupt/partial schema.
if [ ! -f /data/db/dev.db ]; then
  log "ERROR: no database at /data/db/dev.db — a prebuilt DB is required."
  log "  build:  DATABASE_URL=file:./prisma/prod.db npm run db:init:prod"
  log "  upload: gsutil cp prisma/prod.db gs://$${CONFIG_BUCKET}/seed/dev.db"
  log "  retry:  sudo google_metadata_script_runner startup"
  exit 1
fi
cd /data/stack
docker compose --env-file /data/stack/.env pull
docker compose --env-file /data/stack/.env up -d
log "done"
