#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# push-db-to-cloud.sh — Empuja una BD SQLite local (opcionalmente + assets) a la
# VM de producción, SOBREESCRIBIENDO la BD de la nube.
#
# No existe un mecanismo "un clic": el seed de la VM (deploy/vm-startup.sh) solo
# siembra si /data/db/dev.db NO existe. Este script hace el swap manual seguro:
#
#   1. Prepara un snapshot saneado local (scripts/prep-push-snapshot.mjs):
#      consolida el WAL, purga AppSetting cifrados (la SECRET_ENCRYPTION_KEY de
#      dev ≠ la de prod), y opcionalmente inserta el admin de prod / deshabilita
#      o rota credenciales dev débiles.
#   2. Sube el snapshot a gs://$BUCKET/seed/dev.db.
#   3. En la VM: respalda la BD de prod (a disco y a GCS), PARA web+ingest (para
#      soltar el lock WAL de SQLite), intercambia el archivo, borra -wal/-shm,
#      y arranca (el entrypoint corre `prisma migrate deploy`).
#   4. Con --with-assets: empaqueta y sincroniza .private/uploads/ingest y
#      public/uploads (necesarios si la BD referencia imágenes de ingesta).
#   5. Verifica health y, si hay credenciales de admin, el login.
#
# ⚠️  DESTRUCTIVO: sobreescribe la BD de producción. Siempre respalda antes (lo
#     hace el paso 3). Pide confirmación salvo --yes.
#
# Uso:
#   deploy/push-db-to-cloud.sh [--with-assets] [--yes]
#
# Config por entorno (con defaults de este despliegue):
#   PROJECT, BUCKET, ZONE, VM, LOCAL_DB, DOMAIN
# Saneo (se pasan a prep-push-snapshot.mjs):
#   PROD_ADMIN_EMAIL, PROD_ADMIN_PASSWORD, DISABLE_EMAILS, ROTATE_EMAILS,
#   PURGE_ENCRYPTED, CONTENT_FILTER (=ps-fpt-only para solo PS/FPT publicados)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT="${PROJECT:-sat-sol-gsc}"
BUCKET="${BUCKET:-sat-sol-gsc-sat-data}"
ZONE="${ZONE:-us-east1-b}"
VM="${VM:-sat-vm}"
LOCAL_DB="${LOCAL_DB:-./dev.db}"
DOMAIN="${DOMAIN:-satsol.org}"

# Rutas en la VM (fijas por el compose de prod).
COMPOSE_DIR="/data/stack"
ENV_FILE="/data/stack/.env"
REMOTE_DB="/data/db/dev.db"
REMOTE_INGEST="/data/private/uploads/ingest"
REMOTE_UPLOADS="/data/uploads"
LOCAL_INGEST=".private/uploads/ingest"
LOCAL_UPLOADS="public/uploads"

WITH_ASSETS=0
ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    --with-assets) WITH_ASSETS=1 ;;
    --yes|-y)      ASSUME_YES=1 ;;
    *) echo "Argumento desconocido: $arg" >&2; exit 2 ;;
  esac
done

log() { echo "[$(date +%H:%M:%S)] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }
SSH() { gcloud compute ssh "$VM" --zone "$ZONE" --project "$PROJECT" --tunnel-through-iap --command "$1"; }

# ── Preflight ────────────────────────────────────────────────────────────────
command -v gcloud >/dev/null || die "gcloud no está instalado"
gcloud compute instances describe "$VM" --zone "$ZONE" --project "$PROJECT" >/dev/null 2>&1 \
  || die "No se puede describir la VM $VM (¿gcloud auth login? ¿zona/proyecto?)"
[ -f "$LOCAL_DB" ] || die "No existe LOCAL_DB=$LOCAL_DB"
[ -x node_modules/.bin/tsx ] || command -v node >/dev/null || die "Falta node"

echo "──────────────────────────────────────────────────────────────"
echo "  Empujar BD local → PRODUCCIÓN (DESTRUCTIVO)"
echo "  LOCAL_DB : $LOCAL_DB"
echo "  Destino  : gs://$BUCKET/seed/dev.db  →  $VM:$REMOTE_DB ($ZONE)"
echo "  Assets   : $([ "$WITH_ASSETS" = 1 ] && echo "SÍ (.private + uploads)" || echo "no (--with-assets para incluirlos)")"
echo "  Health   : https://$DOMAIN/api/health"
echo "──────────────────────────────────────────────────────────────"
if [ "$ASSUME_YES" != 1 ]; then
  read -r -p "Esto SOBREESCRIBE la BD de producción. ¿Continuar? (escribe 'si'): " ans
  [ "$ans" = "si" ] || die "Cancelado."
fi

WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
SNAP="$WORK/dev.db"

# ── 1) Snapshot saneado ──────────────────────────────────────────────────────
log "Preparando snapshot saneado..."
SRC="$LOCAL_DB" OUT="$SNAP" node scripts/prep-push-snapshot.mjs | tee "$WORK/prep.log"
[ -f "$SNAP" ] || die "El preparador no generó $SNAP"

# Guarda credenciales impresas por el preparador (líneas 'CREDENTIAL <email> <pw>').
if grep -q '^CREDENTIAL ' "$WORK/prep.log"; then
  mkdir -p .secrets
  {
    echo "# Sat Sol — credenciales de PRODUCCIÓN (generado por push-db-to-cloud.sh, gitignored)."
    echo "# $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    grep '^CREDENTIAL ' "$WORK/prep.log" | awk '{print $2" / "$3}'
  } > .secrets/prod-credentials.txt
  chmod 600 .secrets/prod-credentials.txt
  log "Credenciales guardadas en .secrets/prod-credentials.txt"
fi

# ── 2) Subir snapshot a GCS ──────────────────────────────────────────────────
log "Subiendo snapshot a gs://$BUCKET/seed/dev.db ..."
gcloud storage cp "$SNAP" "gs://$BUCKET/seed/dev.db"

# ── 3) (opcional) empaquetar + subir assets ──────────────────────────────────
if [ "$WITH_ASSETS" = 1 ]; then
  if [ -d "$LOCAL_INGEST" ]; then
    log "Empaquetando $LOCAL_INGEST ..."
    tar -I 'gzip -1' -cf "$WORK/ingest.tgz" -C "$LOCAL_INGEST" .
    gcloud storage cp "$WORK/ingest.tgz" "gs://$BUCKET/seed/ingest.tgz"
  else
    log "AVISO: $LOCAL_INGEST no existe; se omite."
  fi
  if [ -d "$LOCAL_UPLOADS" ]; then
    log "Empaquetando $LOCAL_UPLOADS ..."
    tar -I 'gzip -1' -cf "$WORK/uploads.tgz" -C "$LOCAL_UPLOADS" .
    gcloud storage cp "$WORK/uploads.tgz" "gs://$BUCKET/seed/uploads.tgz"
  else
    log "AVISO: $LOCAL_UPLOADS no existe; se omite."
  fi
fi

# ── 4) Swap en la VM ─────────────────────────────────────────────────────────
log "Swap en la VM (backup → stop → swap → [assets] → up)..."
SSH "
set -e
cd '$COMPOSE_DIR'
TS=\$(date +%Y%m%dT%H%M%S)
echo '  backup de la BD de prod...'
sudo sqlite3 '$REMOTE_DB' \".backup /data/backups-local/pre-push-\$TS.db\"
sudo gsutil -q cp /data/backups-local/pre-push-\$TS.db 'gs://$BUCKET/backups/pre-push-'\$TS'.db'
echo '  parando web + ingest...'
sudo docker compose --env-file '$ENV_FILE' stop web ingest-service
echo '  swap del dev.db...'
sudo gsutil -q cp 'gs://$BUCKET/seed/dev.db' '$REMOTE_DB'
sudo rm -f '$REMOTE_DB'-wal '$REMOTE_DB'-shm
if [ '$WITH_ASSETS' = 1 ]; then
  echo '  extrayendo assets...'
  sudo mkdir -p '$REMOTE_INGEST' '$REMOTE_UPLOADS'
  sudo gsutil -q stat 'gs://$BUCKET/seed/ingest.tgz'  && { sudo gsutil -q cp 'gs://$BUCKET/seed/ingest.tgz'  /tmp/ingest.tgz;  sudo tar xzf /tmp/ingest.tgz  -C '$REMOTE_INGEST';  sudo rm -f /tmp/ingest.tgz; } || true
  sudo gsutil -q stat 'gs://$BUCKET/seed/uploads.tgz' && { sudo gsutil -q cp 'gs://$BUCKET/seed/uploads.tgz' /tmp/uploads.tgz; sudo tar xzf /tmp/uploads.tgz -C '$REMOTE_UPLOADS'; sudo rm -f /tmp/uploads.tgz; } || true
fi
echo '  arrancando...'
sudo docker compose --env-file '$ENV_FILE' up -d
echo \"  nuevo dev.db: \$(sudo du -h '$REMOTE_DB' | cut -f1)\"
"

# ── 5) Verificación ──────────────────────────────────────────────────────────
log "Verificando health..."
for i in $(seq 1 12); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "https://$DOMAIN/api/health" || true)
  echo "  health intento $i: http=$code"
  [ "$code" = "200" ] && break
  sleep 10
done
[ "${code:-000}" = "200" ] || die "Health no llegó a 200; revisa 'docker compose logs web' en la VM."

if [ -n "${PROD_ADMIN_EMAIL:-}" ] && [ -n "${PROD_ADMIN_PASSWORD:-}" ]; then
  log "Verificando login de admin..."
  J="$(mktemp)"
  CSRF=$(curl -s -c "$J" --max-time 15 "https://$DOMAIN/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
  curl -s -o /dev/null -b "$J" -c "$J" --max-time 20 -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "csrfToken=$CSRF" --data-urlencode "email=$PROD_ADMIN_EMAIL" \
    --data-urlencode "password=$PROD_ADMIN_PASSWORD" --data-urlencode "callbackUrl=https://$DOMAIN/" \
    "https://$DOMAIN/api/auth/callback/credentials"
  ROLE=$(curl -s -b "$J" --max-time 15 "https://$DOMAIN/api/auth/session" | sed -n 's/.*"role":"\([^"]*\)".*/\1/p')
  rm -f "$J"
  echo "  admin login: ${ROLE:-SIN SESIÓN}"
fi

echo ""
log "✅ Push completo. https://$DOMAIN operativo con la BD nueva."
