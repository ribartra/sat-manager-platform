#!/usr/bin/env bash
# Puts an already-built TAG in production (deploy/vm/deploy.sh on the VM, over IAP):
# backup of .env + DB, pull, recreate web + ingest, wait for health, automatic rollback on failure.
#   deploy/scripts/release.sh <TAG>
#   deploy/scripts/release.sh --rollback      # back to the TAG that was running before the last release
#   deploy/scripts/release.sh --current       # print the running TAG
# Build first with build-and-push.sh (or let CI build it). Schema migrations run on start
# (web entrypoint); deploy in the maintenance window when the release has one (deploy/docs/runbook.md).
set -euo pipefail
. "$(dirname "$0")/env.sh"

current_tag() { vm_ssh "sudo grep '^TAG=' /data/stack/.env | cut -d= -f2" 2>/dev/null | tr -d '\r' | tail -1; }

case "${1:-}" in
  "" ) die "usage: release.sh <TAG> | --rollback | --current" ;;
  --current) current_tag; exit 0 ;;
  --rollback)
    # deploy.sh keeps /data/stack/.env.bak-<stamp>-pre-<NEW_TAG>, holding the TAG that was replaced.
    TAG=$(vm_ssh "sudo sh -c 'ls -1t /data/stack/.env.bak-* | head -1 | xargs grep ^TAG= | cut -d= -f2'" 2>/dev/null | tr -d '\r' | tail -1)
    [ -n "$TAG" ] || die "no previous TAG found in /data/stack/.env.bak-*"
    log "rolling back to $TAG" ;;
  *) TAG="$1" ;;
esac

for image in web ingest; do
  image_exists "$REGISTRY/$image:$TAG" || die "$REGISTRY/$image:$TAG does not exist (build it first: make build)"
done

log "running: $(current_tag) -> releasing $TAG"
vm_ssh "sudo /data/stack/deploy.sh '$TAG'"
log "public health: $(health)"
