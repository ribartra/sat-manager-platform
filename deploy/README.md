# Despliegue de SAT Platform en GCP

Todo lo necesario para desplegar la plataforma vive en esta carpeta. La infraestructura se
gestiona con Terraform y las versiones de la aplicación con scripts y `make`. La estructura sigue
la del proyecto factored-hackathon: módulos y entornos, estado remoto e imágenes inmutables.

**Producción:** proyecto `sat-sol-gsc`, VM `sat-vm` (e2-medium, `us-east1-b`), https://satsol.org.

**Qué corre en la VM:**
- Docker Compose con tres servicios: web (Next.js), ingesta (FastAPI) y Caddy (HTTPS).
- SQLite sobre un disco persistente.

## Estructura

```
deploy/
├── Makefile               punto de entrada: make help
├── cloudbuild.yaml        build de las imágenes web + ingest (local y CI)
├── terraform/
│   ├── bootstrap/         bucket versionado del estado de Terraform (una sola vez)
│   ├── modules/           registry · storage · secrets · vm · monitoring · ci
│   └── environments/prod/ main.tf, prod.tfvars (valores reales, sin secretos), imports.tf
├── vm/                    lo que corre EN la VM (Terraform lo sube a gs://<data>/stack/)
│   ├── vm-startup.sh      prepara la máquina en cada arranque (plantilla de Terraform)
│   ├── apply-stack.sh     valida e instala compose, Caddyfile, scripts, Ops Agent y cron
│   ├── deploy.sh          cambia de versión con backup y vuelta atrás automática
│   └── docker-compose.prod.yml, Caddyfile, sat-db-backup.sh, sat-notifications.sh, ops-agent.yaml, web-entrypoint.sh
├── scripts/               se ejecutan en tu equipo
└── docs/                  runbook.md, import.md, ci-wif.md
```

## Quién es dueño de qué

| Cosa | Dueño | Cómo cambia |
|---|---|---|
| VM, disco, IP, firewall, buckets, Artifact Registry, secretos (contenedores), IAM, alertas, WIF | Terraform | `make plan` → revisar → `make apply` |
| Archivos de la VM (`vm/*`) | Terraform los sube al bucket; `apply-stack.sh` los instala | `make apply` → `make sync-stack` |
| Versión de la app (TAG) | `deploy.sh` en la VM (`/data/stack/.env`) | `make build` → `make release TAG=…` |
| Valores de los secretos | Secret Manager | `make secrets` (nunca pasan por Terraform) |

Terraform nunca cambia la versión en ejecución: `initial_image_tag` solo se usa si la VM se crea
de nuevo. Al reiniciar, la VM conserva el TAG desplegado.

## Uso diario

```bash
cd deploy
make build                         # Cloud Build → imprime el TAG (p. ej. 20261031-ab12cd3)
make release TAG=20261031-ab12cd3  # backup + pull + health; vuelve atrás sola si falla
make current                       # TAG en producción
make rollback                      # al TAG anterior
make health
```

El CI de GitHub (`.github/workflows/build-images.yml`) construye las imágenes en cada push a
`main` y deja el TAG en el resumen del run. **Nunca despliega:** desplegar es siempre `make release`.

Los despliegues con migración de esquema van en la ventana de mantenimiento (`docs/runbook.md`).

**Cambios de infraestructura o de los archivos de la VM:**

```bash
make preflight      # sin credenciales: fmt/validate, scripts, compose, Caddy, políticas
make plan           # deja prod.plan y resume destroy/replace
make apply          # aplica ese plan
make sync-stack     # instala vm/* en la VM y aplica (compose up -d + caddy reload)
```

**Regla:** si `make plan` muestra que algo se *destruye* o se *reemplaza*, no se aplica. La VM, el
disco, la IP, los buckets y el registro tienen `prevent_destroy`.

## Cambios de datos (sin tocar el esquema)

Los cambios de datos (corregir contenido, rellenar un campo) son **data patches** en
`prisma/data-patches/`: un `.sql` o un `.mjs` por cambio, solo DML. Cada deploy aplica los
pendientes al arrancar, una sola vez y dentro de una transacción. Si uno falla, el contenedor no
arranca y la versión vuelve atrás sola. El esquema solo cambia con una migración de Prisma, y solo
cuando no hay otra forma.

```bash
make pull-db                       # local = producción
# escribir prisma/data-patches/YYYYMMDDHHMM_<qué>.sql (con -- expect: <filas>)
cd .. && npm run db:patch          # aplicarlo en local y revisar el resultado
cd deploy && make build && make release TAG=…   # producción lo aplica al arrancar
make db-compare                    # local y producción deben salir IDENTICAL
```

Detalles y reglas: `prisma/data-patches/README.md`. Nunca se ejecutan `UPDATE` a mano en la VM.

## Otras tareas

```bash
make pull-db        # copia fresca de producción → ./dev.db (+ migraciones y data patches pendientes)
make db-compare     # compara ./dev.db con producción sin reemplazar nada
make db-patch-status  # data patches aplicados / pendientes en ./dev.db
make secrets        # carga en Secret Manager los secretos que falten (FORCE=1 reescribe)
make ssh            # shell en la VM por IAP
scripts/push-db-to-cloud.sh   # sube una base local a producción (destructivo; ver el script)
```

## Primera vez en un equipo nuevo

1. `gcloud auth login` y `gcloud auth application-default login`. Si tienes varias cuentas, usa
   `export CLOUDSDK_CORE_ACCOUNT=admin@nordmetric.com`.
2. `cd deploy && make init`. El estado ya está en `gs://sat-sol-gsc-tfstate` (prefijo `prod`).
3. `make plan`: debe salir sin cambios, o solo con los esperados.

Para montar desde cero en otro proyecto:
1. Ajusta `prod.tfvars` y el `bucket` de `environments/prod/versions.tf`.
2. Corre `make bootstrap`, `make init`, `make apply` y `make secrets`.
3. Sube una base inicial: `gs://<data>/seed/dev.db`.
4. `make build`, y luego `make release`.
5. Apunta el registro A del dominio a la IP de salida.

## Qué se versiona

**Se versionan:**
- todo el `.tf`;
- `prod.tfvars` (sin secretos);
- `.terraform.lock.hcl`;
- `vm/`, `scripts/` y los docs.

**No se versionan (`terraform/.gitignore`):**
- `.terraform/`;
- `*.tfstate`;
- `*.plan`;
- `terraform.tfvars`.

Los secretos solo viven en Secret Manager.
