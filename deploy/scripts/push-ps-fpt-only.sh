#!/usr/bin/env bash
# Push local DB to production with only PUBLISHED Practice Sets + Full Practice Tests
# assignable. Non-PS/FPT content is archived/rejected in the snapshot only (local intact).
#
# Prerequisites:
#   gcloud auth login
#   .secrets/prod-admin-credentials.txt  (or export PROD_ADMIN_EMAIL/PASSWORD)
#
# Usage:
#   deploy/scripts/push-ps-fpt-only.sh [--with-assets] [--yes]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${PROD_ADMIN_EMAIL:-}" || -z "${PROD_ADMIN_PASSWORD:-}" ]]; then
  CRED_FILE="${CRED_FILE:-.secrets/prod-admin-credentials.txt}"
  if [[ -f "$CRED_FILE" ]]; then
    while IFS= read -r line; do
      [[ -z "$line" || "$line" == \#* ]] && continue
      if [[ "$line" == *"/"* && "$line" == *"@"* ]]; then
        PROD_ADMIN_EMAIL="$(echo "$line" | awk -F'/' '{gsub(/^ +| +$/,"",$1); print $1}')"
        PROD_ADMIN_PASSWORD="$(echo "$line" | awk -F'/' '{gsub(/^ +| +$/,"",$2); print $2}')"
        break
      fi
    done < "$CRED_FILE"
  fi
fi

: "${PROD_ADMIN_EMAIL:?Set PROD_ADMIN_EMAIL or put credentials in .secrets/prod-admin-credentials.txt}"
: "${PROD_ADMIN_PASSWORD:?Set PROD_ADMIN_PASSWORD or put credentials in .secrets/prod-admin-credentials.txt}"

export PROD_ADMIN_EMAIL PROD_ADMIN_PASSWORD
export CONTENT_FILTER=ps-fpt-only
export PURGE_ENCRYPTED="${PURGE_ENCRYPTED:-true}"
export DISABLE_EMAILS="${DISABLE_EMAILS:-admin@sat.com,teacher.pending@sat.com}"
export ROTATE_EMAILS="${ROTATE_EMAILS:-teacher@sat.com}"
# PROJECT / BUCKET / ZONE / VM / DOMAIN: from prod.tfvars (push-db-to-cloud.sh sources env.sh).
export LOCAL_DB="${LOCAL_DB:-./dev.db}"

exec deploy/scripts/push-db-to-cloud.sh "$@"
