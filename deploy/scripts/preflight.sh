#!/usr/bin/env bash
# Checks that need no cloud credentials (CI-safe): Terraform format + validate, shell syntax,
# the rendered startup script, compose + Caddyfile (when Docker is available) and deploy policies.
set -euo pipefail
. "$(dirname "$0")/env.sh"
cd "$DEPLOY_DIR"
fail=0
check() { if eval "$2" >/dev/null 2>&1; then echo "PASS $1"; else echo "FAIL $1"; fail=1; fi; }

check "terraform fmt" "terraform fmt -check -recursive terraform"
for root in terraform/bootstrap terraform/environments/prod; do
  check "terraform validate $root" "terraform -chdir=$root init -backend=false -input=false && terraform -chdir=$root validate"
done

for script in vm/*.sh scripts/*.sh; do check "bash -n $script" "bash -n $script"; done
# vm-startup.sh is a Terraform template: render it with dummy values ($$ -> $) and parse it.
check "rendered vm-startup.sh parses" "sed -e 's/\\\$\\\$/\$/g' -e 's/\\\${[A-Z_]*}/X/g' vm/vm-startup.sh | bash -n"

if command -v docker >/dev/null 2>&1; then
  tmp=$(mktemp -d); : > "$tmp/app.env"; printf 'REGISTRY=r\nTAG=t\nDOMAIN=example.com\n' > "$tmp/.env"
  sed "s#/data/app.env#$tmp/app.env#" vm/docker-compose.prod.yml > "$tmp/compose.yml"
  check "docker compose config" "docker compose --env-file $tmp/.env -f $tmp/compose.yml config -q"
  check "caddy validate" "docker run --rm -e DOMAIN=example.com -v $PWD/vm/Caddyfile:/etc/caddy/Caddyfile:ro caddy:2 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile"
  rm -rf "$tmp"
fi

# Policies.
check "no 'latest' image tag in compose" "! grep -n ':latest\|TAG:-latest' vm/docker-compose.prod.yml"
check "prevent_destroy on VM, disk, IP, buckets, registry" "[ \$(grep -c 'prevent_destroy = true' terraform/modules/vm/main.tf terraform/modules/storage/main.tf terraform/modules/registry/main.tf | awk -F: '{s+=\$2} END {print s}') -ge 6 ]"
check "startup keeps the deployed TAG" "grep -q 'current_tag:-' vm/vm-startup.sh"
check "Caddy config mounted as a directory" "grep -q '/data/caddy/conf:/etc/caddy:ro' vm/docker-compose.prod.yml"
check "no secret values in prod.tfvars" "! grep -niE '^(.*(pass|secret|token|api_key)[a-z_]*)[[:space:]]*=' terraform/environments/prod/prod.tfvars"
check "no secret versions in Terraform" "! grep -rnE 'resource +\"google_secret_manager_secret_version' terraform --include=*.tf"

exit $fail
