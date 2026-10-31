#!/usr/bin/env bash
# Builds web + ingest in Cloud Build and pushes them to Artifact Registry with one immutable tag.
#   deploy/scripts/build-and-push.sh            # tag = <yyyymmdd>-<git short sha>[-dirty]
#   deploy/scripts/build-and-push.sh my-tag     # explicit tag
# The source is the WORKING TREE (minus .gcloudignore), so uncommitted changes are built: the tag
# then ends in -dirty. An existing tag is never overwritten (rollbacks rely on tags being fixed).
# Last line of stdout: the tag.
set -euo pipefail
. "$(dirname "$0")/env.sh"
cd "$REPO_ROOT"

sha=$(git rev-parse --short=7 HEAD)
dirty=""
git diff --quiet HEAD -- . ':!dev.db' 2>/dev/null || dirty="-dirty"
TAG="${1:-$(date -u +%Y%m%d)-${sha}${dirty}}"
[ "$TAG" != "latest" ] || die "never use latest: tags must be immutable"

for image in web ingest; do
  image_exists "$REGISTRY/$image:$TAG" && die "$REGISTRY/$image:$TAG already exists (pick another tag)"
done

log "building $TAG in Cloud Build ($REGISTRY)"
gcloud builds submit "$REPO_ROOT" \
  --project "$PROJECT" \
  --config "$DEPLOY_DIR/cloudbuild.yaml" \
  --substitutions "_REGISTRY=$REGISTRY,_TAG=$TAG,_REVISION=$(git rev-parse HEAD)${dirty}" \
  --service-account "projects/$PROJECT/serviceAccounts/$CLOUDBUILD_SA" >&2

for image in web ingest; do
  image_exists "$REGISTRY/$image:$TAG" || die "$image:$TAG missing after the build"
done
log "pushed $REGISTRY/{web,ingest}:$TAG"
echo "$TAG"
