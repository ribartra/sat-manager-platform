## Veredicto

**La arquitectura base es adecuada para un MVP funcional y económico**, porque respeta cómo está construida actualmente la plataforma: Next.js requiere Node por `better-sqlite3`, la base es un archivo SQLite y la ingesta FastAPI utiliza bibliotecas pesadas como OpenCV, Pillow y `pdfplumber`. Por ello, una sola VM con Docker Compose evita los problemas que aparecerían al intentar ejecutar SQLite en varias instancias serverless.

Sin embargo, **no la desplegaría exactamente como está escrita**. La dirección técnica es correcta, pero faltan ajustes de memoria, almacenamiento, secretos, observabilidad y consistencia funcional.

## Cambios que recomiendo

| Componente                               | Evaluación                                         | Decisión recomendada                                     |
| ---------------------------------------- | -------------------------------------------------- | -------------------------------------------------------- |
| Una VM + Docker Compose                  | Correcto para el volumen inicial                   | Mantener                                                 |
| Caddy directo, sin Load Balancer         | Correcto y económico                               | Mantener                                                 |
| `e2-small`, 2 GB RAM                     | Demasiado ajustado para web + OCR                  | Cambiar a `e2-medium`, 4 GB                              |
| Disco balanceado de 20 GB                | Puede llenarse con ZIP, staging, imágenes y Docker | Usar 50 GB                                               |
| SQLite en Persistent Disk                | Correcto mientras exista una sola instancia        | Mantener con WAL y control de concurrencia               |
| Secretos colocados en `terraform.tfvars` | Riesgo: pueden terminar en el estado Terraform     | Sacar los valores secretos de Terraform                  |
| Backups diarios                          | Correctos, pero RPO de 24 horas es alto            | Ejecutarlos cada 6 horas                                 |
| Logs locales de Docker                   | Insuficientes para producción                      | Instalar Ops Agent y alertas                             |
| Uploads locales                          | Aceptables inicialmente                            | Añadir limpieza automática y migrar a GCS cuando crezcan |
| Etiqueta Docker `latest`                 | Poco reproducible                                  | Utilizar tags inmutables por commit                      |
| Taxonomía actual                         | Existe una inconsistencia funcional conocida       | Resolverla antes de producción                           |
| Usuarios demo                            | Contraseñas públicas en README                     | No cargarlos en producción                               |

---

## 1. La VM debe ser `e2-medium`

Google publica estas capacidades y precios aproximados para `us-central1`:

- `e2-small`: 2 vCPU, 2 GiB, aproximadamente **US$12.23 al mes**.

- `e2-medium`: 2 vCPU, 4 GiB, aproximadamente **US$24.46 al mes**. ([Google Cloud](https://cloud.google.com/products/compute/pricing/general-purpose?hl=es&utm_source=chatgpt.com "Precios de las VMs de uso general | Google Cloud"))

Tu plataforma puede aceptar archivos de hasta 256 MB y ejecuta simultáneamente Node.js, FastAPI, OpenCV, Pillow, PDFPlumber, Prisma, SQLite, Caddy y Docker. En ese escenario, **2 GB pueden provocar swapping, lentitud u OOM durante una ingesta**, aunque la navegación habitual funcione.

Mi recomendación inicial es:

```text
VM: e2-medium
vCPU: 2
RAM: 4 GB
Sistema: Debian 12
Región inicial: us-central1
```

El `e2-small` solo lo usaría para una demostración con:

- una ingesta a la vez;

- documentos pequeños;

- procesamiento fuera del horario de uso;

- 2 GB de swap como protección, no como memoria normal.

Para una plataforma que deba sentirse fluida con aproximadamente diez usuarios y tres concurrentes, **`e2-medium` es el mejor punto de equilibrio**.

---

## 2. Utilizar 50 GB de Persistent Disk balanceado

El planteamiento original considera 20 GB, pero el sistema almacena:

- SQLite, incluyendo archivos WAL y SHM;

- cargas originales;

- staging privado;

- imágenes extraídas;

- preguntas promovidas;

- imágenes Docker;

- logs;

- certificados de Caddy.

Además, un único ZIP puede llegar a 256 MB antes de ser descomprimido y procesado.

Configuraría:

```text
Persistent Disk zonal pd-balanced: 50 GB
Mount point: /data
```

El disco balanceado ofrece una relación adecuada entre coste y rendimiento y una línea base de 3,000 IOPS y 140 MiB/s, suficiente para este tamaño de aplicación y para SQLite. ([Google Cloud Documentation](https://docs.cloud.google.com/compute/docs/disks/performance?utm_source=chatgpt.com "Persistent Disk performance overview  |  Compute Engine  |  Google Cloud Documentation"))

Estructura propuesta:

```text
/data/
├── db/
│   └── dev.db
├── uploads/
├── private/
│   └── staging/
├── stack/
├── docker/
├── caddy/
│   ├── data/
│   └── config/
└── backups-local/
```

También movería el almacenamiento interno de Docker a:

```json
{
  "data-root": "/data/docker"
}
```

Así se evita que el disco de arranque se llene con imágenes y capas de contenedores.

---

## 3. El presupuesto original está subestimado

El archivo calcula unos **US$15–16 mensuales**, pero no incorpora claramente el coste de la IPv4 externa.

Google cobra actualmente alrededor de **US$0.005 por hora por una IPv4 externa asociada a una VM**, aproximadamente US$3.65 mensuales. Incluso si la VM se detiene, la IP sigue considerándose en uso mientras permanezca asociada. ([Google Cloud](https://cloud.google.com/vpc/network-pricing?hl=es&utm_source=chatgpt.com "Precios de red | Google Cloud"))

### Escenario económico mínimo

| Recurso                                           | Estimación mensual |
| ------------------------------------------------- | ------------------ |
| VM `e2-small`                                     | US$12.23           |
| IPv4 externa                                      | US$3.65            |
| Disco balanceado 20 GB                            | US$2.00            |
| GCS, secretos, registro, snapshots y tráfico bajo | US$2–7             |
| **Total realista**                                | **US$20–25**       |

### Escenario recomendado

| Recurso                                               | Estimación mensual     |
| ----------------------------------------------------- | ---------------------- |
| VM `e2-medium`                                        | US$24.46               |
| IPv4 externa                                          | US$3.65                |
| Disco balanceado 50 GB                                | US$5.00                |
| GCS, secretos, Artifact Registry, snapshots y tráfico | US$2–8                 |
| **Total GCP estimado**                                | **US$35–42 mensuales** |

Mistral OCR y Brevo quedarían fuera de ese cálculo.

La decisión de no utilizar un Load Balancer sigue siendo correcta: la primera regla de reenvío cuesta aproximadamente **US$0.025 por hora, o US$18.25 mensuales**, antes de considerar procesamiento de datos. ([Google Cloud](https://cloud.google.com/load-balancing/pricing?utm_source=chatgpt.com "Cloud Load Balancing pricing | Google Cloud"))

---

## 4. Corregir el manejo de secretos en Terraform

Actualmente se plantea colocar cinco valores secretos dentro de `terraform.tfvars`. Aunque se marquen como `sensitive`, Terraform puede almacenar esos valores en texto recuperable dentro de sus archivos de estado.

Terraform y Google recomiendan no guardar secretos en el estado y utilizar un backend remoto protegido. Marcar una variable como `sensitive` solamente la oculta de la salida de consola; no necesariamente la elimina del estado. ([HashiCorp Developer](https://developer.hashicorp.com/terraform/language/manage-sensitive-data?utm_source=chatgpt.com "Manage sensitive data in your configuration | Terraform | HashiCorp Developer"))

### Procedimiento correcto

Terraform debe crear únicamente los contenedores:

```text
sat-auth-secret
sat-encryption-key
sat-internal-ingest-token
sat-mistral-api-key
sat-email-password
```

Después del `terraform apply`, cargar los valores fuera de Terraform:

```bash
printf '%s' "$AUTH_SECRET" |
  gcloud secrets versions add sat-auth-secret --data-file=-

printf '%s' "$SECRET_ENCRYPTION_KEY" |
  gcloud secrets versions add sat-encryption-key --data-file=-
```

El estado Terraform debe guardarse en un bucket separado:

```hcl
terraform {
  backend "gcs" {
    bucket = "satsol-terraform-state"
    prefix = "prod"
  }
}
```

Con:

- versionado;

- IAM restringido;

- acceso solo para administradores o CI;

- prohibición de subir `terraform.tfstate` y `*.tfvars` al repositorio.

También hay que conservar estable `SECRET_ENCRYPTION_KEY`: si cambia, la aplicación no podrá descifrar la clave Mistral almacenada en la base de datos.

---

## 5. Endurecer SQLite

SQLite es válido para este MVP, pero debe existir una única instancia web y controlarse la escritura concurrente.

Recomiendo:

```sql
PRAGMA journal_mode=WAL;
PRAGMA busy_timeout=5000;
PRAGMA foreign_keys=ON;
PRAGMA synchronous=NORMAL;
```

WAL permite que lectores y escritor interfieran menos entre sí, aunque todavía pueden aparecer errores `SQLITE_BUSY`; por ello debe existir un `busy_timeout` y reintentos controlados. ([SQLite](https://www2.sqlite.org/wal.html?utm_source=chatgpt.com "Write-Ahead Logging"))

Además:

- un solo proceso de ingesta simultáneo inicialmente;

- no escalar horizontalmente la web mientras use SQLite;

- no montar el archivo SQLite desde GCS o NFS;

- ejecutar backups mediante `sqlite3 .backup`, no copiando el archivo abierto directamente;

- detener el stack antes de una restauración;

- probar una restauración real antes del lanzamiento.

### Política de respaldo recomendada

```text
Cada 6 horas: backup SQLite hacia GCS
Diario: snapshot del Persistent Disk
Retención:
- 14 backups de 6 horas
- 30 backups diarios
- 12 backups mensuales
```

El bucket puede tener versionado, pero también necesita reglas de ciclo de vida: las versiones antiguas de los objetos se facturan igual que las activas mientras permanezcan almacenadas. ([Google Cloud](https://cloud.google.com/storage/pricing?utm_source=chatgpt.com "Storage pricing | Google Cloud"))

Objetivo operativo inicial:

```text
RPO: máximo 6 horas de información
RTO: 1–2 horas para reconstruir y restaurar
```

---

## 6. Resolver el problema funcional de taxonomía

Este punto es independiente de GCP, pero es el principal bloqueo para afirmar que el sistema está **funcionalmente correcto**.

El README reconoce que la fuente de verdad debería ser:

```text
Section → Domain → Skill/Subskill → Topic → Difficulty
```

pero la implementación actual utiliza `Topic` prácticamente como equivalente de `Skill`; además, reportes, players e ingesta dependen de esa interpretación.

Antes de producción deben elegir una de estas dos decisiones:

### Opción recomendada

Implementar la jerarquía correcta:

```text
Section
└── Domain
    └── Skill
        └── Topic
            └── Question
```

Esto requiere migración de esquema, seed, filtros, ingesta, reportes y analytics.

### Opción de lanzamiento rápido

Mantener temporalmente el modelo existente, pero:

- renombrar visualmente `Topic` como `Skill`;

- impedir que la UI presente ambos como niveles diferentes;

- documentar explícitamente la limitación;

- programar la migración antes de cargar grandes volúmenes de contenido.

Lo que no conviene es publicar la plataforma con una jerarquía declarada distinta de la que utilizan realmente los reportes.

---

## 7. Eliminar los usuarios y contraseñas demo

El README publica usuarios como:

```text
admin@sat.com / admin123
teacher@sat.com / teacher123
student1@sat.com / student123
```

Esas cuentas no deben existir en producción.

Debe crearse un seed de producción separado:

```bash
npm run db:seed:prod
```

Este seed debería incluir únicamente:

- taxonomía;

- configuraciones iniciales;

- tablas de scoring;

- programas base, cuando corresponda;

- un administrador generado mediante una contraseña aleatoria o invitación.

No debe cargar intentos, alumnos, profesores, preguntas demo ni mock tests ficticios, salvo que se trate de un ambiente explícitamente demostrativo.

---

## Arquitectura final recomendada

```text
                             Internet
                                │
                     satsol.org / www.satsol.org
                                │
                         IPv4 estática GCP
                                │
                     ┌──────────▼──────────┐
                     │ Caddy :80 / :443    │
                     │ TLS automático      │
                     │ redirect www → apex │
                     └──────────┬──────────┘
                                │
                         red Docker interna
                ┌───────────────┴────────────────┐
                │                                │
        ┌───────▼────────┐              ┌────────▼─────────┐
        │ Next.js :3000  │              │ FastAPI :8000    │
        │ Prisma/SQLite  │─────────────▶│ solo interno     │
        │ Auth/RBAC      │ token interno│ concurrencia = 1 │
        └───────┬────────┘              └────────┬─────────┘
                │                                │
                └──────────────┬─────────────────┘
                               │
                     Persistent Disk 50 GB
                 DB · uploads · staging · Caddy
                               │
                  ┌────────────┴──────────────┐
                  │                           │
           GCS backups                 Secret Manager
           + snapshots                 + Artifact Registry
```

Caddy necesita que los registros DNS apunten a la VM, que los puertos 80 y 443 sean accesibles y que su directorio de datos sea persistente para administrar correctamente los certificados. ([Caddy Web Server](https://caddyserver.com/docs/quick-starts/https?utm_source=chatgpt.com "HTTPS quick-start — Caddy Documentation"))

Caddyfile sugerido:

```caddyfile
satsol.org {
    encode zstd gzip
    reverse_proxy web:3000
}

www.satsol.org {
    redir https://satsol.org{uri} permanent
}
```

Volúmenes imprescindibles:

```yaml
volumes:
  - /data/caddy/data:/data
  - /data/caddy/config:/config
```

---

# Plan refinado de implementación

## Fase 0: preparación funcional

Antes de tocar producción:

```bash
npm ci
npm run prisma:validate
npm run lint
npm run typecheck
npm run qa:p0
npm run qa:authz
npm run qa:edge
npm run build
```

Entregables:

1. decisión sobre `Skill` y `Topic`;

2. seed de producción;

3. eliminación de credenciales demo;

4. prueba local de backup y restore;

5. endpoint `/api/health`;

6. endpoint interno de salud para FastAPI;

7. limpieza automática de staging terminado.

---

## Fase 1: preparar GCP y Terraform

Crear:

- proyecto exclusivo para producción;

- presupuesto y alertas de facturación;

- bucket separado para estado Terraform;

- Artifact Registry;

- bucket GCS de backups;

- Secret Manager;

- service account con IAM mínimo;

- IP regional estática;

- firewall público únicamente para 80 y 443;

- SSH exclusivamente mediante IAP;

- VM `e2-medium`;

- disco `pd-balanced` de 50 GB;

- política de snapshots.

No deben quedar expuestos:

```text
3000
8000
22 público
```

---

## Fase 2: preparar contenedores

Utilizar tags inmutables:

```bash
TAG=$(git rev-parse --short HEAD)
```

Ejemplo:

```text
web:7f23a91
ingest:7f23a91
caddy:2.x.y
```

No depender de `latest`.

En Compose:

```yaml
restart: unless-stopped
```

Añadir health checks y rotación local de logs:

```yaml
logging:
  driver: json-file
  options:
    max-size: "20m"
    max-file: "5"
```

Variables principales:

```env
NODE_ENV=production
AUTH_URL=https://satsol.org
DATABASE_URL=file:/data/db/dev.db

AI_INGEST_SERVICE_URL=http://ingest-service:8000
INTERNAL_INGEST_TOKEN=...

SECRET_ENCRYPTION_KEY=...
MISTRAL_API_KEY=...

EMAIL_FROM=noreply@satsol.org
EMAIL_HOST=smtp-relay.brevo.com
EMAIL_PORT=587
```

---

## Fase 3: desplegar datos

1. Subir el seed inicial al bucket.

2. Levantar la VM sin DNS.

3. Confirmar que el disco se montó en `/data`.

4. Confirmar que el seed se copie únicamente cuando la base no exista.

5. Ejecutar migraciones.

6. Levantar Compose.

7. Probar la aplicación directamente usando temporalmente la IP y un `Host` header, sin publicar todavía el dominio.

8. Verificar persistencia reiniciando la VM.

---

## Fase 4: DNS, HTTPS y correo

En Namecheap:

```text
A Record
Host: @
Value: IP_ESTATICA_GCP
TTL: Automatic
```

```text
CNAME Record
Host: www
Value: satsol.org
TTL: Automatic
```

Después:

```bash
dig +short satsol.org
dig +short www.satsol.org
```

Cuando ambos resuelvan correctamente, iniciar Caddy y comprobar:

```bash
curl -I https://satsol.org
curl -I https://www.satsol.org
```

Para Brevo deben añadirse posteriormente los registros que proporcione su panel: código Brevo, DKIM y DMARC. Brevo indica que la autenticación del dominio mejora la entrega y protege contra suplantación. ([Brevo Ayuda](https://help.brevo.com/hc/es/articles/17286219877778-FAQ-Acerca-de-la-autenticaci%C3%B3n-de-dominio-c%C3%B3digo-Brevo-DKIM-DMARC?utm_source=chatgpt.com "FAQ: Acerca de la autenticación de dominio (código Brevo, DKIM, DMARC) – Inicio"))

---

## Fase 5: observabilidad

El rol `logging.logWriter` no instala por sí solo la recolección de logs. Debe instalarse **Google Cloud Ops Agent**, que es el agente principal de Google para capturar logs, métricas y trazas en Compute Engine. ([Google Cloud Documentation](https://docs.cloud.google.com/monitoring/agent/ops-agent?utm_source=chatgpt.com "Ops Agent overview  |  Cloud Monitoring  |  Google Cloud Documentation"))

Configurar alertas para:

```text
Disponibilidad HTTPS
CPU > 80% durante 15 minutos
Memoria > 80% durante 10 minutos
Disco > 70%
Contenedor reiniciándose repetidamente
Errores HTTP 5xx
Backup no generado en las últimas 8 horas
```

También crear un uptime check contra:

```text
https://satsol.org/api/health
```

Google Cloud puede ejecutar comprobaciones públicas periódicas sobre una URL y alertar cuando deja de responder. ([Google Cloud Documentation](https://docs.cloud.google.com/monitoring/uptime-checks?hl=en&utm_source=chatgpt.com "Create public uptime checks  |  Cloud Monitoring  |  Google Cloud Documentation"))

---

## Fase 6: pruebas de aceptación

Antes de entregar:

1. Inicio de sesión de cada rol.

2. Creación y validación de un usuario.

3. Asignación de Practice Set.

4. Autosave y envío de intento.

5. Full Practice Test completo.

6. Reportes y analytics.

7. Invitación y envío de correo.

8. Carga PDF, DOCX y ZIP.

9. Ingesta OCR y promoción.

10. Reinicio completo de la VM.

11. Restauración desde backup.

12. Tres alumnos concurrentes mientras un docente navega.

13. Una ingesta ejecutándose mientras los alumnos responden.

Criterios recomendados:

```text
Sin errores OOM
Sin errores SQLITE_BUSY persistentes
RAM habitual < 75%
Disco < 70%
P95 de pantallas normales < 1.5 segundos
HTTPS válido
Backups restaurables
Ningún puerto interno expuesto
```

---

## Escalamiento posterior

Mantendría esta arquitectura mientras se cumpla:

```text
Una sola organización
Menos de 10–20 usuarios concurrentes
Ingesta controlada
Sin necesidad de alta disponibilidad
Sin errores frecuentes de bloqueo SQLite
```

Pasaría primero a `e2-standard-2`, con 8 GB, si el problema es memoria o CPU.

La migración a Cloud Run + PostgreSQL debería ocurrir cuando se necesiten varias instancias, alta disponibilidad o mayor concurrencia. La instancia compartida más pequeña de Cloud SQL cuesta aproximadamente US$7.67 mensuales solo en cómputo, antes de almacenamiento, backups y red, y no está cubierta por SLA; por tanto, la referencia de “US$9 mensuales” no representa necesariamente el coste completo. ([Google Cloud](https://cloud.google.com/sql/pricing?hl=es&utm_source=chatgpt.com "Precios de Cloud SQL | Google Cloud"))

**Configuración final que aprobaría para el lanzamiento:** `e2-medium`, 50 GB `pd-balanced`, Caddy sin Load Balancer, SQLite endurecido, backups cada seis horas, secretos fuera del estado Terraform, Ops Agent, seed de producción y resolución explícita de la taxonomía.
