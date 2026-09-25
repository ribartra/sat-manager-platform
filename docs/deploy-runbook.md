# Deploy runbook + limpieza local (imágenes / Git LFS)

Referencia operativa para desplegar a producción y para recuperar en local lo que se liberó
(imágenes Docker y snapshots de Git LFS). **Producción no se ve afectada por la limpieza local**:
las imágenes viven en Google **Artifact Registry** y el `dev.db` en Git LFS remoto.

## Producción (satsol.org)

- VM: `sat-vm` (zona `us-east1-b`, proyecto `sat-sol-gsc`), acceso:
  `gcloud compute ssh sat-vm --zone=us-east1-b --project=sat-sol-gsc --tunnel-through-iap`
- Compose: proyecto **`sat-platform`**, config `/data/stack/docker-compose.yml`, env `/data/stack/.env`
  (claves `REGISTRY`, `TAG`, `DOMAIN`; secretos aparte). Volúmenes: `/data/db:/db` (SQLite),
  `/data/uploads:/app/public/uploads` (imágenes; también GCS `sat-sol-gsc-sat-data`).
- Registry: `us-central1-docker.pkg.dev/sat-sol-gsc/sat-images/{web,ingest}:<TAG>`.
- **TAG en producción ahora: `ws-20260925-analytics`.**

### Build + push + deploy (una imagen nueva)
```bash
TAG=ws-YYYYMMDD-<desc>
REG=us-central1-docker.pkg.dev/sat-sol-gsc/sat-images
docker build -t "$REG/web:$TAG" .            # web (Next.js). Solo cambia web salvo que toques ingest_service/
docker push "$REG/web:$TAG"
# ingest solo si cambió; si no, re-tag de la imagen vigente para mantener consistencia del TAG único:
docker tag  "$REG/ingest:<TAG_ACTUAL>" "$REG/ingest:$TAG" && docker push "$REG/ingest:$TAG"
# en la VM:
gcloud compute ssh sat-vm --zone=us-east1-b --project=sat-sol-gsc --tunnel-through-iap --command='
  sudo cp /data/stack/.env /data/stack/.env.bak-'"$TAG"'
  sudo sed -i "s/^TAG=.*/TAG='"$TAG"'/" /data/stack/.env
  cd /data/stack && sudo docker compose -p sat-platform --env-file /data/stack/.env up -d web'
# verificar: curl -s https://satsol.org/api/health  → {"status":"ok","db":"up"}
```
Rollback: restaurar el TAG anterior en `/data/stack/.env` (hay backup `.env.bak-<tag>`) y `up -d web`.

## Limpieza local realizada (2026-09-25)

Para recuperar disco en la workstation se liberó:
- **Docker build cache** (`docker builder prune -af`) — ~17 GB.
- **Imágenes locales `web`/`ingest`** de todos los tags — **eliminadas por completo** (~15 GB).
  Producción NO se afecta: corre desde el registry. Ver "Re-descargar" abajo.
- **Cache Git LFS** (`.git/lfs/objects`): podado a las **2 últimas snapshots de `dev.db`**
  (1.6 GB → 246 MB). El resto de versiones siguen en el LFS remoto.

### Re-descargar las imágenes desde Artifact Registry (cuando se necesiten en local)
```bash
gcloud auth login                                   # si el token expiró
gcloud auth configure-docker us-central1-docker.pkg.dev
REG=us-central1-docker.pkg.dev/sat-sol-gsc/sat-images
docker pull "$REG/web:ws-20260925-analytics"
docker pull "$REG/ingest:ws-20260925-analytics"
# listar tags disponibles:
gcloud artifacts docker images list "$REG/web" --include-tags
```
(Normalmente no hace falta re-descargar para desplegar: se hace `docker build` fresco desde el repo.)

### Restaurar snapshots de `dev.db` (Git LFS) en local
```bash
git lfs fetch --all      # trae todas las versiones del remoto
git lfs pull             # materializa el dev.db del working tree
# o una versión puntual: git lfs fetch origin <commit>
```

## Notas
- El working tree `dev.db` (128 MB) queda intacto tras la poda LFS; solo se borró el cache de
  versiones antiguas ya presentes en remoto.
- Este repo versiona `dev.db` vía Git LFS (privado). WAL/SHM se ignoran.
