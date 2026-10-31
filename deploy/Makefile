# SAT platform deployment (GCP, one VM). Run from deploy/:  make <target>
# Requires gcloud logged in with access to the project (e.g. CLOUDSDK_CORE_ACCOUNT=admin@nordmetric.com).

# Terraform authenticates as the active gcloud account (same identity as the scripts), not as the
# application-default credentials, which may belong to another account.
TOKEN   = GOOGLE_OAUTH_ACCESS_TOKEN=$$(gcloud auth print-access-token)
TF      = $(TOKEN) terraform -chdir=terraform/environments/prod
TFVARS  := -var-file=prod.tfvars

.PHONY: help preflight bootstrap init plan apply build release rollback current sync-stack pull-db db-compare db-patch-status secrets ssh health

help: ## list targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-12s %s\n", $$1, $$2}'

preflight: ## offline checks: terraform fmt/validate, scripts, compose, Caddy, policies
	scripts/preflight.sh

bootstrap: ## once: create the versioned Terraform state bucket
	$(TOKEN) terraform -chdir=terraform/bootstrap init -input=false
	$(TOKEN) terraform -chdir=terraform/bootstrap apply -var-file=prod.tfvars

init: ## terraform init (GCS backend)
	$(TF) init -input=false

plan: init ## show infrastructure changes (writes terraform/environments/prod/prod.plan)
	$(TF) plan $(TFVARS) -out=prod.plan
	$(TF) show -no-color prod.plan | grep -E "^Plan:|will be (destroyed|replaced)|must be replaced" || true

apply: ## apply the saved plan (run `make plan` first and read it)
	$(TF) apply prod.plan

build: ## build + push web/ingest in Cloud Build; prints the TAG (TAG=... to choose it)
	scripts/build-and-push.sh $(TAG)

release: ## deploy an already-built image: make release TAG=<tag>
	@test -n "$(TAG)" || (echo "usage: make release TAG=<tag>"; exit 2)
	scripts/release.sh $(TAG)

rollback: ## back to the TAG that ran before the last release
	scripts/release.sh --rollback

current: ## TAG running in production
	@scripts/release.sh --current

sync-stack: ## install deploy/vm/* on the VM and apply it (after make apply)
	scripts/sync-stack.sh

pull-db: ## replace local dev.db with a fresh production copy (stop the dev server first)
	scripts/pull-db-from-prod.sh

db-compare: ## compare local dev.db with a fresh production copy (replaces nothing)
	scripts/compare-with-prod.sh

db-patch-status: ## data patches (prisma/data-patches) applied / pending in local dev.db
	cd .. && npm run -s db:patch:status

secrets: ## load secret values into Secret Manager (only missing ones unless FORCE=1)
	scripts/load-secrets.sh

ssh: ## shell on the VM (IAP)
	. scripts/env.sh && gcloud compute ssh "$$VM" --zone "$$ZONE" --project "$$PROJECT" --tunnel-through-iap

health: ## public health endpoints
	. scripts/env.sh && curl -fsS "https://$$DOMAIN/api/health" && echo && curl -fsS "https://$$DOMAIN/api/health/backup" && echo
