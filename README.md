# SAT Practice Platform

Plataforma web para preparación SAT. El proyecto implementa portales por rol para administrar alumnos, programas, contenido académico, Practice Sets, Full Practice Tests, reportes, notificaciones y seguimiento de progreso.

El alcance funcional consolidado del producto está documentado en [ALCANCE_Y_CARACTERISTICAS_CONSOLIDADO.md](/home/turista/Descargas/Github/sat-manager-platform/ALCANCE_Y_CARACTERISTICAS_CONSOLIDADO.md). Este README describe el estado técnico actual del repositorio.

---

## Estado actual

### Implementado

- Autenticación con NextAuth Credentials y sesiones JWT.
- Roles `ADMIN`, `TEACHER`, `STUDENT` y `PARENT`.
- Validación/aprobación de usuarios por admin.
- Invitación y activación de estudiantes por token.
- Flujo de consentimiento parental para menores.
- Recuperación y cambio de contraseña.
- Programas con ciclo de vida, profesores asignados e inscripciones de alumnos.
- Grupos de alumnos.
- Portal de profesor con dashboard, alumnos, grupos, programas, padres, contenido, subskills, materiales, Practice Sets, Full Practice Tests, scoring y comparación.
- Portal de alumno con dashboard, programa/inscripción, mapa de contenido, Practice Sets, resultados, historial, materiales y Full Practice Tests.
- Portal de padre con progreso reciente de alumnos vinculados.
- Portal admin para usuarios, profesores, programas, importación y auditoría.
- Banco de preguntas con alternativas, respuesta numérica, dificultad, estado y render de matemáticas con KaTeX.
- Practice Sets con asignación, bloqueo/desbloqueo, solicitud de desbloqueo, player, autosave, submit, scoring y revisión.
- Full Practice Tests con módulos SAT-like, asignación, player, submit y conversión de puntaje.
- Notificaciones internas.
- Avatar de usuario con carga local en `public/uploads/avatars`.
- AuditLog para eventos administrativos y de programa.
- Backup local de SQLite.

### Notas de alcance

- El MVP de negocio prioriza Practice Sets; Full Practice Tests ya tienen base funcional implementada, pero deben validarse como flujo completo antes de considerarlos cerrados.
- No hay `middleware.ts`; la protección de rutas vive en layouts y helpers server-side para evitar problemas de Edge Runtime con `better-sqlite3`.
- El almacenamiento de avatars es local para desarrollo. Producción debería reemplazar `lib/storage.ts` por un bucket privado o servicio de objetos.
- El import masivo existe como ruta/admin UI, pero la calidad de importación depende del formato de datos usado.

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16.2, App Router, webpack |
| Lenguaje | TypeScript 5, React 19 |
| Auth | NextAuth v5 beta, Credentials provider, JWT |
| Base de datos | SQLite, `better-sqlite3`, Prisma driver adapter |
| ORM | Prisma 7, cliente TypeScript generado |
| Estilos | Tailwind CSS v4 |
| UI | Radix UI, class-variance-authority, lucide-react |
| Tablas | TanStack Table v8 |
| Formularios | React Hook Form, Zod v4 |
| Matemáticas | KaTeX, react-katex |
| Email | Nodemailer, Brevo SMTP |
| Runtime objetivo | Node.js 24+ |

---

## Roles

| Rol | Portal | Capacidades principales |
|---|---|---|
| `ADMIN` | `/admin/*`, `/teacher/*` | Validar usuarios, administrar profesores/programas, importar contenido, ver logs, acceso teacher. |
| `TEACHER` | `/teacher/*` | Gestionar alumnos, programas propios, grupos, contenido, Practice Sets, Full Practice Tests, asignaciones y reportes. |
| `STUDENT` | `/student/*` | Resolver asignaciones, ver programa, solicitar inscripción, revisar resultados, historial y materiales. |
| `PARENT` | `/parent` | Ver progreso reciente de alumnos vinculados. |

---

## Rutas principales

### Auth

| Ruta | Uso |
|---|---|
| `/login` | Inicio de sesión. |
| `/auth/activate?token=...` | Activación de cuenta invitada. |
| `/auth/parent-consent?token=...` | Consentimiento parental. |
| `/auth/forgot-password` | Solicitud de reset. |
| `/auth/reset-password?token=...` | Reset de contraseña. |
| `/auth/change-password` | Cambio de contraseña con sesión activa. |
| `/auth/pending-validation` | Estado de cuenta pendiente/rechazada. |

### Student

| Ruta | Uso |
|---|---|
| `/student` | Dashboard con pendientes, resultados recientes y estado de programa. |
| `/student/program` | Programa actual o solicitud de inscripción. |
| `/student/content-map` | Mapa académico por sección, dominio y tema. |
| `/student/content-map/[topicId]/[difficulty]` | Practice Sets por tópico/dificultad. |
| `/student/practice/assignment/[assignmentId]` | Player de Practice Set asignado. |
| `/student/results/[attemptId]` | Resultado y revisión de intento. |
| `/student/history` | Historial de intentos. |
| `/student/materials` | Materiales de estudio publicados. |
| `/student/full-tests` | Full Practice Tests asignados. |
| `/student/full-tests/[assignmentId]` | Player de Full Practice Test. |
| `/student/full-tests/results/[attemptId]` | Resultado de Full Practice Test. |

### Teacher

| Ruta | Uso |
|---|---|
| `/teacher` | Dashboard operativo. |
| `/teacher/students/invite` | Invitar estudiantes. |
| `/teacher/students/[studentId]` | Detalle de alumno. |
| `/teacher/students/[studentId]/edit` | Editar alumno. |
| `/teacher/students/[studentId]/assign` | Asignar Practice Sets. |
| `/teacher/students/[studentId]/attempts/[attemptId]` | Ver intento, comentar, reabrir o invalidar. |
| `/teacher/students/[studentId]/report` | Reporte individual. |
| `/teacher/groups` | Gestión de grupos. |
| `/teacher/programs` | Programas gestionados por teacher. |
| `/teacher/parents` | Padres vinculados. |
| `/teacher/content` | Vista de taxonomía y contenido. |
| `/teacher/questions` | Banco de preguntas. |
| `/teacher/questions/new` | Crear pregunta. |
| `/teacher/practice-sets/new` | Crear Practice Set. |
| `/teacher/analytics` | Analytics por pregunta, topic, dificultad y tiempo. |
| `/teacher/full-tests` | Full Practice Tests. |
| `/teacher/full-tests/new` | Crear Full Practice Test. |
| `/teacher/full-tests/scoring` | Tabla de conversión SAT. |
| `/teacher/materials` | Materiales de estudio. |
| `/teacher/subskills` | Subskills por tema. |
| `/teacher/compare` | Comparación privada entre estudiantes. |
| `/teacher/impersonate/[studentId]` | Impersonation de alumno. |

### Admin

| Ruta | Uso |
|---|---|
| `/admin/users` | Validación de usuarios. |
| `/admin/teachers` | Activación/desactivación de profesores. |
| `/admin/programs` | Maestro de programas. |
| `/admin/import` | Importación masiva. |
| `/admin/logs` | Últimos 200 eventos de auditoría. |

### Shared

| Ruta | Uso |
|---|---|
| `/notifications` | Centro de notificaciones. |
| `/parent` | Dashboard de padre. |

---

## Flujos funcionales

### Invitación y activación de estudiante

```text
Teacher/Admin -> POST /api/students/invite
  -> crea InviteToken con expiración de 7 días
  -> envía email de activación al estudiante
  -> si es menor o tiene datos de padre, genera flujo de consentimiento

Parent -> /auth/parent-consent?token=...
  -> aprueba vínculo y guarda parentConsentAt / parentConsentIp

Student -> /auth/activate?token=...
  -> crea usuario STUDENT
  -> crea o vincula ProgramEnrollment si aplica
  -> marca token como usado
```

### Login y autorización

```text
POST /api/auth/[...nextauth]
  -> valida email/password
  -> exige active=true
  -> emite JWT con id, email, role, validationStatus

Layouts protegidos
  -> session nula: redirect /login
  -> user inactive: redirect /login
  -> validationStatus != APPROVED: redirect /auth/pending-validation
  -> rol incorrecto: redirect al portal correspondiente
```

### Practice Set

```text
Teacher -> POST /api/assignments
  -> crea Assignment para uno o varios estudiantes
  -> opcional: dueDate, unlockAt, locked
  -> notifica al estudiante

Student -> /student/practice/assignment/[assignmentId]
  -> busca Attempt IN_PROGRESS
  -> si no existe, crea intento nuevo

Player -> POST /api/attempts/[attemptId]/autosave
  -> guarda respuesta, pregunta actual, tiempo, marcas, notas y opciones eliminadas

Submit -> POST /api/attempts/[attemptId]/submit
  -> compara respuestas
  -> marca Attempt SUBMITTED
  -> actualiza Assignment COMPLETED
  -> notifica a profesores
```

### Full Practice Test

```text
Teacher -> POST /api/full-practice-tests
  -> crea test, módulos y preguntas

Teacher -> POST /api/full-practice-tests/[testId]/assign
  -> asigna test a estudiantes

Student -> /student/full-tests/[assignmentId]
  -> crea o continúa FullPracticeTestAttempt
  -> resuelve por módulos

Submit -> POST /api/full-practice-tests/attempts/[attemptId]/submit
  -> calcula raw correct por sección
  -> usa FullPracticeTestScoreConversion
  -> guarda RW, Math y Total
```

---

## Modelo de datos

Resumen conceptual:

```text
User (ADMIN | TEACHER | STUDENT | PARENT)
  -> ProgramTeacher / ProgramEnrollment
  -> GroupMembership
  -> Assignment -> PracticeSet -> PracticeSetQuestion -> Question -> QuestionOption
  -> Attempt -> AttemptAnswer
  -> FullPracticeTestAssignment -> FullPracticeTestAttempt -> FullPracticeTestAnswer
  -> ParentStudent
  -> Notification
  -> AuditLog

Program
  -> ProgramTeacher
  -> ProgramEnrollment
  -> InviteToken

Section -> Domain -> Topic -> Subskill
                         -> Question
                         -> PracticeSet
                         -> StudyMaterial

FullPracticeTest
  -> FullPracticeTestModule
  -> FullPracticeTestQuestion
  -> FullPracticeTestScoreConversion
```

Enums y valores codificados como strings en SQLite:

| Campo | Valores |
|---|---|
| `User.role` | `STUDENT`, `TEACHER`, `ADMIN`, `PARENT` |
| `User.validationStatus` | `PENDING`, `APPROVED`, `REJECTED` |
| `ProgramEnrollment.status` | `PENDING`, `APPROVED`, `REJECTED` |
| `ProgramEnrollment.parentApprovalStatus` | `PENDING`, `APPROVED`, `REJECTED`, `null` |
| `Question.type` | `MC`, `NUMERIC` |
| `Question.difficulty` / `PracticeSet.difficulty` | `EASY`, `MEDIUM`, `HARD` |
| `Question.status` | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| `PracticeSet.status` | `DRAFT`, `PUBLISHED`, `BLOCKED`, `ARCHIVED` |
| `PracticeSet.explanationVisibility` | `IMMEDIATE`, `AFTER_FINISH`, `HIDDEN` |
| `Attempt.status` | `IN_PROGRESS`, `SUBMITTED`, `INVALIDATED` |
| `FullPracticeTest.status` | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| `FullPracticeTestAttempt.status` | `IN_PROGRESS`, `SUBMITTED` |

---

## Estructura del proyecto

```text
sat-web/
├── app/
│   ├── (auth)/                    # Login, activación, reset, consentimiento parental
│   ├── (student)/student/         # Portal alumno
│   ├── (teacher)/teacher/         # Portal profesor/admin
│   ├── (parent)/parent/           # Portal padre
│   ├── admin/                     # Usuarios, profesores, programas, import, logs
│   ├── api/                       # Route handlers
│   ├── generated/prisma/          # Cliente Prisma generado
│   ├── notifications/             # Notificaciones
│   └── page.tsx                   # Redirect raíz según sesión/rol
├── components/
│   ├── ui/                        # Primitivos UI
│   ├── avatar.tsx
│   ├── math-content.tsx
│   ├── nav-student.tsx
│   ├── nav-teacher.tsx
│   └── notification-bell.tsx
├── lib/
│   ├── auth.ts / auth.config.ts
│   ├── prisma.ts
│   ├── rbac.ts
│   ├── email.ts
│   ├── notify.ts / notifications.ts
│   ├── storage.ts
│   ├── observability.ts
│   └── utils.ts
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── public/uploads/avatars/        # Avatars locales de desarrollo
├── scripts/backup-db.mjs
└── types/next-auth.d.ts
```

---

## Setup local

### Requisitos

- Node.js 24+
- npm

### Instalación

```bash
npm install
```

Para instalación reproducible:

```bash
npm ci
```

### Variables de entorno

Usar [.env.example](/home/turista/Descargas/Github/sat-manager-platform/.env.example) como base:

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="replace-with-a-random-secret"
AUTH_URL="http://localhost:3000"
CORS_ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"

EMAIL_FROM="noreply@yourdomain.com"
EMAIL_HOST="smtp-relay.brevo.com"
EMAIL_PORT="587"
EMAIL_USER="your-brevo-smtp-login"
EMAIL_PASS="your-brevo-smtp-key"

BACKUP_DIR="./backups"

NEXT_PUBLIC_CALCULATOR_PROVIDER="desmos_sat"
NEXT_PUBLIC_CALCULATOR_PRACTICE_SETS="true"
NEXT_PUBLIC_CALCULATOR_FULL_TESTS="true"
NEXT_PUBLIC_DESMOS_API_KEY=""
NEXT_PUBLIC_DESMOS_API_URL="https://www.desmos.com/api/v1.12/calculator.js"
NEXT_PUBLIC_DESMOS_SAT_URL="https://www.desmos.com/testing/sat/calculator"
NEXT_PUBLIC_GEOGEBRA_URL="https://www.geogebra.org/calculator"
NEXT_PUBLIC_GEOGEBRA_DEPLOY_URL="https://www.geogebra.org/apps/deployggb.js"
NEXT_PUBLIC_GEOGEBRA_APP_NAME="graphing"
```

Notas:

- `EMAIL_FROM` debe estar verificado en Brevo.
- Si no hay variables SMTP válidas, los flujos de email imprimen links en consola para desarrollo.
- Los avatars se guardan localmente en `public/uploads/avatars`.
- En producción, programar `npm run db:backup` al menos diario. El Excel tiene una decisión operativa de 15 días, pero `RNF-15` exige respaldo automático diario como estándar de Fase 1.
- `NEXT_PUBLIC_CALCULATOR_PROVIDER` acepta `desmos_sat`, `desmos_api`, `geogebra`, `geogebra_api`, `local_2d`, `local_3d` o `none`.

### Base de datos

Aplicar migraciones:

```bash
npx prisma migrate deploy
```

Generar cliente Prisma:

```bash
npm run prisma:generate
```

Seed:

```bash
npm run db:seed
```

Reset completo con seed:

```bash
npm run db:reset
```

### Servidor de desarrollo

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000). La raíz redirige según la sesión y rol.

---

## Usuarios del seed

### Admin

| Email | Password | Estado |
|---|---|---|
| `admin@sat.com` | `admin123` | APPROVED |

### Profesores

| Email | Password | Estado | Programa |
|---|---|---|---|
| `teacher@sat.com` | `teacher123` | APPROVED | SAT Core Program |
| `teacher.pending@sat.com` | `teacher123` | PENDING | Sin programa |

### Padres

| Email | Password | Estado | Vínculo |
|---|---|---|---|
| `parent@sat.com` | `parent123` | APPROVED | Ana Torres |
| `parent.pending@sat.com` | `parent123` | PENDING | Sin alumno aprobado |
| `parent.minor@sat.com` | `parent123` | APPROVED | Carlos Mendoza y Valeria Cano |

### Alumnos

| Email | Password | Estado cuenta | Programa / inscripción |
|---|---|---|---|
| `student1@sat.com` | `student123` | APPROVED | APPROVED en SAT Core |
| `student2@sat.com` | `student123` | APPROVED | APPROVED en SAT Core |
| `student3@sat.com` | `student123` | APPROVED | APPROVED en SAT Core |
| `student4@sat.com` | `student123` | APPROVED | APPROVED en SAT Core |
| `student.pending@sat.com` | `student123` | PENDING | Sin programa |
| `student.rejected@sat.com` | `student123` | REJECTED | Cuenta rechazada |
| `student.noenroll@sat.com` | `student123` | APPROVED | Sin inscripción; puede solicitar |
| `student.enrollpending@sat.com` | `student123` | APPROVED | Inscripción PENDING |
| `student.minor@sat.com` | `student123` | APPROVED | Menor; parentApprovalStatus PENDING |
| `student.minor2@sat.com` | `student123` | APPROVED | Menor; padre aprobó, espera profesor |

### Programa seed

| Campo | Valor |
|---|---|
| ID | `program-sat-core` |
| Nombre | SAT Core Program |
| Inicio | 2026-04-01 |
| Fin | Sin fecha |
| Estado computado | Active |
| Profesor activo | `teacher@sat.com` |

### Contenido seed

Taxonomía precargada:

- Mathematics: Algebra, Advanced Math, Problem Solving and Data Analysis, Geometry and Trigonometry.
- Reading & Writing: Information and Ideas, Craft and Structure, Expression of Ideas, Standard English Conventions.
- Practice Sets base para Linear Equations con estados de assignment, locked, unlock request, submitted attempt y omitted answer.
- 8 Full Practice Tests tipo mock publicados.
- Cada Full Practice Test tiene 4 módulos: RW Module 1, RW Module 2, Math Module 1 y Math Module 2.
- Distribución por mock: RW 27+27 y Math 22+22, para 98 preguntas fijas por test.
- Total seed FPT: 32 módulos y 784 relaciones módulo-pregunta.
- Tabla de conversión SAT seed: RW raw 0-54 y MATH raw 0-44.
- Asignaciones FPT seed: Ana completed con intento submitted, Luis pending, Sofia in progress.
- Reading & Writing: Information and Ideas, Craft and Structure, Expression of Ideas, Standard English Conventions.

Practice Sets:

| Practice Set | Tópico | Dificultad | Preguntas | Asignación |
|---|---|---|---|---|
| Linear Equations — Easy #1 | Linear Equations | EASY | 3 | Ana Torres, Luis Mora |
| Linear Equations — Medium #1 | Linear Equations | MEDIUM | 2 | Ana Torres |

Grupos:

| Grupo | Horario | Miembros seed |
|---|---|---|
| Group A | Monday/Wednesday 9am | Ana Torres, Luis Mora |
| Group B | Tuesday/Thursday 3pm | Sofia Rea, Carlos Vera |

---

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con `next dev --webpack`. |
| `npm run build` | Build de producción. |
| `npm run start` | Servidor de producción. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | TypeScript sin emitir archivos. |
| `npm run prisma:validate` | Valida `prisma/schema.prisma`. |
| `npm run prisma:generate` | Genera cliente Prisma en `app/generated/prisma`. |
| `npm run quality` | Prisma validate/generate, lint, typecheck, QA estática y build. |
| `npm run qa:p0` | Verificación estática de controles P0 (scope/auth/snapshots/import). |
| `npm run qa:authz` | Verificación estática de autorización por rol/scope. |
| `npm run qa:edge` | Verificación estática de edge cases de producto. |
| `npm run db:seed` | Ejecuta `prisma/seed.ts`. |
| `npm run db:reset` | Reset de migraciones + seed. |
| `npm run db:backup` | Copia SQLite a `BACKUP_DIR`. |
| `BACKUP_FILE=./backups/dev.db.example.bak npm run db:restore` | Restaura SQLite desde backup y crea copia previa `pre-restore`. |
| `npm run notifications:generate` | Genera recordatorios idempotentes de due date, overdue y unlock programado. |

---

## API relevante

| Endpoint | Método | Uso |
|---|---|---|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth. |
| `/api/auth/activate` | POST | Activar invitación. |
| `/api/auth/invite-info` | GET | Leer datos públicos del token. |
| `/api/auth/parent-consent` | GET/POST | Consentimiento parental. |
| `/api/auth/forgot-password` | POST | Crear token de reset. |
| `/api/auth/reset-password` | POST | Resetear password. |
| `/api/auth/change-password` | POST | Cambiar password con sesión. |
| `/api/students/invite` | POST | Invitar estudiante. |
| `/api/students/[studentId]` | PUT | Editar estudiante. |
| `/api/students/[studentId]/toggle-active` | POST | Activar/desactivar estudiante. |
| `/api/admin/users/[userId]/validation` | POST | Aprobar/rechazar usuario. |
| `/api/admin/teachers/[teacherId]/toggle-active` | POST | Activar/desactivar profesor. |
| `/api/programs` | GET/POST | Listar/crear programas. |
| `/api/programs/[id]` | GET/PATCH/DELETE | Leer, editar o retirar programa. |
| `/api/programs/[id]/enroll` | POST | Solicitar inscripción. |
| `/api/programs/[id]/enrollments/[studentId]` | PATCH | Aprobar/rechazar/retirar inscripción. |
| `/api/programs/[id]/enrollments/[studentId]/parent-approval` | PATCH | Aprobar inscripción como padre. |
| `/api/programs/[id]/teachers/[teacherId]` | PATCH | Asignar/retirar profesor. |
| `/api/groups` | POST | Crear grupo. |
| `/api/groups/[groupId]/members` | POST | Agregar miembro. |
| `/api/groups/[groupId]/members/[userId]` | DELETE | Retirar miembro. |
| `/api/questions` | POST | Crear pregunta. |
| `/api/questions/[questionId]` | PUT | Editar pregunta. |
| `/api/practice-sets` | POST | Crear Practice Set. |
| `/api/practice-sets/[practiceSetId]` | PUT | Editar Practice Set. |
| `/api/assignments` | POST | Asignar Practice Sets. |
| `/api/attempts/[attemptId]/autosave` | POST | Autosave. |
| `/api/attempts/[attemptId]/submit` | POST | Enviar y calificar. |
| `/api/attempts/[attemptId]/comment` | POST | Comentario profesor. |
| `/api/attempts/[attemptId]/reopen` | POST | Reabrir intento. |
| `/api/attempts/[attemptId]/invalidate` | POST | Invalidar intento. |
| `/api/unlock-requests` | POST | Solicitar desbloqueo. |
| `/api/unlock-requests/[requestId]` | PUT | Resolver desbloqueo. |
| `/api/full-practice-tests` | POST | Crear Full Practice Test. |
| `/api/full-practice-tests/[testId]/assign` | POST | Asignar FPT. |
| `/api/full-practice-tests/attempts/[attemptId]/submit` | POST | Enviar FPT. |
| `/api/full-practice-tests/scoring` | POST | Guardar tabla de conversión SAT. |
| `/api/materials` | POST | Crear material. |
| `/api/materials/[materialId]` | PATCH | Editar/archivar material. |
| `/api/notifications` | GET/PATCH | Listar y marcar leídas. |
| `/api/parents` | POST | Crear/vincular padre. |
| `/api/profile/avatar` | POST/DELETE | Subir o borrar avatar. |
| `/api/reports/students/[studentId]/pdf` | GET | Reporte individual HTML/PDF route. |
| `/api/subskills` | POST | Crear subskill. |
| `/api/subskills/[subskillId]` | PUT/DELETE | Editar o borrar subskill. |
| `/api/admin/import` | POST | Importación masiva. |

---

## Arquitectura y decisiones técnicas

### Auth sin middleware

La aplicación evita `middleware.ts` porque `better-sqlite3` y el adapter de Prisma requieren Node runtime, no Edge. La autorización se aplica en:

- `app/(teacher)/layout.tsx`
- `app/(student)/layout.tsx`
- `app/(parent)/layout.tsx`
- helpers en `lib/rbac.ts`

### Prisma 7 con SQLite adapter

El cliente se genera en `app/generated/prisma/` usando:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../app/generated/prisma"
}
```

`lib/prisma.ts` instancia `PrismaClient` con `@prisma/adapter-better-sqlite3`.

### Paquetes nativos externos

`next.config.ts` define:

```ts
serverExternalPackages: [
  "better-sqlite3",
  "@prisma/adapter-better-sqlite3",
  "@prisma/client",
  "bcryptjs",
]
```

### Render dinámico

Los layouts protegidos usan `export const dynamic = "force-dynamic"` para validar sesión y usuario en cada request.

### Notificaciones

Las notificaciones se guardan en `Notification` y se consumen desde `/api/notifications`. El componente de campana está en `components/notification-bell.tsx`.

### Calculadora matemática

`components/math-tool-panel.tsx` centraliza la calculadora usada en Practice Sets de Math y módulos Math de Full Practice Test. El proveedor se controla con `NEXT_PUBLIC_CALCULATOR_PROVIDER`:

- `desmos_sat`: iframe SAT de Desmos, sin API key.
- `desmos_api`: carga `GraphingCalculator` con `NEXT_PUBLIC_DESMOS_API_KEY`; si no hay key, cae a `desmos_sat`.
- `geogebra`: iframe público de GeoGebra.
- `geogebra_api`: carga `deployggb.js` y `GGBApplet`.
- `local_2d` / `local_3d`: fallback local sin servicio externo.
- `none`: desactiva la calculadora.

### Auditoría

`AuditLog` registra eventos como creación/edición de programas, aprobación/rechazo/retiro de inscripciones, solicitud de inscripción y asignación/retiro de profesores. El admin puede revisar los últimos 200 eventos en `/admin/logs`.

### Avatars

`/api/profile/avatar` acepta JPEG, PNG y WebP hasta 5 MB. En desarrollo se guardan archivos en `public/uploads/avatars`. En producción se debe migrar a almacenamiento persistente externo.

---

## Documentos útiles

- [ALCANCE_Y_CARACTERISTICAS_CONSOLIDADO.md](/home/turista/Descargas/Github/sat-manager-platform/ALCANCE_Y_CARACTERISTICAS_CONSOLIDADO.md): alcance enriquecido desde Excel.
- [plan.md](/home/turista/Descargas/Github/sat-manager-platform/plan.md): plan de interfaz MVP.
- [PROFESSIONALIZATION_PLAN.md](/home/turista/Descargas/Github/sat-manager-platform/PROFESSIONALIZATION_PLAN.md): plan técnico/profesionalización.
- [Integracion-calculadora-desmos.md](/home/turista/Descargas/Github/sat-manager-platform/Integracion-calculadora-desmos.md): notas de integración Desmos.
- [usos-desmos-latex.md](/home/turista/Descargas/Github/sat-manager-platform/usos-desmos-latex.md): notas de LaTeX/Desmos.
- [sugerencias-gcp-bucket.md](/home/turista/Descargas/Github/sat-manager-platform/sugerencias-gcp-bucket.md): sugerencias para almacenamiento en GCP.
