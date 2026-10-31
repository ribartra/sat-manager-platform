#!/usr/bin/env bash
# Installs the stack files (deploy/vm/*: compose, Caddyfile, deploy/backup/notification scripts,
# Ops Agent config, cron) on the VM and applies them (compose up -d + caddy reload).
# Terraform is the only writer of gs://<data>/stack/: run `make apply` first; this script refuses
# to continue when the bucket does not match deploy/vm/.
#   deploy/scripts/sync-stack.sh            # install + apply
#   deploy/scripts/sync-stack.sh --no-restart
set -euo pipefail
. "$(dirname "$0")/env.sh"

restart="--restart"
[ "${1:-}" = "--no-restart" ] && restart=""

stale=()
for file in apply-stack.sh docker-compose.prod.yml Caddyfile deploy.sh sat-db-backup.sh sat-notifications.sh ops-agent.yaml; do
  local_md5=$(openssl dgst -md5 -binary "$DEPLOY_DIR/vm/$file" | base64)
  remote_md5=$(gcloud storage objects describe "gs://$DATA_BUCKET/stack/$file" --project "$PROJECT" --format='value(md5_hash)' 2>/dev/null || true)
  [ "$local_md5" = "$remote_md5" ] || stale+=("$file")
done
[ ${#stale[@]} -eq 0 ] || die "gs://$DATA_BUCKET/stack/ is not up to date (${stale[*]}): run 'make apply' first"

log "installing stack files on $VM ${restart:+and applying them}"
vm_ssh "sudo gsutil -q cp gs://$DATA_BUCKET/stack/apply-stack.sh /data/stack/apply-stack.sh && sudo chmod 755 /data/stack/apply-stack.sh && sudo /data/stack/apply-stack.sh $restart"
[ -z "$restart" ] || log "public health: $(health)"
