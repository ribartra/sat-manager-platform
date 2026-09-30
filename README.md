# SAT Practice Platform

Plataforma web para gestionar preparación SAT con portales por rol, banco de preguntas, Practice Sets, Full Practice Tests, reportes, notificaciones, auditoría e ingesta asistida por IA para PDFs/DOCX/ZIP.

El producto está construido como una aplicación Next.js con una base SQLite/Prisma y un servicio FastAPI independiente para procesamiento documental. La ingesta no escribe directamente en las preguntas oficiales: primero deja todo en staging, permite revisar/corregir y recién luego promueve contenido aprobado.

---

## Componentes Principales

| Componente | Ubicación | Responsabilidad |
|---|---|---|
| App web | `app/` | Portales Admin, Teacher, Student, Parent y route handlers API. |
| UI compartida | `components/` | Botones, cards, dialogs, tablas, navegación, KaTeX, visor de media. |
| Lógica de dominio | `lib/` | Auth/RBAC, Prisma, taxonomía, asignaciones, scoring, secretos, promoción de ingesta. |
| Base de datos | `prisma/schema.prisma` | Modelo Prisma para usuarios, contenido, intentos, reportes, ingesta y auditoría. |
| Seed | `prisma/seed.ts` | Datos demo, taxonomía SAT, programas, usuarios, sets y full tests base. |
| Ingesta IA | `ingest_service/app/main.py` | FastAPI para extraer PDF/DOCX, OCR Mistral, imágenes, incidencias y staging. |
| Scripts | `scripts/` | Backup/restore, QA estática, alineación de taxonomía, promoción demo. |
| Docker | `docker-compose.yml` | Levanta `web` en 3000 e `ingest-service` en 8000 con bind mount del proyecto. |

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 App Router con webpack |
| Lenguaje | TypeScript 5, React 19 |
| Auth | NextAuth v5 beta, Credentials, JWT |
| ORM/DB | Prisma 7, SQLite, `better-sqlite3`, Prisma adapter |
| UI | Tailwind CSS v4, Radix UI, lucide-react |
| Formularios | React Hook Form, Zod |
| Tablas | TanStack Table |
| Matemática | KaTeX / react-katex |
| Servicio IA | FastAPI, Uvicorn, pdfplumber, python-docx, Pillow, OpenCV, Mistral SDK |
| Email | Nodemailer / Brevo SMTP |
| Runtime | Node.js 24+, Python 3.12 en Docker |

---

## Roles y Portales

| Rol | Portal | Capacidades |
|---|---|---|
| `ADMIN` | `/admin/*` y vista teacher | Usuarios, profesores, programas, taxonomía, configuración, logs, ingesta IA y promoción. |
| `TEACHER` | `/teacher/*` | Alumnos, padres, preguntas, Practice Sets, Full Practice Tests, asignaciones, analytics y reportes. |
| `STUDENT` | `/student/*` | Resolver asignaciones, ver mapa de contenido, historial, resultados, materiales y full tests. |
| `PARENT` | `/parent` | Ver progreso y reportes de hijos vinculados. |

La protección de rutas vive en layouts y helpers server-side. No hay `middleware.ts` porque `better-sqlite3` y Prisma con adapter requieren Node runtime, no Edge Runtime.

---

## Lógica Funcional

### Autenticación y Ciclo de Usuario

- Login por email/password con NextAuth Credentials.
- Sesión JWT con `id`, `email`, `role` y `validationStatus`.
- Usuarios con estados `PENDING`, `APPROVED`, `REJECTED`.
- Admin valida usuarios y puede activar/desactivar cuentas.
- Estudiante invitado activa cuenta desde token.
- Si la invitación del estudiante incluye padre, el padre se crea/vincula durante la activación del alumno; no requiere invitación separada.
- Padres se administran desde un maestro de padres con asociación/desasociación de alumnos.

### Programas, Grupos y Permisos

- `Program` agrupa docentes y alumnos mediante `ProgramTeacher` y `ProgramEnrollment`.
- Si hay un solo programa para el docente, la UI lo simplifica y lo selecciona por defecto.
- Grupos existen como funcionalidad opcional, pero no se crean por defecto en seed.
- La pestaña de grupos queda reservada al admin, y para docentes depende de permisos configurables.
- Solicitudes de desbloqueo y aceptación de invitaciones de alumnos por docentes están desactivadas por defecto y quedan parametrizables por admin.

### Taxonomía Académica

**Fuente de verdad (jerarquía oficial):**

```text
Platform
└── Subject / Section          Mathematics
    └── Domain                 Advanced Math
        └── Skill / Subskill   Nonlinear Functions
            └── Topic          Quadratic Functions
                └── Difficulty Easy / Medium / Hard
                    └── Practice Set   Quadratic Functions - Medium - Set 01
                        └── Question   Pregunta 1, 2, 3...
```

| Nivel | Qué significa | Ejemplo |
|---|---|---|
| Section / Subject | Gran área del SAT | Mathematics |
| Domain | Dominio oficial SAT | Advanced Math |
| Skill / Subskill | Habilidad evaluada | Nonlinear Functions |
| Topic | Tema específico usado por la tutora | Quadratic Functions |
| Difficulty | Nivel | Easy / Medium / Hard |
| Practice Set | Paquete asignable | Quadratic Functions - Medium - Set 01 |
| Question | Ejercicio individual | Pregunta 1, 2, 3... |

Puntos clave:

- **`Topic` es más específico que `Skill`**: un Skill/Subskill agrupa varios Topics. `Topic` NO es sinónimo de Skill.
- `Difficulty` no es un nodo académico; es un atributo operativo de `Question` y `PracticeSet` que cuelga por debajo de Topic.
- El contenedor de skills es el `Domain`; el contenedor de topics es el `Skill/Subskill`.

> **⚠️ Gap conocido (implementación vs. fuente de verdad).** El código y la BD actuales todavía NO reflejan esta jerarquía:
> - `TaxonomyNode` modela `AREA -> DOMAIN -> SKILL -> SUBSKILL` (no incluye un nivel `TOPIC` bajo el skill).
> - La tabla legacy `Topic` está enlazada a nodos de tipo `SKILL` (relación 1:1: 46 topics ↔ 46 nodos SKILL), es decir hoy `Topic` **ocupa el lugar del Skill**, no el de un tema bajo el skill.
> - La tabla `Subskill` prácticamente no se usa (1 registro).
>
> Reportes, players e ingesta agrupan por esa tabla `Topic`, por lo que hoy "topic" significa en la práctica "skill". Alinear el modelo con esta fuente de verdad es trabajo pendiente (ver sección de decisiones).

### Banco de Preguntas

- Preguntas tipo `MC` o `NUMERIC`.
- Alternativas en `QuestionOption`.
- Soporte de imagen en pregunta y alternativas.
- Dificultad `EASY`, `MEDIUM`, `HARD`.
- Estados `DRAFT`, `PUBLISHED`, `ARCHIVED`.
- Render LaTeX/KaTeX en vistas de revisión, player y resultados.
- Repositorio con filtros por sección Math / Reading & Writing, nombre, taxonomía, dificultad y estado.

### Practice Sets

- Un `PracticeSet` agrupa preguntas oficiales.
- Ciclo de vida: crear, editar, duplicar, publicar, archivar, asignar.
- Puede originarse manualmente o desde promoción de ingesta IA.
- El nombre promovido desde ingesta usa dominio, skill y dificultad cuando están resueltos.
- Asignación a estudiantes vía `Assignment`.
- Player con autosave, pausas, submit, scoring, revisión y reporte.
- Desbloqueo por regla de progreso configurada; las solicitudes manuales no aparecen por defecto.

### Full Practice Tests

- `FullPracticeTest` contiene módulos SAT-like:
  - RW Module 1
  - RW Module 2
  - Math Module 1
  - Math Module 2
- Relación de preguntas mediante `FullPracticeTestQuestion`.
- Asignación vía `FullPracticeTestAssignment`.
- Intentos con autosave, pausa, reanudación y submit.
- Scoring proporcional sobre las preguntas que cuentan: `200 + 600 × aciertos ÷ preguntas que cuentan`, redondeado a 10 (54/44, o 50/40 si `FPT_PRETEST_EXCLUSION` excluye las pretest). Ver `lib/full-test-scoring.ts`.
- El flujo tiene ciclo de vida completo: crear, editar, duplicar, asignar, resolver, revisar y reportar.

### Reportes, Analytics y Padres

- Reporte individual por alumno.
- Reporte PDF por áreas configurables.
- Vista de padre con hijos asociados y progreso.
- Analytics por alumno, pregunta, skill, dificultad y tiempo.
- Desde cards/listas de alumno se puede navegar hacia analytics específicos.

### Notificaciones y Auditoría

- `Notification` centraliza avisos internos.
- `AuditLog` registra eventos administrativos y de programa.
- `/admin/logs` muestra registros de auditoría como vista de administrador.
- La ingesta IA además registra `IngestIncident` e `IngestJobEvent` para observabilidad documental.

---

## Ingesta IA

La ingesta se trabaja en dos capas:

1. `Next.js` recibe archivos, muestra lotes, wizard, incidencias, revisión y promoción.
2. `FastAPI` procesa documentos, extrae texto/imágenes, invoca OCR, crea staging y registra progreso.

### Endpoints Web de Ingesta

| Endpoint | Uso |
|---|---|
| `/api/admin/ai-import/upload` | Carga archivos sueltos o ZIP hasta 256 MB. |
| `/api/admin/ai-import/upload-sources` | Registra fuentes desde rutas locales del workspace. |
| `/api/admin/ai-import/batches` | Lista lotes y estado. |
| `/api/admin/ai-import/batches/[batchId]/process` | Procesa lote. |
| `/api/admin/ai-import/batches/[batchId]/retry-failed` | Reintenta archivos/páginas fallidas del lote. |
| `/api/admin/ai-import/batches/[batchId]/review-session` | Guarda sesión del wizard. |
| `/api/admin/ai-import/batches/[batchId]/promote-questions` | Promueve preguntas seleccionadas. |
| `/api/admin/ai-import/batches/[batchId]/promote-practice-set` | Promueve un Practice Set desde candidatos. |
| `/api/admin/ai-import/batches/[batchId]/promote-full-test` | Promueve un Full Practice Test desde candidatos. |
| `/api/admin/ai-import/candidates/[candidateId]` | Actualiza candidato revisado. |
| `/api/admin/ai-import/candidates/[candidateId]/image-links` | Asocia imágenes a enunciado, alternativa, explicación o contexto. |
| `/api/admin/ai-import/candidates/[candidateId]/parse-option-image` | OCR/parsing de imagen que contiene alternativas. |
| `/api/admin/ai-import/assets/[batchId]/[fileName]` | Sirve imágenes privadas de staging al admin. |

### Flujo de Ingesta

```text
Load
  -> registrar ZIP/PDF/DOCX o ruta local
  -> crear IngestBatch e IngestSourceFile

Process
  -> extraer PDF con pdfplumber cuando hay texto seleccionable
  -> extraer DOCX y tablas con python-docx
  -> detectar páginas con baja densidad textual o render blanco
  -> usar Mistral OCR para páginas/imágenes que lo requieren
  -> extraer imágenes con pdfplumber/Mistral
  -> crear IngestPageArtifact, IngestImageArtifact, IngestQuestionCandidate e IngestAnswerCandidate

Recover
  -> reintentar fallidos
  -> reutilizar IngestOcrCache cuando existe contentHash
  -> registrar IngestJobEvent para retomar progreso

Review
  -> wizard por archivo/pregunta
  -> corregir stem, opciones, respuesta, explicación, tipo, taxonomía y dificultad
  -> asociar imágenes a STEM, STIMULUS, OPTION, OPTION_BLOCK, ANSWER_FIELD, EXPLANATION o PAGE_CONTEXT
  -> marcar candidatos como READY, REVIEWED, REJECTED o EDITING

Promote
  -> promover solo preguntas seleccionadas
  -> o promover un Practice Set / Full Practice Test completo
  -> copiar imágenes aprobadas a public/uploads/questions
  -> dejar IngestPromotionArtifact para trazabilidad
```

### Clasificación Documental

La ingesta usa ruta, nombre de archivo y contenido interno.

Reglas principales:

- `PRACTICE EXERCISES` se clasifica como `PRACTICE_SET`.
- `MOCK EXAMS` se clasifica como `FULL_PRACTICE_TEST`.
- Archivos con `ANS`, `Answer Key` o `Answer Exp` se tratan como respuesta/explicación según estructura.
- `EASY`, `MED`, `MEDIUM`, `HARD` definen dificultad si aparecen en carpeta o nombre.
- En Practice Sets de Math, la carpeta suele indicar `DOMAIN/SKILL`.
- En Reading/Writing, carpetas como `WORDS IN CONTEXT`, `BOUNDARIES` o `STUDENT NOTES` se normalizan a dominios SAT oficiales.
- En Full Practice Tests se soportan estructuras combinadas y separadas por sección/módulo, por ejemplo:
  - `MOCK EXAMS/TEST 1/TEST 1 INNOVATOR MATH MOD 1 AND 2.pdf`
  - `MOCK EXAMS/TEST 2/MATH/Innov. Test 2 Math Mod 1, 2B REV.pdf`
  - `MOCK EXAMS/TEST 2/READING AND WRITING/INNOVATOR TEST 2 R&W MOD 1 REV.pdf`
  - DOCX de answer key y answer explanations en tablas.

### OCR y Caché

- Primero se intenta extracción estructural con `pdfplumber` o `python-docx`.
- Si una página tiene baja densidad textual o el render indica página visual no blanca sin texto útil, se marca para OCR.
- Mistral se invoca con `mistral-ocr-latest` por defecto.
- Las respuestas OCR quedan cacheadas por hash en `IngestOcrCache`, para no pagar/procesar dos veces la misma página.
- Las imágenes extraídas quedan en staging como `IngestImageArtifact`.

### Tiempo Estimado y Observabilidad

La UI calcula tiempo restante con señales de `IngestJobEvent`:

- Base inicial: 1 minuto por página.
- Luego usa promedio real de segundos por página.
- Si hay archivos sin page count, estima páginas restantes con promedio de páginas por documento ya contado.
- Los eventos guardan archivos/páginas procesadas, páginas conocidas, páginas pendientes OCR y segundos estimados.
- Al volver al wizard se puede reconstruir el estado desde los eventos y la sesión `IngestReviewSession`.

### Incidencias

`IngestIncident` guarda inconsistencias detectadas:

- metadata ambigua,
- pareja pregunta/respuesta incompleta,
- pregunta duplicada,
- OCR fallido,
- falta de respuesta correcta,
- pregunta sin alternativas cuando debería tenerlas,
- archivo no resoluble por estructura.

Las incidencias quedan visibles para admin y deben indicar archivo/página/candidato cuando existe trazabilidad.

---

## Configuración de Mistral

La llave Mistral puede venir de dos fuentes:

1. `AppSetting` en BD con key `MISTRAL_API_KEY_ENCRYPTED`.
2. Variable `MISTRAL_API_KEY` como fallback.

La UI de admin permite actualizarla en `/admin/settings`.

La llave no se guarda en texto plano:

- Se cifra con AES-256-GCM.
- Se conserva fingerprint SHA-256, últimos 4 caracteres y fecha de actualización.
- El servicio FastAPI la lee desde BD al iniciar o usa variable de entorno si no hay setting.

Variables relevantes:

```env
SECRET_ENCRYPTION_KEY="clave-larga-para-cifrar-secretos"
INTERNAL_INGEST_TOKEN="token-interno-web-fastapi"
MISTRAL_API_KEY="fallback-dev-key"
MISTRAL_OCR_MODEL="mistral-ocr-latest"
MISTRAL_STRUCTURING_MODEL="mistral-large-latest"
```

---

## Modelo de Datos

Resumen conceptual:

```text
User
  -> ProgramTeacher / ProgramEnrollment
  -> ParentStudent
  -> Assignment -> Attempt -> AttemptAnswer
  -> FullPracticeTestAssignment -> FullPracticeTestAttempt -> FullPracticeTestAnswer
  -> Notification
  -> AuditLog

Program
  -> ProgramTeacher
  -> ProgramEnrollment
  -> InviteToken

# Jerarquía académica objetivo (fuente de verdad):
#   Section -> Domain -> Skill/Subskill -> Topic -> Difficulty -> PracticeSet -> Question
# Implementación actual (gap): la tabla `Topic` mapea a nodos SKILL; ver "Taxonomía Académica".

TaxonomyNode
  -> parent/children recursivo
  -> AREA -> DOMAIN -> SKILL -> SUBSKILL   (aún sin nivel TOPIC bajo el skill)

Section -> Domain -> Topic (= SKILL hoy) -> Subskill
                         -> Question
                         -> PracticeSet
                         -> StudyMaterial

Question
  -> QuestionOption
  -> PracticeSetQuestion
  -> FullPracticeTestQuestion

FullPracticeTest
  -> FullPracticeTestModule
  -> FullPracticeTestQuestion
  -> FullPracticeTestScoreConversion

IngestBatch
  -> IngestSourceFile
  -> IngestPageArtifact
  -> IngestImageArtifact
  -> IngestQuestionCandidate
  -> IngestAnswerCandidate
  -> IngestCandidateImageLink
  -> IngestReviewSession
  -> IngestJobEvent
  -> IngestIncident
  -> IngestPromotionArtifact
```

Estados importantes:

| Entidad/Campo | Valores |
|---|---|
| `User.role` | `ADMIN`, `TEACHER`, `STUDENT`, `PARENT` |
| `User.validationStatus` | `PENDING`, `APPROVED`, `REJECTED` |
| `Question.type` | `MC`, `NUMERIC` |
| `Question.status` | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| `Question.difficulty` | `EASY`, `MEDIUM`, `HARD` |
| `PracticeSet.status` | `DRAFT`, `PUBLISHED`, `BLOCKED`, `ARCHIVED` |
| `Attempt.status` | `IN_PROGRESS`, `SUBMITTED`, `INVALIDATED` |
| `FullPracticeTest.status` | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| `FullPracticeTestAttempt.status` | `IN_PROGRESS`, `SUBMITTED` |
| `TaxonomyNode.type` | `AREA`, `DOMAIN`, `SKILL`, `SUBSKILL` |
| `IngestBatch.status` | `PENDING`, `SCANNING`, `PROCESSING`, `COMPLETED`, `FAILED` |
| `IngestQuestionCandidate.status` | `NEEDS_REVIEW`, `READY`, `REVIEWED`, `REJECTED` |
| `IngestQuestionCandidate.promotionStatus` | `NOT_PROMOTED`, `EDITING`, `PROMOTED`, `REJECTED` |
| `IngestIncident.status` | `OPEN`, `RESOLVED` |

---

## Rutas Principales

### Admin

| Ruta | Uso |
|---|---|
| `/admin/users` | Validación y activación de usuarios. |
| `/admin/teachers` | Maestro de profesores. |
| `/admin/programs` | Maestro de programas. |
| `/admin/settings` | Parámetros, permisos y API key Mistral. |
| `/admin/taxonomy` | Árbol académico recursivo. |
| `/admin/import` | Importación masiva no IA. |
| `/admin/import/ai` | Wizard de ingesta IA, revisión, incidencias y promoción. |
| `/admin/logs` | Auditoría. |

### Teacher

| Ruta | Uso |
|---|---|
| `/teacher` | Dashboard. |
| `/teacher/students/invite` | Invitar alumnos y registrar padre si aplica. |
| `/teacher/students/[studentId]` | Detalle del alumno. |
| `/teacher/students/[studentId]/assign` | Asignar Practice Sets. |
| `/teacher/students/[studentId]/report` | Reporte del alumno. |
| `/teacher/parents` | Maestro de padres y asociaciones. |
| `/teacher/questions` | Repositorio de preguntas. |
| `/teacher/questions/new` | Crear pregunta o partir desde candidato de ingesta. |
| `/teacher/practice-sets` | Maestro de Practice Sets. |
| `/teacher/practice-sets/new` | Crear Practice Set o importar cuestionario. |
| `/teacher/full-tests` | Maestro de Full Practice Tests. |
| `/teacher/full-tests/new` | Crear Full Practice Test o importar cuestionario. |
| `/teacher/full-tests/scoring` | Explicación del cálculo del puntaje SAT (fórmula y ejemplos). |
| `/teacher/content` | Mapa de contenido por Math / R&W. |
| `/teacher/materials` | Materiales de estudio. |
| `/teacher/analytics` | Analytics. |
| `/teacher/compare` | Comparación de alumnos activos. |

### Student

| Ruta | Uso |
|---|---|
| `/student` | Dashboard. |
| `/student/program` | Programa o inscripción. |
| `/student/content-map` | Mapa Math / R&W por taxonomía y dificultad. |
| `/student/practice-sets` | Practice Sets disponibles/asignados. |
| `/student/practice/assignment/[assignmentId]` | Player de Practice Set. |
| `/student/results/[attemptId]` | Resultado de Practice Set. |
| `/student/full-tests` | Full Practice Tests asignados. |
| `/student/full-tests/[assignmentId]` | Player SAT-like. |
| `/student/full-tests/results/[attemptId]` | Resultado del full test. |
| `/student/history` | Historial. |
| `/student/materials` | Materiales. |

### Parent

| Ruta | Uso |
|---|---|
| `/parent` | Progreso de hijos vinculados. |
| `/parent/access` | Acceso por enlace cuando aplica. |

---

## Setup Local

### Requisitos

- Node.js 24+
- npm
- Docker y Docker Compose para usar el servicio FastAPI

### Instalación

```bash
npm install
npm run prisma:generate
npx prisma migrate deploy
npm run db:seed
```

### Desarrollo sin Docker

```bash
npm run dev
```

Abre `http://localhost:3000`.

### Desarrollo con Docker

```bash
docker compose up -d
```

Servicios:

- Web: `http://localhost:3000`
- Ingesta FastAPI: `http://localhost:8000` dentro del contenedor y `http://ingest-service:8000` desde la app web.

El `docker-compose.yml` usa bind mount:

```text
.:/app
DATABASE_URL=file:./dev.db
```

Por tanto, la base activa persistida es `./dev.db` en la raíz del proyecto. No usar `prisma/dev.db` como referencia operativa.

Para detener sin borrar datos:

```bash
docker compose stop
```

Para levantar nuevamente sin perder datos:

```bash
docker compose up -d
```

No usar `docker compose down -v` salvo que se quiera eliminar volúmenes. En este proyecto la BD principal está persistida por archivo local `./dev.db`.

---

## Variables de Entorno

Base mínima:

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="replace-with-a-random-secret"
AUTH_URL="http://localhost:3000"
SECRET_ENCRYPTION_KEY="replace-with-a-long-secret"
INTERNAL_INGEST_TOKEN="replace-in-production"
AI_INGEST_SERVICE_URL="http://localhost:8000"
MISTRAL_API_KEY=""
MISTRAL_OCR_MODEL="mistral-ocr-latest"
MISTRAL_STRUCTURING_MODEL="mistral-large-latest"
BACKUP_DIR="./backups"
```

Email:

```env
EMAIL_FROM="noreply@yourdomain.com"
EMAIL_HOST="smtp-relay.brevo.com"
EMAIL_PORT="587"
EMAIL_USER="your-brevo-smtp-login"
EMAIL_PASS="your-brevo-smtp-key"
```

Calculadora:

```env
NEXT_PUBLIC_CALCULATOR_PROVIDER="desmos_sat"
NEXT_PUBLIC_DESMOS_API_KEY=""
NEXT_PUBLIC_DESMOS_API_URL="https://www.desmos.com/api/v1.12/calculator.js"
NEXT_PUBLIC_DESMOS_SAT_URL="https://www.desmos.com/testing/sat/calculator"
NEXT_PUBLIC_GEOGEBRA_URL="https://www.geogebra.org/calculator"
NEXT_PUBLIC_GEOGEBRA_DEPLOY_URL="https://www.geogebra.org/apps/deployggb.js"
NEXT_PUBLIC_GEOGEBRA_APP_NAME="graphing"
```

Si no hay SMTP válido, los flujos de email imprimen enlaces en consola para desarrollo.

---

## Correo electrónico (SMTP)

El envío es **SMTP genérico** vía Nodemailer (`lib/email.ts`), así que sirve cualquier
proveedor (Brevo, SendGrid, Mailgun, Amazon SES, Gmail…). El default sugerido es
**Brevo**. La conexión TLS es implícita solo en el puerto `465`; en `587` se usa STARTTLS.

### Cómo configurarlo (dos métodos)

Se puede configurar de dos formas; **la BD tiene prioridad sobre el entorno, campo por
campo** (`lib/smtp-settings.ts`):

1. **Desde la app — `/admin/settings`, sección SMTP** (recomendado en producción).
   Se guarda en la tabla `AppSetting`; la **contraseña se cifra en reposo**
   (AES-256-GCM). Campos: host, puerto, usuario, remitente (`from`) y contraseña.
2. **Por variables de entorno** (fallback), como en la sección anterior:
   `EMAIL_FROM`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`.

El SMTP se considera **configurado** solo cuando hay host, usuario, remitente y
contraseña. Si falta alguno, los correos no fallan: se omiten y el enlace se imprime en
consola (`[EMAIL:SKIPPED]`), útil en desarrollo.

### Pasos con Brevo

1. Crear cuenta en Brevo y **verificar el remitente/dominio** de `EMAIL_FROM` (obligatorio,
   o el proveedor rechaza el envío).
2. En Brevo → **SMTP & API → SMTP**: copiar el **login SMTP** (un email) y generar una
   **SMTP key** (⚠️ es distinta de la API key).
3. Usar `smtp-relay.brevo.com` y puerto `587`.
4. Cargar esos datos en `/admin/settings` **o** en el `.env`.

### Qué correos envía

Invitación de alumno, consentimiento de padre/tutor, invitación de padre, **reporte de
progreso al padre** y restablecimiento de contraseña (`lib/email.ts`).

### En producción (deploy GCP)

`EMAIL_PASS` es secreto y va a **Secret Manager** (`email-pass`, cargado por
`deploy/load-secrets.sh`); el resto de `EMAIL_*` no son secretos y se renderizan a
`/data/app.env` desde variables de Terraform (`deploy/vm-startup.sh`). Alternativamente,
puede dejarse todo sin configurar en el deploy y ajustarse luego desde `/admin/settings`.

---

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Next dev server con webpack. |
| `npm run build` | Build de producción. |
| `npm run start` | Next start. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | TypeScript sin emitir. |
| `npm run prisma:validate` | Valida schema Prisma. |
| `npm run prisma:generate` | Genera cliente Prisma en `app/generated/prisma`. |
| `npm run quality` | Prisma, lint, typecheck, QA y build. |
| `npm run qa:p0` | Reglas estáticas P0. |
| `npm run qa:authz` | Verificación estática de autorización. |
| `npm run qa:edge` | Verificación estática de edge cases. |
| `npm run db:seed` | Ejecuta seed. |
| `npm run db:reset` | Reset de migraciones y seed. |
| `npm run db:backup` | Backup de SQLite. |
| `BACKUP_FILE=./backups/dev.db.bak npm run db:restore` | Restaura backup. |
| `npm run db:align-ingest-taxonomy` | Realinea metadata staging de Practice Sets contra taxonomía SAT oficial. |
| `npm run notifications:generate` | Genera notificaciones programadas. |
| `npm run sample:promote` | Promueve una muestra de candidatos de ingesta para demo. |
| `npm run demo:verify` | Verifica flujo demo cliente. |

---

## Usuarios Seed

| Rol | Email | Password | Estado |
|---|---|---|---|
| Admin | `admin@sat.com` | `admin123` | APPROVED |
| Teacher | `teacher@sat.com` | `teacher123` | APPROVED |
| Teacher pendiente | `teacher.pending@sat.com` | `teacher123` | PENDING |
| Parent | `parent@sat.com` | `parent123` | APPROVED |
| Student | `student1@sat.com` | `student123` | APPROVED |
| Student | `student2@sat.com` | `student123` | APPROVED |
| Student | `student3@sat.com` | `student123` | APPROVED |
| Student | `student4@sat.com` | `student123` | APPROVED |
| Student pendiente | `student.pending@sat.com` | `student123` | PENDING |
| Student rechazado | `student.rejected@sat.com` | `student123` | REJECTED |

El seed incluye:

- `SAT Core Program`.
- Taxonomía SAT Math y Reading & Writing.
- Practice Sets base.
- Full Practice Tests mock publicados.
- Intentos y asignaciones para ver progreso/reportes.
- Padre vinculado a alumno.
- Sin grupos por defecto.

---

## Archivos de Carga Esperados

La carpeta `files_to_load/` puede contener estructuras como:

```text
files_to_load/
  PRACTICE EXERCISES/
    EXERCISES MATH/
      ADVANCED MATH/
        NON LINEAR FUNCTIONS/
          NON LINEAR FUNCTIONS HARD.pdf
          ANS NON LINEAR FUNCT HARD .pdf
    EXERCISES READING/
      WORDS IN CONTEXT/
        ...
    EXERCISES WRITING/
      Boundaries/
        Boundaries Hard/
          ...
  MOCK EXAMS/
    TEST 2/
      MATH/
        Innov. Test 2 Math Mod 1, 2B REV.pdf
      READING AND WRITING/
        INNOVATOR TEST 2 R&W MOD 1 REV.pdf
      Test2 Math Answer Exp.docx
      Test2 RW Answer Explanations.docx
```

La clasificación final busca normalizar esas rutas a:

```text
Practice Sets:
  Section -> Domain -> Skill/Subskill -> Topic -> Difficulty -> Question
  (hoy la ingesta resuelve hasta Skill; el nivel Topic bajo el skill es trabajo pendiente)

Full Practice Tests:
  Test Number -> Section -> Module -> Question -> Answer/Explanation
```

---

## Seguridad y Operación

- Cambiar `AUTH_SECRET`, `SECRET_ENCRYPTION_KEY` e `INTERNAL_INGEST_TOKEN` fuera de desarrollo.
- No exponer `ingest-service` públicamente sin proxy/autenticación; está pensado como servicio interno.
- Mantener `INTERNAL_INGEST_TOKEN` sincronizado entre web y FastAPI.
- Usar `SECRET_ENCRYPTION_KEY` estable; si cambia, no se podrá descifrar la API key Mistral guardada.
- Programar backups de `./dev.db` si se usa SQLite en operación.
- Migrar uploads locales (`public/uploads/*` y staging privado) a storage persistente externo para producción.
- No ejecutar `db:reset` en una BD con ingesta o revisión valiosa.

---

## Documentos Relacionados

- `ARQUITECTURA_FUNCIONAL_Y_MODELO_DATOS.md`: arquitectura funcional y modelo de datos de referencia.
- `ALCANCE_Y_CARACTERISTICAS_CONSOLIDADO.md`: alcance funcional consolidado.
- `hallazgos.md`: hallazgos revisados durante hardening.
- `plan.md`: plan de interfaz MVP.
- `PROFESSIONALIZATION_PLAN.md`: plan técnico de profesionalización.
- `Integracion-calculadora-desmos.md`: integración de calculadora.
- `usos-desmos-latex.md`: notas de LaTeX/Desmos.
- `sugerencias-gcp-bucket.md`: recomendación para almacenamiento externo.
