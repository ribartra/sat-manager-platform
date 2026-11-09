#!/usr/bin/env bash
set -uo pipefail
profile=${1:-all}
failed=0
for tool in git node npm python3 docker; do
  if command -v "$tool" >/dev/null; then echo "OK $tool"; else echo "MISSING $tool: see docs/operacion-multiplataforma.md"; failed=1; fi
done
if [[ "$profile" != development ]]; then
  for tool in gcloud; do command -v "$tool" >/dev/null || { echo "MISSING $tool"; failed=1; }; done
fi
node -e 'if(Number(process.versions.node.split(".")[0])!==24)process.exit(1)' || { echo 'INCOMPATIBLE: Node 24 required'; failed=1; }
docker info >/dev/null 2>&1 || { echo 'Docker daemon unavailable'; failed=1; }
docker compose version >/dev/null 2>&1 || { echo 'Compose unavailable'; failed=1; }
exit "$failed"
