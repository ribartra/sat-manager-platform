# SAT Practice Platform

Plataforma web de preparación SAT para instituciones. Los profesores crean contenido, asignan sets de práctica y tests completos, y monitorean el progreso de sus estudiantes. Los estudiantes trabajan sus asignaciones con un player cronometrado. Los padres pueden ver el avance de sus hijos.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16.2 — App Router, webpack |
| Lenguaje | TypeScript 5, React 19 |
| Auth | NextAuth v5-beta (JWT, Credentials provider) |
| Base de datos | SQLite · `better-sqlite3` · driver adapter |
| ORM | Prisma 7 (cliente TypeScript, sin binario de engine) |
| Estilos | Tailwind CSS v4 |
| UI | Radix UI + class-variance-authority + lucide-react |
| Tablas | TanStack Table v8 |
| Formularios | React Hook Form + Zod v4 |
| Notificaciones UI | Sonner |
| Matemáticas | KaTeX / react-katex |
| Email | Nodemailer (Brevo SMTP) |
| Runtime | Node.js 24 |

## Roles

| Rol | Acceso |
|---|---|
| `STUDENT` | Portal `/student` — práctica, resultados, historial, tests completos |
| `TEACHER` | Portal `/teacher` — gestión de contenido, grupos, estudiantes, asignaciones |
| `ADMIN` | Rutas `/admin` + todo lo del teacher — usuarios, programas, importación |
| `PARENT` | Portal `/parent` — dashboard de progreso del estudiante vinculado |

---

## Ciclo de vida del usuario

### Alta de estudiante (flujo de invitación)

```
Profesor → POST /api/students/invite
  ↓
  Crea InviteToken (expira en 7 días)
  Envía email al estudiante → /auth/activate?token=…
  Si hay datos de padre: crea parentConsentToken → email a padre → /auth/parent-consent?token=…

Padre → GET/POST /api/auth/parent-consent
  ↓
  Verifica token, crea usuario PARENT (o vincula existente)
  Guarda parentConsentAt + IP

Estudiante → GET /api/auth/invite-info?token=…
  ↓
  Si se requiere consentimiento parental y aún no fue dado: bloqueado
  Si ok: retorna nombre/email del invite

Estudiante → POST /api/auth/activate
  ↓
  Crea User (STUDENT, validationStatus=APPROVED, active=true)
  Crea ProgramEnrollment
  Si hay padre: crea ParentStudent con authorizedAt=parentConsentAt
  Marca InviteToken.usedAt
```

### Alta de profesor

El admin crea el usuario manualmente o el profesor se registra. El acceso queda bloqueado hasta que el admin apruebe: `POST /api/admin/users/{userId}/validation` con `validationStatus=APPROVED`.

### Login y control de acceso

```
POST /api/auth/[...nextauth] (Credentials)
  ↓
  Verifica: user existe, passwordHash válido, active=true
  JWT token: { id, email, role, validationStatus }

En cada request a ruta protegida (layout):
  session nula          → redirect /login
  validationStatus≠APPROVED → redirect /auth/pending-validation
  active=false          → redirect /login
  role incorrecto       → redirect al portal correcto
```

No hay `middleware.ts`. La protección está en los layouts de cada grupo de rutas.

### Recuperación de contraseña

```
POST /api/auth/forgot-password → crea PasswordResetToken (1h) → email con /auth/reset-password?token=…
POST /api/auth/reset-password  → verifica token, actualiza passwordHash, marca usedAt
POST /api/auth/change-password → requiere sesión activa, valida contraseña actual
```

---

## Ciclo de vida de una evaluación (Practice Set)

### 1. Asignación

El profesor envía `POST /api/assignments` con `{ studentIds, practiceSetIds, dueDate, unlockAt, locked }`. Se crean registros `Assignment` y se notifica a cada estudiante.

Si el assignment tiene `locked=true`, el estudiante puede pedir desbloqueo: `POST /api/unlock-requests`. El profesor aprueba/rechaza con `POST /api/unlock-requests/{requestId}`.

### 2. Inicio del intento

El estudiante entra a `/student/practice/[setId]?assignmentId={id}`.  
El servidor busca un `Attempt` en estado `IN_PROGRESS`; si no existe, crea uno nuevo:

```
Attempt {
  status: IN_PROGRESS
  attemptNumber: count_previos + 1
  currentQuestion: 0
  startedAt: now
}
```

### 3. Autosave

Cada cambio dispara `POST /api/attempts/{attemptId}/autosave` con:
- `answers` — mapa `{ questionId → respuesta }`
- `currentQuestion`, `totalTime`, `timeSpentByQuestion`
- `markedQuestionIds`, `notes`, `eliminatedOptions`

Hace upsert de cada `AttemptAnswer` (unique en `attemptId + questionId`). No puntúa aún.

### 4. Envío y puntuación

`POST /api/attempts/{attemptId}/submit`:
1. Carga todas las preguntas del set con su `correctAnswer`
2. Por cada respuesta: compara (trim + uppercase) → `isCorrect = true/false`
3. Preguntas sin responder → `isCorrect = false`
4. Actualiza `Attempt`: `status=SUBMITTED, submittedAt=now, totalTime`
5. Actualiza `Assignment.status = COMPLETED`
6. Notifica a todos los profesores

### 5. Resultados

`/student/results/[attemptId]` muestra score, porcentaje, tiempo y revisión por pregunta según `explanationVisibility`:

| Valor | Comportamiento |
|---|---|
| `IMMEDIATE` | Explicaciones visibles mientras practica |
| `AFTER_FINISH` | Visibles al ver resultados |
| `HIDDEN` | Nunca visibles para el estudiante |

El profesor puede ver el intento en `/teacher/students/{id}/attempts/{attemptId}` y puede:
- Agregar comentario: `POST /api/attempts/{attemptId}/comment`
- Reabrir: `POST /api/attempts/{attemptId}/reopen` → `status=IN_PROGRESS`
- Invalidar: `POST /api/attempts/{attemptId}/invalidate` → `status=INVALIDATED`

---

## Ciclo de vida de un Full Practice Test

### Estructura

Un test completo tiene 4 módulos fijos (orden, tiempos estándar SAT):

| Módulo | Sección | Tiempo |
|---|---|---|
| RW Module 1 | Reading & Writing | 32 min |
| RW Module 2 | Reading & Writing | 32 min |
| Math Module 1 | Math | 35 min |
| Math Module 2 | Math | 35 min |

### Flujo

```
Profesor → POST /api/full-practice-tests
  Crea FullPracticeTest + 4 módulos + FullPracticeTestQuestion por módulo

Profesor → POST /api/full-practice-tests/{testId}/assign
  Crea FullPracticeTestAssignment por estudiante → notificación

Estudiante → /student/full-tests/{assignmentId}
  Busca o crea FullPracticeTestAttempt { status=IN_PROGRESS, currentModule=0 }
  Módulos con timer, navegación entre preguntas, calculadora en módulos Math

Envío → POST /api/full-practice-tests/attempts/{attemptId}/submit
  Puntúa respuestas por sección (RW y Math por separado)
  Aplica tabla FullPracticeTestScoreConversion → escala 200–800
  Guarda rwScore, mathScore, totalScore=rwScore+mathScore

Resultados → /student/full-tests/results/{attemptId}
  Cards: RW Score / Math Score / Total
  Si reviewEnabled: revisión por módulo y pregunta
```

La tabla de conversión se gestiona en `/teacher/full-tests/scoring`.

---

## Modelo de datos (resumen)

```
User (STUDENT | TEACHER | ADMIN | PARENT)
  ├── ProgramEnrollment → Program
  ├── GroupMembership → Group
  ├── Assignment → PracticeSet → PracticeSetQuestion → Question
  │     └── Attempt → AttemptAnswer
  │           └── UnlockRequest
  ├── FullPracticeTestAssignment → FullPracticeTest
  │     └── FullPracticeTestAttempt → FullPracticeTestAnswer
  ├── ParentStudent (link PARENT ↔ STUDENT)
  ├── Notification
  └── AuditLog

Section → Domain → Topic → Subskill
                         → Question → QuestionOption
                         → PracticeSet
                         → FullPracticeTestModule → FullPracticeTestQuestion
                         → StudyMaterial
```

**Enums** (strings en SQLite):
- `User.role`: `STUDENT` | `TEACHER` | `ADMIN` | `PARENT`
- `User.validationStatus`: `PENDING` | `APPROVED` | `REJECTED`
- `Question.type`: `MC` | `NUMERIC`
- `Question.difficulty` / `PracticeSet.difficulty`: `EASY` | `MEDIUM` | `HARD`
- `Question.status` / `PracticeSet.status`: `DRAFT` | `PUBLISHED` | `ARCHIVED` (sets también: `BLOCKED`)
- `PracticeSet.explanationVisibility`: `IMMEDIATE` | `AFTER_FINISH` | `HIDDEN`
- `Attempt.status`: `IN_PROGRESS` | `SUBMITTED` | `INVALIDATED`
- `FullPracticeTestAttempt.status`: `IN_PROGRESS` | `SUBMITTED`

---

## Estructura del proyecto

```
sat-web/
├── app/
│   ├── (auth)/                     # Login, activación, recuperación de contraseña
│   ├── (teacher)/teacher/          # Portal profesor (TEACHER | ADMIN)
│   │   ├── page.tsx                # Dashboard — roster de estudiantes
│   │   ├── students/               # Lista, detalle, edición, asignación, report
│   │   ├── questions/              # Banco de preguntas, crear/editar
│   │   ├── practice-sets/          # Crear/editar sets de práctica
│   │   ├── content/                # Mapa de contenido (Sección→Dominio→Tema)
│   │   ├── groups/                 # Grupos y ciclos
│   │   ├── parents/                # Padres vinculados
│   │   ├── materials/              # Materiales de estudio
│   │   ├── full-tests/             # Tests completos + scoring
│   │   ├── programs/               # Programas
│   │   ├── subskills/              # Subhabilidades por tema
│   │   └── compare/                # Comparación entre estudiantes
│   ├── (student)/student/          # Portal estudiante
│   │   ├── page.tsx                # Dashboard — pendientes y resultados recientes
│   │   ├── practice/[setId]/       # Player de practice set + autosave
│   │   ├── results/[attemptId]/    # Revisión de intento
│   │   ├── history/                # Historial de intentos
│   │   ├── content-map/            # Exploración por tema y dificultad
│   │   ├── materials/              # Materiales de estudio
│   │   └── full-tests/             # Tests completos (player + resultados)
│   ├── (parent)/parent/            # Portal padre — dashboard de progreso
│   ├── admin/                      # Gestión de usuarios, programas, importación
│   ├── notifications/              # Notificaciones
│   ├── api/                        # API routes (ver sección de API)
│   ├── generated/prisma/           # Cliente Prisma 7 generado (no editar)
│   └── page.tsx                    # Redirect raíz según rol
├── components/
│   ├── ui/                         # Primitivos (Button, Input, Badge, Card, Dialog, Table, …)
│   ├── math-content.tsx            # Renderer KaTeX
│   ├── nav-teacher.tsx
│   └── nav-student.tsx
├── lib/
│   ├── auth.ts                     # Config NextAuth + handlers + signIn/signOut
│   ├── prisma.ts                   # Singleton PrismaClient (driver adapter SQLite)
│   ├── email.ts                    # Nodemailer + templates de email
│   └── utils.ts                    # Helpers: formatDate, scorePercent, formatTime, cn
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
└── next.config.ts                  # serverExternalPackages
```

---

## Setup

### Requisitos
- Node.js 24+
- npm

### Instalación

```bash
npm install
# o para CI / instalación reproducible:
npm ci
```

### Variables de entorno

Crea `.env` en la raíz (ver `.env.example` como referencia):

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="cambia-esto-por-un-string-aleatorio-largo"
AUTH_URL="http://localhost:3000"
CORS_ALLOWED_ORIGINS="http://localhost:3000"

# Email (Brevo SMTP — requerido para invitaciones y recuperación de contraseña)
EMAIL_FROM="noreply@tudominio.com"
EMAIL_HOST="smtp-relay.brevo.com"
EMAIL_PORT="587"
EMAIL_USER="tu-login-smtp-brevo"
EMAIL_PASS="tu-clave-smtp-brevo"

BACKUP_DIR="./backups"
```

**Notas de email:**
- El sender en `EMAIL_FROM` debe estar verificado en Brevo.
- Puerto 587 usa STARTTLS; puerto 465 activa SSL automáticamente.
- Si no hay variables de email configuradas, los links se imprimen en consola en lugar de enviarse (útil para desarrollo local).

### Base de datos

```bash
# Ejecutar migraciones
npx prisma migrate deploy

# Poblar con datos de prueba
npm run db:seed
```

Credenciales del seed:
- Admin: `admin@sat.com` / `admin123`
- Profesor: `teacher@sat.com` / `teacher123`
- Estudiantes: `student1@sat.com` … `student4@sat.com` / `student123`

Para resetear y re-sembrar desde cero:
```bash
npm run db:reset
```

### Servidor de desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). La raíz redirige automáticamente según el rol del usuario autenticado.

---

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run lint` | ESLint |
| `npm run db:seed` | Poblar la base de datos |
| `npm run db:reset` | Drop + migrate + seed |

---

## Notas de arquitectura

### Sin `middleware.ts`
No se usa middleware de Next.js. La protección de rutas está en los layouts de cada grupo:
- `app/(teacher)/layout.tsx` — requiere rol `TEACHER` o `ADMIN`
- `app/(student)/layout.tsx` — requiere sesión activa
- `app/(parent)/layout.tsx` — requiere rol `PARENT`
- Cada layout también verifica `validationStatus=APPROVED`

Esto evita incompatibilidades del Edge Runtime con `better-sqlite3` y NextAuth en Node.js 24.

### `serverExternalPackages`
`next.config.ts` excluye del bundling de Turbopack los paquetes nativos:
```ts
serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3", "@prisma/client", "bcryptjs"]
```
Sin esto, el servidor cae silenciosamente al recibir la primera request.

### Cliente Prisma 7
El cliente generado vive en `app/generated/prisma/` (configurado en `schema.prisma`). Usa el nuevo generador `provider = "prisma-client"` (TypeScript nativo, sin binario de engine). El singleton en `lib/prisma.ts` usa `@prisma/adapter-better-sqlite3` como driver adapter.

### Renderizado dinámico
Todos los layouts con auth tienen `export const dynamic = "force-dynamic"` para garantizar comprobación de sesión en cada request (sin caché estática).

### Sesión JWT
NextAuth usa estrategia JWT (sin tabla de sesiones en DB). El token contiene `{ id, email, role, validationStatus }` y se almacena en cookie httpOnly.
