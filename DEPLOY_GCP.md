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

Conclusión: **una sola VM** (`e2-medium` por defecto) que corre el `docker-compose`
(web + ingest + Caddy), con la BD y los uploads en un **disco persistente**, secretos en
**Secret Manager** (valores cargados fuera del estado de Terraform), imágenes en
**Artifact Registry** y **backups a GCS cada 6 h**. HTTPS lo da **Caddy** en la propia VM
(sin Load Balancer → se ahorran ~$18/mo). Observabilidad con **Ops Agent** + uptime check
contra `/api/health`.

> **Nota de dimensionamiento.** El default es `e2-medium` (4 GB) porque la ingesta corre
> pdfplumber/Pillow sobre archivos de hasta 256 MB y 2 GB puede provocar OOM. Para una
> **demo** con poco tráfico e ingesta ligera fuera de horario puedes bajar a `e2-small`
> (`machine_type`) y `data_disk_gb=20`; ambos son variables de Terraform.

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

**Escenario recomendado (producción):**

| Recurso | Config | Aprox. |
|---|---|---|
| GCE `e2-medium` (4 GB) 24/7 | cómputo | ~$24.5 |
| IPv4 externa estática | asociada a la VM | ~$3.65 |
| Persistent Disk balanced | 50 GB | ~$5 |
| Cloud Storage | ~2 GB + backups 6 h | ~$0.20 |
| Secret Manager | 5 secretos | ~$0.20 |
| Egress | tráfico bajo | ~$0–3 |
| **Total GCP** | | **~$35–42/mo** |

**Escenario mínimo (demo, `e2-small` + 20 GB):**

| Recurso | Config | Aprox. |
|---|---|---|
| GCE `e2-small` (2 GB) 24/7 | cómputo | ~$12.2 |
| IPv4 externa estática | asociada a la VM | ~$3.65 |
| Persistent Disk balanced | 20 GB | ~$2 |
| GCS + secretos + egress | tráfico bajo | ~$2–7 |
| **Total GCP** | | **~$20–25/mo** |

La IPv4 externa se factura (~$0.005/h) **aunque la VM esté detenida** mientras siga
reservada. Mistral OCR y Brevo SMTP son externos y se pagan aparte. Para bajar más: apagar
la VM fuera de horario (SQLite no exige alta disponibilidad) reduce el cómputo proporcional.
Evitar Load Balancer ya ahorra la primera regla de reenvío (~$18/mo).

## Componentes que crea Terraform (`terraform/`)

- **Artifact Registry** (`<prefix>-images`) para las imágenes `web` e `ingest`.
- **GCS bucket** (`<project>-<prefix>-data`) versionado: config del stack, seed y backups.
- **5 contenedores** de Secret Manager **vacíos** (los valores se cargan aparte con
  `deploy/load-secrets.sh`; nunca pasan por el estado de Terraform).
- **Service Account** de la VM con IAM mínimo: `secretAccessor`, `storage.objectAdmin`
  (solo ese bucket), `artifactregistry.reader`, `logging.logWriter`, `monitoring.metricWriter`.
- **IP estática**, **firewall** (80/443 público; 22 solo desde el rango IAP).
- **Persistent Disk** de datos + **VM `e2-medium`** (default) con `startup-script` que monta
  el disco, instala Docker (con `data-root` en `/data` y rotación de logs), instala el **Ops
  Agent**, renderiza `/data/app.env` desde Secret Manager y levanta el stack.

## Requisitos previos

- `gcloud` autenticado y proyecto con facturación activa.
- `terraform >= 1.6` y `docker` local (o Cloud Build) para construir imágenes.
- Un dominio cuyo A record puedas apuntar a la IP estática.

## Runbook

```bash
# 1) Infra (crea contenedores de secretos vacíos; NO pone valores en el estado)
cd terraform
cp terraform.tfvars.example terraform.tfvars   # sin secretos: solo project/domain/sizing
terraform init
terraform apply

# 2) Cargar los VALORES de los secretos fuera del estado de Terraform
cd ..
PROJECT=<project_id> PREFIX=sat deploy/load-secrets.sh
#   genera auth/encryption/ingest si no los pasas; idempotente (no re-genera
#   secret-encryption-key en re-ejecución). Pasa MISTRAL_API_KEY / EMAIL_PASS si aplica.

# 3) Imágenes con tag inmutable (usa los outputs de terraform)
TAG=$(git rev-parse --short HEAD)
REGION=us-central1 PROJECT=<project_id> REPO=sat-images TAG=$TAG deploy/build-and-push.sh
#   fija image_tag=$TAG en tfvars y re-aplica para clavar la versión (recomendado),
#   o con image_tag="latest": en la VM `cd /data/stack && docker compose pull && up -d`.

# 4) (opcional) Sembrar datos actuales al bucket ANTES del primer arranque
gsutil cp dev.db                gs://<bucket>/seed/dev.db
gsutil -m rsync -r public/uploads gs://<bucket>/seed/uploads
gsutil -m rsync -r .private        gs://<bucket>/seed/private

# 5) DNS: A record del dominio -> output static_ip. Caddy emite el cert solo.

# 6) Acceso a la VM
gcloud compute ssh sat-vm --zone us-central1-a --tunnel-through-iap
```

Si la VM arrancó **antes** de que existieran los valores de los secretos, el startup
espera hasta 10 min; tras cargarlos re-dispara el arranque:
`gcloud compute ssh sat-vm --tunnel-through-iap --command='sudo google_metadata_script_runner startup'`.

`dev.db` se versiona en el repo vía Git LFS, pero **la BD viva de producción es
`/data/db/dev.db` en el disco de la VM**. El `seed/dev.db` del bucket solo se usa en el
primer arranque (si el disco está vacío).

## Operación

- **Logs**: `docker compose -f /data/stack/docker-compose.yml logs -f web ingest-service`
  (rotados a 20 MB × 5 por contenedor). Además, con el **Ops Agent** instalado los logs y
  métricas de la VM van a Cloud Logging/Monitoring.
- **Salud**: `GET https://<dominio>/api/health` (200 con la BD arriba, 503 si no). Úsalo para
  un **uptime check** de Cloud Monitoring y para los healthchecks de Docker (ya en el compose).
- **Alertas sugeridas**: disponibilidad HTTPS, CPU>80%/15m, memoria>80%/10m, disco>70%,
  contenedor reiniciándose, 5xx, backup no generado en 8 h.
- **Actualizar versión**: `deploy/build-and-push.sh` con nuevo TAG (git-sha, **no `latest`**) →
  en la VM `cd /data/stack && docker compose pull && docker compose up -d`.
- **Migraciones**: se aplican solas al arrancar `web` (`prisma migrate deploy` en el
  entrypoint), idempotente.
- **Backups**: cron **cada 6 h** (`/etc/cron.d/sat-db-backup`) hace `sqlite3 .backup`, deja
  copia local en `/data/backups-local` (poda >3 días) y sube a `gs://<bucket>/backups/`.
  Restaurar: **detén el stack**, `gsutil cp gs://<bucket>/backups/<f>.db /data/db/dev.db`,
  `docker compose up -d`. Objetivo: RPO ≤6 h, RTO 1–2 h. **Prueba una restauración real antes
  del lanzamiento.**
- **Snapshots de disco** (opcional, punto de retorno completo): `gcloud compute disks
  snapshot sat-data --zone <zone>` o una política de snapshots programada.

## Seguridad

- `ingest-service` **no** publica puertos al host: solo accesible por `web` en la red de
  compose, autenticado con `INTERNAL_INGEST_TOKEN` (coherente con el README).
- SSH solo por IAP (sin IP pública de SSH abierta a Internet).

### Manejo de secretos

- Los **valores** de los secretos **no** son variables de Terraform: cualquier valor que
  reciba Terraform queda en el `tfstate` en texto plano (marcar `sensitive` solo lo oculta de
  la salida de consola, no del estado). Terraform crea los **contenedores vacíos** y los
  valores se cargan con `deploy/load-secrets.sh` (`gcloud secrets versions add`).
- En la VM se renderizan a `/data/app.env` (permisos `600`) desde Secret Manager. La API key
  de Mistral además se cifra en la BD (AES-256-GCM) como hoy.
- **`SECRET_ENCRYPTION_KEY` debe permanecer estable**: si cambia, la app no podrá descifrar la
  clave de Mistral guardada en la BD. `load-secrets.sh` es idempotente y no la regenera al
  re-ejecutar (usa `FORCE=1` solo si sabes lo que haces).
- Genera valores fuertes (`openssl rand -base64 48`); no reutilices los de desarrollo.
- **Estado de Terraform**: para prod, mueve el `tfstate` a un backend GCS versionado y con IAM
  restringido — ver `terraform/backend.tf.example`. Nunca subas `terraform.tfvars` ni
  `*.tfstate` al repo (ya excluidos en `terraform/.gitignore`).

## Antes de producción (pendientes de aplicación, no de infra)

Estos puntos son de la app, no de GCP, pero conviene resolverlos antes de abrir al público:

- **No cargar usuarios/contraseñas demo.** El `prisma/seed.ts` (demo) siembra cuentas de prueba
  con contraseñas públicas. Para prod usa el **seed de producción**, que carga **solo** taxonomía,
  tablas de scoring, configuración base y **un** admin — sin alumnos, profesores, preguntas,
  intentos ni mocks. El contenido académico entra vía AI Import.

  ```bash
  # Construye un DB de producción limpio y usable (schema + taxonomía + scores + settings + admin).
  DATABASE_URL="file:./prisma/prod.db" npm run db:init:prod
  #  → la contraseña del admin se genera y se escribe en .secrets/prod-admin-credentials.txt
  #    (texto plano, gitignored). O inyecta la tuya:
  #    PROD_ADMIN_EMAIL=admin@tudominio.com PROD_ADMIN_PASSWORD=... npm run db:init:prod

  # Embarca ese DB como seed del despliegue (primer arranque de la VM):
  gsutil cp prisma/prod.db gs://<bucket>/seed/dev.db
  ```

  `db:init:prod` materializa el schema con `migrate diff` (el chain de migraciones no es
  replayable desde cero) y marca las migraciones como aplicadas, así el `migrate deploy` del
  arranque queda no-op. `db:seed:prod` (solo seed, idempotente) sirve para re-sembrar/rotar el
  admin sobre un DB existente (`PROD_ADMIN_RESET=true` para resetear su contraseña).
- **Taxonomía.** Existe la divergencia conocida `Topic` ↔ `Skill` (ver README/CLAUDE.md). Antes
  de cargar volumen grande de contenido conviene decidir: implementar el nivel `Topic` real bajo
  `Skill`, o congelar el modelo actual renombrando `Topic`→`Skill` en la UI y documentarlo. **Pendiente.**
- **Health checks activos.** `GET /api/health` (web) y `GET /health` (ingest) ya existen y los
  usa el compose; conéctales un uptime check.

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
