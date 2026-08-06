# Despliegue en GCP — arquitectura eficiente en costes

Guía y runbook para desplegar la plataforma SAT en Google Cloud con **Terraform**.
La arquitectura está optimizada para **coste bajo** respetando cómo está construido
el producto hoy (SQLite en archivo, Node runtime obligatorio, ingest interno).

## Por qué esta arquitectura (el pivote: SQLite)

- La web **requiere Node runtime, no Edge** (`better-sqlite3` + Prisma adapter; no hay
  `middleware.ts` a propósito).
- La BD es un **archivo SQLite `dev.db`** con escrituras concurrentes → **incompatible
  con serverless multi-instancia / scale-to-zero** salvo migrar a Postgres.
- El `ingest_service` (FastAPI) es **pesado y CPU-bound** (OpenCV, Pillow, pdfplumber)
  y **debe ser interno** (nunca público).
- Forzar Cloud Run puro obligaría a migrar SQLite→Cloud SQL (~$9/mo **siempre
  encendido**) y reescribir storage: **más caro y más trabajo** para el volumen real.

Conclusión: **una sola VM pequeña** que corre el `docker-compose` (web + ingest + Caddy),
con la BD y los uploads en un **disco persistente**, secretos en **Secret Manager**,
imágenes en **Artifact Registry** y **backups a GCS**. HTTPS lo da **Caddy** en la
propia VM (sin Load Balancer → se ahorran ~$18/mo).

```
                 Internet (HTTPS)
                      │
              ┌───────▼─────────────────────┐  GCE e2-small (Debian 12)
              │  Caddy :80/:443 (TLS auto)   │  docker-compose.prod.yml
              │        │ reverse_proxy       │
              │  web :3000 (interno)         │  next start + prisma migrate deploy
              │        │ INTERNAL_INGEST_TOKEN│
              │  ingest :8000 (SOLO interno) │  FastAPI (no publicado)
              │                              │
              │  Persistent Disk /data       │
              │   /data/db  dev.db(+wal/shm) │
              │   /data/uploads  public/...  │
              │   /data/private  staging     │
              └───┬───────────────┬──────────┘
                  │               │
        ┌─────────▼──┐     ┌──────▼───────────┐
        │ GCS bucket │     │ Secret Manager    │
        │ config +   │     │ auth-secret,      │
        │ seed +     │     │ secret-encryption,│
        │ backups    │     │ internal-token,   │
        └────────────┘     │ mistral, email    │
                           └───────────────────┘
   Externos: Mistral OCR API · Brevo SMTP · Desmos (navegador)
```

## Coste estimado (mensual, us-central1)

| Recurso | Config | Aprox. |
|---|---|---|
| GCE `e2-small` (2 GB) 24/7 | cómputo | ~$13 |
| Persistent Disk balanced | 20 GB | ~$2 |
| Cloud Storage | ~2 GB + backups | ~$0.10 |
| Secret Manager | 5 secretos | ~$0.20 |
| Egress | tráfico bajo | ~$0–1 |
| **Total GCP** | | **~$15–16/mo** |

Mistral OCR y Brevo SMTP son externos y se pagan aparte. Para bajar más: apagar la VM
fuera de horario (SQLite no exige alta disponibilidad) reduce el cómputo proporcional.

## Componentes que crea Terraform (`terraform/`)

- **Artifact Registry** (`<prefix>-images`) para las imágenes `web` e `ingest`.
- **GCS bucket** (`<project>-<prefix>-data`) versionado: config del stack, seed y backups.
- **5 secretos** en Secret Manager (valores desde `terraform.tfvars`, marcados `sensitive`).
- **Service Account** de la VM con IAM mínimo: `secretAccessor`, `storage.objectAdmin`
  (solo ese bucket), `artifactregistry.reader`, `logging.logWriter`, `monitoring.metricWriter`.
- **IP estática**, **firewall** (80/443 público; 22 solo desde el rango IAP).
- **Persistent Disk** de datos + **VM e2-small** con `startup-script` que monta el disco,
  instala Docker, renderiza `/data/app.env` desde Secret Manager y levanta el stack.

## Requisitos previos

- `gcloud` autenticado y proyecto con facturación activa.
- `terraform >= 1.6` y `docker` local (o Cloud Build) para construir imágenes.
- Un dominio cuyo A record puedas apuntar a la IP estática.

## Runbook

```bash
# 1) Infra
cd terraform
cp terraform.tfvars.example terraform.tfvars   # y complétalo (secretos: openssl rand -base64 48)
terraform init
terraform apply

# 2) Imágenes (usa los outputs de terraform)
cd ..
REGION=us-central1 PROJECT=<project_id> REPO=sat-images TAG=$(git rev-parse --short HEAD) \
  deploy/build-and-push.sh
#   luego, si fijaste image_tag=<ese tag> en tfvars, re-aplica o recrea la VM.
#   (con image_tag="latest" basta con reiniciar el stack en la VM: docker compose pull && up -d)

# 3) (opcional) Sembrar datos actuales al bucket ANTES del primer arranque
gsutil cp dev.db                gs://<bucket>/seed/dev.db
gsutil -m rsync -r public/uploads gs://<bucket>/seed/uploads
gsutil -m rsync -r .private        gs://<bucket>/seed/private

# 4) DNS: A record del dominio -> output static_ip. Caddy emite el cert solo.

# 5) Acceso a la VM
gcloud compute ssh sat-vm --zone us-central1-a --tunnel-through-iap
```

`dev.db` se versiona en el repo vía Git LFS, pero **la BD viva de producción es
`/data/db/dev.db` en el disco de la VM**. El `seed/dev.db` del bucket solo se usa en el
primer arranque (si el disco está vacío).

## Operación

- **Logs**: `docker compose -f /data/stack/docker-compose.yml logs -f web ingest-service`
- **Actualizar versión**: `deploy/build-and-push.sh` con nuevo TAG → en la VM
  `cd /data/stack && docker compose pull && docker compose up -d`.
- **Migraciones**: se aplican solas al arrancar `web` (`prisma migrate deploy` en el
  entrypoint), idempotente.
- **Backups**: cron diario (`/etc/cron.daily/sat-db-backup`) hace `sqlite3 .backup` y sube
  a `gs://<bucket>/backups/`. Restaurar: `gsutil cp gs://<bucket>/backups/<f>.db /data/db/dev.db`
  (con el stack detenido) y `docker compose up -d`.
- **Snapshots de disco** (opcional, para punto de retorno completo): `gcloud compute
  disks snapshot sat-data --zone <zone>` o una política de snapshots programada.

## Seguridad

- `ingest-service` **no** publica puertos al host: solo accesible por `web` en la red de
  compose, autenticado con `INTERNAL_INGEST_TOKEN` (coherente con el README).
- Secretos nunca en texto plano en el repo: van a Secret Manager y se renderizan a
  `/data/app.env` (permisos `600`) en la VM. La API key de Mistral sigue cifrándose en la
  BD (AES-256-GCM) como hoy.
- SSH solo por IAP (sin IP pública de SSH abierta a Internet).
- Regenera `AUTH_SECRET`, `SECRET_ENCRYPTION_KEY` e `INTERNAL_INGEST_TOKEN` para prod
  (no reutilizar los de desarrollo).

## Fase 2 (opcional) — uploads primarios en GCS

Hoy los blobs viven en el disco persistente (same-origin, sin fricción con la CSP). El
código ya trae un **adapter de storage** (`lib/object-storage.ts`) con driver `gcs`:

1. `npm i @google-cloud/storage` en la imagen web.
2. Env: `STORAGE_DRIVER=gcs`, `GCS_BUCKET=<bucket>`, `GCS_PUBLIC_BASE_URL=https://storage.googleapis.com/<bucket>`.
3. **CSP**: añade el host de GCS a `img-src` en `next.config.ts` **o** sirve los bytes por
   un proxy same-origin. Con el default `img-src 'self'`, una URL de GCS se bloquea.
4. Migrar las imágenes de ingesta (`lib/ingest-promotion.ts`, `public/uploads/questions`) al
   adapter es trabajo adicional y está cubierto por los QA gates: hacerlo con cuidado.

Ver también `sugerencias-gcp-bucket.md`.

## Alternativa (escala futura) — Cloud Run + Postgres

Si en el futuro hay varios tenants/tráfico real: migrar `dev.db` → Cloud SQL Postgres (o
Turso/libSQL para seguir en SQLite gestionado), **web** a Cloud Run (`min-instances=0`) e
**ingest** como Cloud Run Job. Escala a cero y separa cómputo, pero Cloud SQL más barato
~$9/mo siempre encendido y hay que cambiar el `provider` de Prisma. Hoy es **más caro y
más trabajo** que la VM única.
