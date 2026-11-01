#!/usr/bin/env bash
# Shared settings for the deploy scripts, read from the committed Terraform values
# (deploy/terraform/environments/prod/prod.tfvars) so names live in one place. Any of them can be
# overridden from the environment. Source it:  . "$(dirname "$0")/env.sh"

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"
TFVARS="$DEPLOY_DIR/terraform/environments/prod/prod.tfvars"

tfvar() { sed -n "s/^$1[[:space:]]*=[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$TFVARS" | head -1; }

PROJECT="${PROJECT:-$(tfvar project_id)}"
REGION="${REGION:-$(tfvar region)}"
ZONE="${ZONE:-$(tfvar vm_zone)}"
PREFIX="${PREFIX:-$(tfvar name_prefix)}"
DOMAIN="${DOMAIN:-$(tfvar domain)}"
VM="${VM:-${PREFIX}-vm}"
REGISTRY="${REGISTRY:-${REGION}-docker.pkg.dev/${PROJECT}/${PREFIX}-images}"
DATA_BUCKET="${DATA_BUCKET:-${PROJECT}-${PREFIX}-data}"
CLOUDBUILD_SA="${CLOUDBUILD_SA:-cloudbuild-web@${PROJECT}.iam.gserviceaccount.com}"
export PROJECT REGION ZONE PREFIX DOMAIN VM REGISTRY DATA_BUCKET CLOUDBUILD_SA

log() { echo "[$(basename "$0") $(date +%T)] $*"; }
die() { echo "[$(basename "$0")] ERROR: $*" >&2; exit 1; }

# Runs a command on the VM through IAP (port 22 is only open to Google's IAP range).
vm_ssh() {
  gcloud compute ssh "$VM" --zone "$ZONE" --project "$PROJECT" --tunnel-through-iap --command "$1"
}

image_exists() { gcloud artifacts docker images describe "$1" --project "$PROJECT" >/dev/null 2>&1; }

health() { curl -fsS --max-time 15 "https://${DOMAIN}/api/health"; }
