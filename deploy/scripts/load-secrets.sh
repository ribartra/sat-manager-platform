#!/usr/bin/env bash
# Load secret VALUES into Secret Manager, out-of-band from Terraform so they
# never land in tfstate. Terraform (deploy/terraform/modules/secrets) creates the empty
# containers; this adds a version to each.
#
# Idempotent by design: a secret that already has a version is left untouched
# unless FORCE=1. This is critical for secret-encryption-key — regenerating it
# would make the app unable to decrypt the Mistral key stored in the DB.
#
# Usage:
#   deploy/scripts/load-secrets.sh            (PROJECT/PREFIX from prod.tfvars; `make secrets`)
# Optional (else auto-generated / left empty):
#   AUTH_SECRET=... SECRET_ENCRYPTION_KEY=... INTERNAL_INGEST_TOKEN=... \
#   MISTRAL_API_KEY=... EMAIL_PASS=... FORCE=1 deploy/scripts/load-secrets.sh
set -euo pipefail

. "$(dirname "$0")/env.sh"
FORCE="${FORCE:-0}"

gen() { openssl rand -base64 48 | tr -d '\n'; }

# secret-suffix -> value ("" means: create an empty version, e.g. optional keys)
AUTH_SECRET="${AUTH_SECRET:-$(gen)}"
SECRET_ENCRYPTION_KEY="${SECRET_ENCRYPTION_KEY:-$(gen)}"
INTERNAL_INGEST_TOKEN="${INTERNAL_INGEST_TOKEN:-$(gen)}"
MISTRAL_API_KEY="${MISTRAL_API_KEY:-}"
EMAIL_PASS="${EMAIL_PASS:-}"

add_version() {
  local suffix="$1" value="$2" name="${PREFIX}-$1"
  if [ "$FORCE" != "1" ] && gcloud secrets versions list "$name" --project "$PROJECT" \
       --filter="state=ENABLED" --format="value(name)" 2>/dev/null | grep -q .; then
    echo ">> ${name}: already has a version, skipping (FORCE=1 to override)"
    return 0
  fi
  printf '%s' "$value" | gcloud secrets versions add "$name" --project "$PROJECT" --data-file=- >/dev/null
  echo ">> ${name}: version added"
}

add_version auth-secret           "$AUTH_SECRET"
add_version secret-encryption-key "$SECRET_ENCRYPTION_KEY"
add_version internal-ingest-token "$INTERNAL_INGEST_TOKEN"
add_version mistral-api-key       "$MISTRAL_API_KEY"
add_version email-pass            "$EMAIL_PASS"

echo ">> done. If the VM already booted without secrets, re-render env & relaunch:"
echo "   gcloud compute ssh ${PREFIX}-vm --tunnel-through-iap --command='sudo google_metadata_script_runner startup'"
