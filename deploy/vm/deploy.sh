#!/bin/bash
# Deploy a new image TAG on the VM (RNF-24). Run ON the VM:  sudo /data/stack/deploy.sh <TAG>
#   1. disk guard: prune unused images when / is above 80 %
#   2. backups: /data/stack/.env and a WAL-safe copy of the DB (keeps the 2 newest pre-deploy copies)
#   3. switch TAG, pull, recreate web + ingest (Caddy keeps requests waiting during the restart)
#   4. wait for the web healthcheck; on failure, roll back to the previous TAG automatically
# The web entrypoint refuses to start when `prisma migrate deploy` fails, so a broken migration
# shows up here as an unhealthy container and is rolled back. See deploy/docs/runbook.md.
set -euo pipefail

NEW_TAG="${1:?usage: deploy.sh <TAG>}"
STACK=/data/stack
ENV_FILE="$STACK/.env"
PROJECT=sat-platform
WEB=sat-platform-web-1
BACKUPS=/data/db/backups
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-240}
stamp=$(date -u +%Y%m%d-%H%M%S)

log() { echo "[deploy $(date -u +%T)] $*"; }
compose() { docker compose -p "$PROJECT" --env-file "$ENV_FILE" -f "$STACK/docker-compose.yml" "$@"; }

wait_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT)) state
  while [ $SECONDS -lt $deadline ]; do
    state=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$WEB" 2>/dev/null || echo missing)
    case "$state" in
      healthy) return 0 ;;
      exited|dead|missing) [ $SECONDS -gt $((deadline - HEALTH_TIMEOUT + 30)) ] && return 1 ;;
    esac
    sleep 5
  done
  return 1
}

PREV_TAG=$(grep '^TAG=' "$ENV_FILE" | cut -d= -f2)
[ "$PREV_TAG" = "$NEW_TAG" ] && { log "already on $NEW_TAG"; exit 0; }
log "current $PREV_TAG -> new $NEW_TAG"

# 1) disk guard (a full disk once truncated the Caddyfile and took the site down)
used=$(df --output=pcent / | tail -1 | tr -dc 0-9)
if [ "$used" -gt 80 ]; then
  log "disk at ${used}% - pruning unused images"
  docker image prune -af --filter "until=72h" >/dev/null || true
fi

# 2) backups
cp -p "$ENV_FILE" "$ENV_FILE.bak-$stamp-pre-$NEW_TAG"
mkdir -p "$BACKUPS"
db_backup="$BACKUPS/devdb-pre-$NEW_TAG-$stamp.bak"
sqlite3 /data/db/dev.db ".backup '$db_backup'"
[ "$(sqlite3 "$db_backup" 'PRAGMA integrity_check;')" = "ok" ] || { log "DB backup failed integrity_check - aborting"; exit 1; }
log "db backup $db_backup"
ls -1t "$BACKUPS"/devdb-pre-*.bak 2>/dev/null | tail -n +3 | xargs -r rm -f
ls -1t "$ENV_FILE".bak-* 2>/dev/null | tail -n +6 | xargs -r rm -f

# 3) switch + pull + recreate
sed -i "s/^TAG=.*/TAG=$NEW_TAG/" "$ENV_FILE"
if ! compose pull web ingest-service; then
  log "pull failed - restoring TAG $PREV_TAG"
  sed -i "s/^TAG=.*/TAG=$PREV_TAG/" "$ENV_FILE"
  exit 1
fi
compose up -d web ingest-service

# 4) health or rollback
if wait_healthy; then
  log "healthy on $NEW_TAG"
  docker logs --since 5m "$WEB" 2>&1 | grep -E '^\[(entrypoint|data-patches)\]|backfill' || true
  exit 0
fi

log "NOT healthy within ${HEALTH_TIMEOUT}s - rolling back to $PREV_TAG"
docker logs --tail 60 "$WEB" 2>&1 || true
sed -i "s/^TAG=.*/TAG=$PREV_TAG/" "$ENV_FILE"
compose up -d web ingest-service
if wait_healthy; then
  log "rolled back to $PREV_TAG (healthy). If the new migration was applied, the pre-deploy DB copy is $db_backup"
else
  log "ROLLBACK ALSO UNHEALTHY - restore the DB from $db_backup (deploy/docs/runbook.md#restore)"
fi
exit 1
