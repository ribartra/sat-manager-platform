#!/bin/bash
# SAT platform backups (RNF-15). Installed at /usr/local/bin/sat-db-backup.sh by vm-startup.sh;
# cron runs it every 6 h. Config in /etc/sat-backup.env:
#   DATA_BUCKET     same-project bucket (6-hourly DB copies, fast restore)
#   OFFSITE_BUCKET  separate bucket in another region (daily DB + uploads/private copy, 190-day
#                   lifecycle; the VM can create/read but not delete objects there)
#
# Every run: sqlite3 .backup (consistent on a live WAL DB) → integrity_check → upload.
# Daily (00 UTC run, or FORCE_OFFSITE=1): gzip'd DB + no-clobber copy of /data/uploads and
# /data/private to the off-site bucket. On success writes /data/db/backup-status.json, which the
# app serves at /api/health/backup (uptime check → email alert when it gets stale).
set -euo pipefail

source /etc/sat-backup.env
DB=/data/db/dev.db
LOCAL=/data/backups-local
STATUS=/data/db/backup-status.json
ts=$(date -u +%F-%H%M)
out="$LOCAL/dev-$ts.db"
mkdir -p "$LOCAL"

log() { echo "$(date -u +%FT%TZ) $*"; }
fail() {
  log "BACKUP FAILED: $*"
  # Failure marker keeps the last success time, so /api/health/backup goes stale and alerts.
  exit 1
}
trap 'fail "line $LINENO"' ERR

sqlite3 "$DB" ".backup '$out'"
[ "$(sqlite3 "$out" 'PRAGMA integrity_check;')" = "ok" ] || fail "integrity_check on $out"
bytes=$(stat -c %s "$out")

gsutil -q cp "$out" "gs://$DATA_BUCKET/backups/dev-$ts.db"
log "db -> gs://$DATA_BUCKET/backups/dev-$ts.db ($bytes bytes)"

offsite="skipped"
if [ "$(date -u +%H)" = "00" ] || [ "${FORCE_OFFSITE:-0}" = "1" ]; then
  gzip -c "$out" > "$out.gz"
  gsutil -q cp "$out.gz" "gs://$OFFSITE_BUCKET/db/dev-$ts.db.gz"
  rm -f "$out.gz"
  # rsync compares listings (about 1 list call per 1000 objects) instead of one metadata request
  # per file; --no-clobber never overwrites (the VM has no delete/overwrite permission off-site,
  # and staged/question files are immutable once written).
  gcloud storage rsync --recursive --no-clobber --quiet /data/uploads "gs://$OFFSITE_BUCKET/files/uploads"
  gcloud storage rsync --recursive --no-clobber --quiet /data/private "gs://$OFFSITE_BUCKET/files/private"
  offsite="gs://$OFFSITE_BUCKET/db/dev-$ts.db.gz"
  log "offsite -> $offsite (+ uploads, private)"
fi

find "$LOCAL" -name 'dev-*.db' -mtime +3 -delete

printf '{"lastSuccessAt":"%s","file":"dev-%s.db","bytes":%s,"offsite":"%s"}\n' \
  "$(date -u +%FT%TZ)" "$ts" "$bytes" "$offsite" > "$STATUS.tmp"
mv "$STATUS.tmp" "$STATUS"
chmod 644 "$STATUS"
log "ok"
