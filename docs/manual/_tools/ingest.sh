#!/usr/bin/env bash
# Starts the ingest service (FastAPI, :8000) against the manual's database copy, so "Import with AI"
# works on the :3001 app (step 1 saves the files through it). Uploads go under $MANUAL_WORK; the
# images it extracts go to the worktree's .private/uploads/ingest, where the :3001 app serves them.
# Uses the system python3 with ingest_service/requirements.txt installed.
set -euo pipefail
: "${MANUAL_WORK:?set MANUAL_WORK}"
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
DB="${MANUAL_DB:-$MANUAL_WORK/man.db}"
# Same token / keys as the web app (.env), so web → ingest calls are accepted.
envval() { grep -E "^$1=" "$REPO/.env" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
mkdir -p "$MANUAL_WORK/ingest-uploads" "$MANUAL_WORK/wt/.private/uploads/ingest"
cd "$REPO/ingest_service"
exec env \
  DATABASE_URL="file:$DB" \
  INGEST_UPLOAD_ROOT="$MANUAL_WORK/ingest-uploads" \
  INGEST_PUBLIC_UPLOAD_ROOT="$MANUAL_WORK/wt/.private/uploads/ingest" \
  INTERNAL_INGEST_TOKEN="$(envval INTERNAL_INGEST_TOKEN)" \
  AUTH_SECRET="$(envval AUTH_SECRET)" \
  SECRET_ENCRYPTION_KEY="$(envval SECRET_ENCRYPTION_KEY)" \
  python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000
