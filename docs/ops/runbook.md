# Runbook de operación — satsol.org

Referencia para desplegar, revertir, restaurar backups y atender alertas. Sustituye al
`docs/deploy-runbook.md` retirado en 26c950c.

## Producción

| Qué | Dónde |
|---|---|
| VM | `sat-vm`, zona `us-east1-b`, proyecto `sat-sol-gsc` (e2-medium, disco `/data`) |
| Acceso | `CLOUDSDK_CORE_ACCOUNT=admin@nordmetric.com gcloud compute ssh sat-vm --zone us-east1-b --project sat-sol-gsc` |
| Stack | compose `sat-platform`, `/data/stack/docker-compose.yml`, `/data/stack/.env` (`REGISTRY`, `TAG`, `DOMAIN`), secretos en `/data/app.env` |
| Datos | `/data/db/dev.db` (SQLite WAL), `/data/uploads`, `/data/private`; Caddy en `/data/caddy` |
| Imágenes | `us-central1-docker.pkg.dev/sat-sol-gsc/sat-images/{web,ingest}:<TAG>` |
| Backups | `gs://sat-sol-gsc-sat-data/backups/dev-*` (cada 6 h, **30 días** por regla de lifecycle; las copias manuales `pre-*` no caducan) y `gs://sat-sol-gsc-backups-offsite/` (us-west1, diario, 190 días; `db/legacy/` = un backup por día anterior al 02-10) |

## Ventana de mantenimiento

**Propuesta, pendiente de acordar con la academia:** lunes a jueves de 22:00 a 23:00 (hora de la
academia), fuera del horario de clases y de los exámenes asignados. Un despliegue normal corta
unos segundos y Caddy retiene las peticiones hasta 30 s, así que el alumno ve una página lenta,
no un error. Los despliegues con migración de esquema van **siempre** en la ventana.

## Desplegar

```bash
TAG=ws-$(date +%Y%m%d)-<desc>
REG=us-central1-docker.pkg.dev/sat-sol-gsc/sat-images
docker build -t "$REG/web:$TAG" . && docker push "$REG/web:$TAG"
# ingest solo si cambió ingest_service/; si no, re-etiquetar la imagen vigente:
gcloud artifacts docker tags add "$REG/ingest:<TAG_ACTUAL>" "$REG/ingest:$TAG"
# en la VM (backup .env + DB, pull, up, espera health, rollback automático si falla):
gcloud compute ssh sat-vm --zone us-east1-b --project sat-sol-gsc --command "sudo /data/stack/deploy.sh $TAG"
curl -s https://satsol.org/api/health          # {"status":"ok","db":"up"}
```

`deploy/deploy.sh`:

1. Si el disco pasa del 80 %, poda imágenes.
2. Guarda `.env.bak-<fecha>-pre-<TAG>` y `/data/db/backups/devdb-pre-<TAG>-<fecha>.bak` (con `integrity_check`; se conservan las 2 últimas).
3. Cambia `TAG`, hace pull y `up -d`.
4. Espera a que el healthcheck de `web` pase a `healthy` (240 s); si no llega, vuelve solo al TAG anterior.

El entrypoint del contenedor **no arranca si `prisma migrate deploy` falla**, de modo que una
migración rota termina en rollback automático en lugar de servir código nuevo sobre un esquema
viejo. Después de la migración corre `scripts/backfill-fpt-snapshots.mjs` (idempotente).

Archivos de configuración en la VM:

- **Caddyfile:** está montado como archivo único. Se edita **en el mismo archivo** (`cat > /data/caddy/Caddyfile`), sin moverlo ni reemplazarlo, se envía en base64 y se comprueba con sha256. Después: `docker exec sat-platform-caddy-1 caddy validate --config /etc/caddy/Caddyfile && docker exec sat-platform-caddy-1 caddy reload --config /etc/caddy/Caddyfile`.
- **`deploy.sh` y `sat-db-backup.sh`:** viven en el bucket (`stack/`). Tras cambiarlos, súbelos con `gsutil cp deploy/<archivo> gs://sat-sol-gsc-sat-data/stack/` y cópialos a la VM.

## Revertir

```bash
sudo /data/stack/deploy.sh <TAG_ANTERIOR>      # mismo flujo, en sentido inverso
```

Si la versión nueva aplicó una migración que la anterior no soporta, restaura la base desde
`/data/db/backups/devdb-pre-<TAG>-*.bak` (ver Restaurar).

## Backups

- `/usr/local/bin/sat-db-backup.sh` (fuente: `deploy/sat-db-backup.sh`) corre por cron cada 6 h.
  - En cada ejecución: `sqlite3 .backup` + `integrity_check` → `gs://sat-sol-gsc-sat-data/backups/dev-<fecha>.db`.
  - En la ejecución de las 00 UTC: además, la base en gzip → `gs://sat-sol-gsc-backups-offsite/db/`, y `/data/uploads` y `/data/private` con `gcloud storage rsync --recursive --no-clobber` (compara listados y no sobrescribe) → `files/` (otra región).
  - La VM puede crear y leer objetos en ese bucket, pero no borrarlos ni sobrescribirlos. La base se retiene 190 días.
- Si todo va bien, escribe `/data/db/backup-status.json`, que la app publica en `/api/health/backup`.
- Log: `/var/log/sat-db-backup.log`. Para forzar una copia off-site: `sudo FORCE_OFFSITE=1 /usr/local/bin/sat-db-backup.sh`.

## Restaurar

Ensayo verificado el 2026-10-02; el resultado está en la sección final.

```bash
# 1) elegir copia (on-site, o off-site si el proyecto/bucket principal no está disponible)
gsutil ls gs://sat-sol-gsc-sat-data/backups/ | tail -3
gsutil ls gs://sat-sol-gsc-backups-offsite/db/ | tail -3
mkdir -p /tmp/restore && cd /tmp/restore
gsutil cp gs://sat-sol-gsc-backups-offsite/db/dev-<fecha>.db.gz . && gunzip dev-<fecha>.db.gz
sqlite3 dev-<fecha>.db "PRAGMA integrity_check;"          # ok
# 2) parar la app, guardar la base actual y reemplazar (borrando -wal/-shm viejos)
cd /data/stack && sudo docker compose -p sat-platform --env-file .env stop web ingest-service
sudo sqlite3 /data/db/dev.db ".backup /data/db/backups/devdb-before-restore-$(date +%F).bak"
sudo rm -f /data/db/dev.db-wal /data/db/dev.db-shm
sudo cp /tmp/restore/dev-<fecha>.db /data/db/dev.db
sudo docker compose -p sat-platform --env-file .env up -d web ingest-service
curl -s https://satsol.org/api/health
# 3) archivos, si se perdieron
sudo gsutil -m cp -n -r gs://sat-sol-gsc-backups-offsite/files/uploads /data/
sudo gsutil -m cp -n -r gs://sat-sol-gsc-backups-offsite/files/private /data/
```

En local: `npm run db:backup` / `BACKUP_FILE=… npm run db:restore`. Usan la API de backup de
SQLite, así que son seguros con WAL. **Detén el servidor de desarrollo antes de restaurar.**

## Alertas (Cloud Monitoring, email a admin@nordmetric.com)

| Alerta | Señal | Primer paso |
|---|---|---|
| Web caída | uptime check `https://satsol.org/api/health` falla desde 2 regiones durante 5 min | `docker ps`, `docker logs --tail 100 sat-platform-web-1`, `df -h /` |
| Backup viejo | uptime check `/api/health/backup` devuelve 503 (último backup bueno hace más de 13 h) | `tail -50 /var/log/sat-db-backup.log`, ejecutar el script a mano |
| Ráfaga de errores 5xx | métrica de log `sat_http_5xx` (líneas `http.request` con `status>=500`) > 5 en 5 min | Logs Explorer: `jsonPayload.event="http.request" jsonPayload.status>=500`, seguir por `requestId` |

Cada respuesta lleva `x-request-id`. Las líneas de log JSON (`http.request`, `error.caught`,
`attempt.*`) llevan el mismo id, y `error.caught` también queda en el AuditLog
(`ERROR_CAUGHT`).

## Riesgos aceptados

- Una sola VM: si la VM o la zona caen, el servicio se cae hasta recrearla. Para volver: recrear la VM con Terraform (`terraform/`), restaurar la base y los archivos desde el bucket off-site y desplegar el último TAG. RTO estimado: 1–2 h.
- Cada despliegue corta unos segundos, amortiguados por la espera de Caddy.

## Ensayo de restore

**2026-10-02:** OK.

**Copia usada:** la última off-site, `gs://sat-sol-gsc-backups-offsite/db/dev-2026-10-02-1843.db.gz`, que es la del backup forzado tras crear el bucket.

**Pasos**
1. Descargarla y descomprimirla.
2. Comprobar la copia: `integrity_check` = ok, 2 597 preguntas, 6 usuarios.
3. Arrancar la imagen de producción `web:ws-20261002-rnf-closure` sobre esa copia.

**Resultado**
- El entrypoint aplicó la migración pendiente (`20261002_history_restrict_consent_fpt_snapshot`) y el backfill de snapshots (2/2).
- `/api/health` respondió 200 `{"status":"ok","db":"up"}` y `/login` 200.
- Antes, la misma migración se probó sobre la copia on-site `dev-2026-10-02-1843.db`: conteos de filas idénticos antes y después en 12 tablas, 0 violaciones de FK y 0 intentos sin snapshot.

**Pendiente:** repetir el ensayo cada trimestre y anotar aquí la fecha.

## Logs

El Ops Agent (`deploy/ops-agent.yaml` → `/etc/google-cloud-ops-agent/config.yaml`) envía los logs
de los contenedores (`/data/docker/containers/*/*-json.log`) al log `sat_docker`, con el
`severity` de la app. Consultas útiles:

- `logName="projects/sat-sol-gsc/logs/sat_docker" jsonPayload.event="http.request" jsonPayload.status>=500`
- `jsonPayload.requestId="<id>"`: una petición de punta a punta.
- `jsonPayload.event="attempt.submit"`: envíos de Practice y FPT.
