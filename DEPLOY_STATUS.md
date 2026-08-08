# Estado del despliegue GCP — pendientes

> Runbook completo: `DEPLOY_GCP.md`. Este archivo captura el **estado concreto** y
> lo que falta, para retomar sin re-descubrir. Actualizado: **2026-08-07**.

## ✅ BASE LOCAL (LIMPIA + STAGING) EMPUJADA A PROD (2026-08-07, último)

Se sobrescribió la BD de la nube con la base local `./dev.db` (raíz del repo): **0 demo**,
**staging de ingesta completo** (2549 candidatos, 1 batch, 6719 imgs). Saneado antes de subir:
purgado `MISTRAL_API_KEY_ENCRYPTED` (cifrado con llave dev), insertado `admin@satsol.org` con su
pwd de prod, deshabilitado `admin@sat.com`/`teacher.pending`, rotada la pwd de `teacher@sat.com`
(ver `.secrets/prod-credentials.txt`). Verificado: health 200, admin@satsol.org ADMIN, teacher
entra, admin@sat.com/admin123 falla, staging presente. Backup de la prod previa (escenario Ricardo)
en `gs://sat-sol-gsc-sat-data/backups/pre-push-*`. Assets del staging cargados en `/data/private`
(68.619 archivos/1.3G) y `/data/uploads` (114M). Lo de abajo (escenario Ricardo) quedó **sobrescrito**.

**Mecanismo repetible (formalizado):**
- `deploy/push-db-to-cloud.sh [--with-assets] [--yes]` — orquesta backup→snapshot→upload→swap→
  assets→verificación. Config por env (`PROJECT/BUCKET/ZONE/VM/LOCAL_DB/DOMAIN`) + saneo
  (`PROD_ADMIN_EMAIL/PASSWORD`, `DISABLE_EMAILS`, `ROTATE_EMAILS`, `PURGE_ENCRYPTED`). Pide
  confirmación (`si`) salvo `--yes`. DESTRUCTIVO: respalda la prod previa a `gs://…/backups/pre-push-*`
  antes del swap.
- `scripts/prep-push-snapshot.mjs` — preparador (lo llama el orquestador): copia consolidada del
  WAL, purga `AppSetting` cifrados, upsert admin de prod, deshabilita/rota credenciales dev.
- El push real hecho equivale a:
  ```bash
  PROD_ADMIN_EMAIL=admin@satsol.org PROD_ADMIN_PASSWORD='…' \
  DISABLE_EMAILS='admin@sat.com,teacher.pending@sat.com' ROTATE_EMAILS='teacher@sat.com' \
  deploy/push-db-to-cloud.sh --with-assets --yes
  ```

## ✅ DESPLIEGUE COMPLETO Y VERIFICADO (2026-08-07)

- **HTTPS en vivo**: `https://satsol.org/api/health` → `200 {"status":"ok","db":"up"}`.
  Cert **Let's Encrypt PRODUCCIÓN** (CN=satsol.org, válido 7 ago → 5 nov 2026).
- **Fix del cert**: el DNS quedó bien (Namecheap → `35.243.173.180`), pero Caddy estaba en backoff
  tras fallar el challenge contra la IP vieja durante la hora previa. Se resolvió **reiniciando el
  contenedor caddy** (`docker compose restart caddy`) → intento fresco `tls-alpn-01` OK.
- **Escenario con el FLUJO REAL de la app** (corregido — antes se pre-activaba al alumno, mal):
  - `prisma/provision-scenario.ts` (idempotente) provisiona SOLO el hueco sin API: **tutora**
    (TEACHER) + **Programa activo** + asignación; y **limpia** cualquier alumno/apoderado de prueba.
  - El **registro del alumno** se hace con el endpoint real `POST /api/students/invite` autenticado
    como la tutora → la app envía la **bienvenida** al alumno ("Activate your SAT Practice account",
    enlace `/auth/activate?token=…`) y el **consentimiento** al apoderado. La **inscripción al
    programa ocurre al activar** (`/auth/activate` hace `programEnrollment.create`).
  - Verificado: invite `{ok:true}`; InviteToken STUDENT con programa; **alumno aún SIN cuenta**
    (User=0) y **sin matrícula** hasta activar; página de activación HTTP 200; sin errores SMTP.
  - **Alumno activó** (cuenta creada + matriculado APPROVED) y **apoderado autorizó** (con contraseña).
  - **La tutora dejó el reporte** (`POST /api/parents/access-links`) → `emailSent:true`; el apoderado
    recibió el enlace `/parent/access?token=…` (secciones Math + R&W, vence +7d). Flujo end-to-end ✅.
  - Credenciales/enlaces en `.secrets/prod-scenario-credentials.txt` (local, gitignored).
- **Nota**: `tutora@satsol.org` es cuenta de prueba; rotar/eliminar tras validar.

## Contexto fijo

- **Proyecto**: `sat-sol-gsc` · cuenta gcloud: `admin@nordmetric.com`
- **Billing**: cuenta `01A5E0-AA42FB-AB2C74` **abierta**, `billingEnabled: true` ✅
- **Dominio**: `satsol.org`
- **ADC**: configurado (`gcloud auth application-default login` + quota project `sat-sol-gsc`)
- **Terraform**: sin CLI local → se corre vía docker. Invocación usada:

  ```bash
  cd terraform  # (el comando corre desde /work/terraform dentro del contenedor)
  docker run --rm \
    --user "$(id -u):$(id -g)" -e HOME=/tmp \
    -v "$PWD/..":/work -w /work/terraform \
    -v "$HOME/.config/gcloud":/gcloud:ro \
    -e GOOGLE_APPLICATION_CREDENTIALS=/gcloud/application_default_credentials.json \
    hashicorp/terraform:1.15.8 <plan|apply|...>
  ```
  `terraform/terraform.tfvars` (gitignored) ya está creado: project/domain/region/zone,
  `e2-medium`, disco 50 GB, SMTP Gmail validado. `image_tag=latest` (fijar a git-sha en Fase B).

## ✅ Hecho — Fase A + B + C (stack completo aplicado)

- **Storage en us-central1** (bucket/registry/secretos):
  - **Bucket**: `sat-sol-gsc-sat-data` (US-CENTRAL1, versionado) — con `seed/dev.db` = `prod.db`
  - **Artifact Registry**: `us-central1-docker.pkg.dev/sat-sol-gsc/sat-images` (`web:d49cee4`, `ingest:d49cee4`)
  - **5 secretos CON VALOR**: `sat-auth-secret`, `sat-secret-encryption-key`,
    `sat-internal-ingest-token`, `sat-mistral-api-key`, `sat-email-pass`
- **Compute en us-east1** (desacoplado por falta de cupo en us-central1):
  - **VM `sat-vm`** en `us-east1-b` (e2-medium) — **viva**, Caddy respondiendo en `:80`
  - **IP estática NUEVA**: `35.243.173.180` (la vieja `35.184.150.191` fue destruida)
- Admin de prod: `admin@satsol.org` (pwd en `.secrets/prod-admin-credentials.txt`, gitignored)
- APIs habilitadas: compute, storage, secretmanager, artifactregistry
- Estado en `terraform/terraform.tfstate` (local, gitignored)

## ⏳ Pendiente

### 0) DNS (usuario) — 🚨 BLOQUEO ACTIVO (ver arriba)
A record `satsol.org @` → **`35.243.173.180`**. Verificar: `dig +short satsol.org`.
Sin esto Caddy no emite cert y la API no es accesible por HTTPS.

### 0.1) Escenario backend de prueba — script listo y probado
Prod arranca solo con admin (sin docente/programa) y **ningún endpoint HTTP crea un teacher**.
Por eso el escenario se provisiona con `prisma/provision-scenario.ts` (idempotente; crea tutora +
programa + asignación + alumno **Ricardo Bartra** activado + apoderado + vínculo + enlace de reporte;
envía emails reales solo con enlaces; credenciales a `.secrets/prod-scenario-credentials.txt`).
Probado contra copia de `prod.db` (FK OK, idempotente). **Falta correrlo en la VM** (requiere SSH →
`gcloud auth login`, hoy roto en el entorno):

```bash
# 1) reautenticar gcloud (interactivo, en tu sesión):  ! gcloud auth login
# 2) copiar el script a la VM y correrlo dentro del contenedor web:
Z=us-east1-b
gcloud compute scp prisma/provision-scenario.ts sat-vm:/tmp/provision-scenario.ts --zone $Z --tunnel-through-iap
gcloud compute ssh sat-vm --zone $Z --tunnel-through-iap --command '
  cd /data/stack &&
  docker compose --env-file /data/stack/.env cp /tmp/provision-scenario.ts web:/app/prisma/provision-scenario.ts &&
  docker compose --env-file /data/stack/.env exec -T web npx tsx prisma/provision-scenario.ts'
# El resumen imprime login + enlace de reporte del padre. Credenciales quedan en la VM en
# /app/.secrets dentro del contenedor (efímero) y en el stdout: cópialas a un lugar seguro.
```
Luego: probar **entrar** (`https://satsol.org/login` con las credenciales impresas) y **acceso al
reporte** (enlace `/parent/access?token=…`). Requiere DNS+cert ya activos.

### 1) Fase B — (YA APLICADA) secretos, imágenes y seed — referencia

```bash
# a) Valores de secretos (fuera del tfstate). Idempotente; NO regenera
#    secret-encryption-key. Revisar deploy/load-secrets.sh antes de correr.
#    Necesita: MISTRAL_API_KEY y EMAIL_PASS (App Password de Gmail, hoy en .env).
PROJECT=sat-sol-gsc PREFIX=sat deploy/load-secrets.sh

# b) Imágenes web+ingest con tag inmutable
gcloud auth configure-docker us-central1-docker.pkg.dev   # una vez
TAG=$(git rev-parse --short HEAD)
REGION=us-central1 PROJECT=sat-sol-gsc REPO=sat-images TAG=$TAG deploy/build-and-push.sh
#   → luego fijar image_tag=$TAG en terraform/terraform.tfvars

# c) BD de producción (chain de migraciones no replayable desde vacío)
DATABASE_URL="file:./prisma/prod.db" npm run db:init:prod
#   → admin pwd en .secrets/prod-admin-credentials.txt (gitignored)
gsutil cp prisma/prod.db gs://sat-sol-gsc-sat-data/seed/dev.db
#   (opcional) uploads/staging previos:
# gsutil -m rsync -r public/uploads gs://sat-sol-gsc-sat-data/seed/uploads
# gsutil -m rsync -r .private        gs://sat-sol-gsc-sat-data/seed/private
```

### 2) Fase C — (YA APLICADA) VM creada. SSH de inspección:

```bash
# La VM vive en us-east1-b (no us-central1). gcloud CLI auth está roto en el entorno
# de trabajo (Reauthentication failed) → reautenticar antes de SSH:
gcloud auth login
gcloud compute ssh sat-vm --zone us-east1-b --tunnel-through-iap
# Salud: https://satsol.org/api/health  (200 con BD arriba y cert emitido)
```

Costo tras Fase C: ~$35–42/mo (VM e2-medium ~$24 + IP ~$3.65 + disco 50 GB ~$5 + GCS/secretos).

## Notas / gotchas

- **`SECRET_ENCRYPTION_KEY` estable**: si cambia, la app no descifra la Mistral key guardada en BD.
  `load-secrets.sh` no la regenera al re-ejecutar (usar `FORCE=1` solo a conciencia).
- El `dev.db` del repo (LFS) es **demo/dev**; producción usa el `prod.db` de `db:init:prod`.
  Recordatorio: la base local `dev.db` ya fue limpiada de demo (ver `scripts/clean-demo-content.mjs`).
- Terraform corriendo en docker: se usa `--user $(id -u)` para no dejar archivos root en `terraform/`.
- Promoción de candidatos de ingesta sigue en **standby** (aparte del deploy).
