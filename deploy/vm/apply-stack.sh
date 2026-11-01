#!/bin/bash
# Installs the stack files from gs://<data bucket>/stack/ (uploaded by Terraform from deploy/vm/)
# onto the VM. Runs ON the VM as root:
#   sudo /data/stack/apply-stack.sh              # validate + install files (no restart)
#   sudo /data/stack/apply-stack.sh --restart    # ... then apply them: compose up -d + caddy reload
# Called by vm-startup.sh on every boot and by `make sync-stack` from the laptop.
#
# Everything is validated BEFORE anything is installed (docker compose config, caddy validate), so a
# broken file never reaches the running stack. Caddy reads a mounted DIRECTORY (/data/caddy/conf),
# never a single bind-mounted file: replacing the file is safe (a single-file mount kept the old
# inode and once served a truncated Caddyfile, 2026-09-30).
set -euo pipefail

RESTART=0
[ "${1:-}" = "--restart" ] && RESTART=1

STACK=/data/stack
PROJECT=sat-platform
CADDY_DIR=/data/caddy/conf
OPS_AGENT_CONFIG=/etc/google-cloud-ops-agent/config.yaml
# DATA_BUCKET / OFFSITE_BUCKET (written by vm-startup.sh).
# shellcheck disable=SC1091
. /etc/sat-backup.env

log() { echo "[apply-stack $(date -u +%T)] $*"; }

stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT

gsutil -q -m cp "gs://${DATA_BUCKET}/stack/*" "$stage/"
for f in docker-compose.prod.yml Caddyfile deploy.sh sat-db-backup.sh sat-notifications.sh ops-agent.yaml apply-stack.sh; do
  [ -s "$stage/$f" ] || { log "missing or empty stack/$f in gs://${DATA_BUCKET} - nothing installed"; exit 1; }
done

# --- validate ---------------------------------------------------------------------------------
docker compose -p "$PROJECT" --env-file "$STACK/.env" -f "$stage/docker-compose.prod.yml" config -q
domain=$(grep '^DOMAIN=' "$STACK/.env" | cut -d= -f2)
docker run --rm -e "DOMAIN=$domain" -v "$stage/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2 \
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 \
  || { log "Caddyfile does not validate - nothing installed"; exit 1; }
for f in deploy.sh sat-db-backup.sh sat-notifications.sh apply-stack.sh; do bash -n "$stage/$f"; done
log "validated"

# --- install ----------------------------------------------------------------------------------
install -d -m 755 "$STACK" "$CADDY_DIR"
install -m 644 "$stage/docker-compose.prod.yml" "$STACK/docker-compose.yml"
install -m 644 "$stage/Caddyfile" "$CADDY_DIR/Caddyfile"
install -m 755 "$stage/deploy.sh" "$STACK/deploy.sh"
install -m 755 "$stage/apply-stack.sh" "$STACK/apply-stack.sh"
install -m 755 "$stage/sat-db-backup.sh" /usr/local/bin/sat-db-backup.sh
install -m 755 "$stage/sat-notifications.sh" /usr/local/bin/sat-notifications.sh

# Cloud Ops Agent: ships the containers' JSON logs to Cloud Logging (the 5xx alert reads them).
if [ -d "$(dirname "$OPS_AGENT_CONFIG")" ] && ! cmp -s "$stage/ops-agent.yaml" "$OPS_AGENT_CONFIG"; then
  install -m 644 "$stage/ops-agent.yaml" "$OPS_AGENT_CONFIG"
  systemctl restart google-cloud-ops-agent || log "ops agent restart failed (non-fatal)"
  log "ops agent config updated"
fi

# Backups every 6 h (RNF-15) and deadline reminders every hour.
cat > /etc/cron.d/sat-db-backup <<'CRON'
0 */6 * * * root /usr/local/bin/sat-db-backup.sh >> /var/log/sat-db-backup.log 2>&1
CRON
cat > /etc/cron.d/sat-notifications <<'CRON'
5 * * * * root /usr/local/bin/sat-notifications.sh >> /var/log/sat-notifications.log 2>&1
CRON
log "installed"

[ "$RESTART" = 1 ] || exit 0

# --- apply ------------------------------------------------------------------------------------
# Recreates only the services whose configuration changed (limits, mounts); the image TAG is
# whatever deploy.sh last wrote to .env. Caddy holds requests up to 30 s while web restarts.
cd "$STACK"
docker compose -p "$PROJECT" --env-file "$STACK/.env" -f "$STACK/docker-compose.yml" up -d --remove-orphans
docker exec "$PROJECT-caddy-1" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
log "applied (compose up -d + caddy reload)"
