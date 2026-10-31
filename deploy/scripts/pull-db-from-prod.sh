#!/usr/bin/env bash
# Replaces the local ./dev.db with a fresh copy of the production database.
#   1. on the VM: sat-db-backup.sh (consistent sqlite3 .backup + integrity_check -> gs://<data>/backups/)
#   2. download that copy to ./backups/prod-pull-<date>.db
#   3. local safety copy (npm run db:backup), restore (npm run db:restore), migrate deploy, data patches
#   4. drop *_ENCRYPTED settings: encrypted with the production key, unreadable locally
# Stop `npm run dev` / docker compose first: replacing dev.db under a running server corrupts it.
# The result holds REAL user data: never commit dev.db.
set -euo pipefail
. "$(dirname "$0")/env.sh"
cd "$REPO_ROOT"

if command -v fuser >/dev/null && fuser dev.db >/dev/null 2>&1; then
  die "dev.db is open by another process (stop the dev server first)"
fi

log "fresh backup on the VM"
vm_ssh "sudo /usr/local/bin/sat-db-backup.sh >/tmp/pull-db.log 2>&1; sudo tail -2 /tmp/pull-db.log"
object=$(gcloud storage ls "gs://$DATA_BUCKET/backups/dev-*.db" --project "$PROJECT" | sort | tail -1)
[ -n "$object" ] || die "no backup found in gs://$DATA_BUCKET/backups/"
mkdir -p backups
target="backups/prod-pull-$(date +%Y%m%d-%H%M).db"
gcloud storage cp "$object" "$target" --project "$PROJECT"

node -e '
const Database = require(process.cwd() + "/node_modules/better-sqlite3");
const db = new Database(process.argv[1]);
const ok = db.prepare("pragma integrity_check").get().integrity_check;
if (ok !== "ok") { console.error("integrity_check:", ok); process.exit(1); }
const removed = db.prepare("delete from AppSetting where key like ?").run("%\\_ENCRYPTED").changes;
console.log("integrity ok; encrypted settings removed:", removed);
' "$target"

npm run -s db:backup
BACKUP_FILE="$target" npm run -s db:restore
npx prisma migrate deploy
npm run -s db:patch
log "dev.db is now production as of $(basename "$object") + the migrations and data patches pending in this repo. Do not commit it."
