#!/usr/bin/env bash
# Compares the local dev.db with a fresh copy of production WITHOUT replacing anything:
# schema, migrations, data patches, row counts and the content of the bank tables.
#   1. on the VM: sat-db-backup.sh (consistent copy -> gs://<data>/backups/)
#   2. download it to a temporary file, compare (scripts/compare-db.mjs), delete it
# Exit 1 when they differ. `make pull-db` makes local equal to production.
set -euo pipefail
. "$(dirname "$0")/env.sh"
cd "$REPO_ROOT"

log "fresh backup on the VM"
vm_ssh "sudo /usr/local/bin/sat-db-backup.sh >/tmp/compare-db.log 2>&1; sudo tail -1 /tmp/compare-db.log"
object=$(gcloud storage ls "gs://$DATA_BUCKET/backups/dev-*.db" --project "$PROJECT" | sort | tail -1)
[ -n "$object" ] || die "no backup found in gs://$DATA_BUCKET/backups/"
copy=$(mktemp --suffix=.db)
trap 'rm -f "$copy"' EXIT
gcloud storage cp "$object" "$copy" --project "$PROJECT" >/dev/null
node scripts/compare-db.mjs "$copy" "${LOCAL_DB:-dev.db}"
