#!/usr/bin/env bash
# Build and push the web + ingest images to Artifact Registry.
# Usage:
#   REGION=us-central1 PROJECT=my-project REPO=sat-images TAG=$(git rev-parse --short HEAD) \
#     deploy/build-and-push.sh
set -euo pipefail

REGION="${REGION:?set REGION, e.g. us-central1}"
PROJECT="${PROJECT:?set PROJECT (GCP project id)}"
REPO="${REPO:-sat-images}"
TAG="${TAG:-latest}"

REGISTRY="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

echo ">> building web -> ${REGISTRY}/web:${TAG}"
docker build -f "${ROOT}/Dockerfile" -t "${REGISTRY}/web:${TAG}" -t "${REGISTRY}/web:latest" "${ROOT}"

echo ">> building ingest -> ${REGISTRY}/ingest:${TAG}"
docker build -f "${ROOT}/ingest_service/Dockerfile" -t "${REGISTRY}/ingest:${TAG}" -t "${REGISTRY}/ingest:latest" "${ROOT}"

echo ">> pushing"
docker push "${REGISTRY}/web:${TAG}";    docker push "${REGISTRY}/web:latest"
docker push "${REGISTRY}/ingest:${TAG}"; docker push "${REGISTRY}/ingest:latest"

echo ">> done. images:"
echo "   ${REGISTRY}/web:${TAG}"
echo "   ${REGISTRY}/ingest:${TAG}"
