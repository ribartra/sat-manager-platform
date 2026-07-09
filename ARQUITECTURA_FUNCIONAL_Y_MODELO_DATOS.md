# Arquitectura funcional y modelo de datos — Plataforma SAT

**Fecha:** 2026-06-23
**Estado del proyecto:** Desarrollo técnico adelantado respecto al Gantt; MVP de Practice Sets implementado funcionalmente, pendiente de validación documental, QA manual y piloto.
**Hito objetivo:** H3 — Arquitectura aprobada.
**Fuentes:** `prisma/schema.prisma`, `STATUS_PROYECTO_VS_GANTT.md`, `README.md`, `ALCANCE_Y_CARACTERISTICAS_CONSOLIDADO.md`, `Gantt_v1.md`, `P0_QA_CHECKLIST.md`, helpers en `lib/`.

> Convención de lectura: este documento separa de forma explícita lo que es **MVP core** (Practice Sets), lo que es **soporte operativo**, lo que es **extensión adelantada** (Full Practice Tests, padres, materiales, analytics) y lo que es **pendiente productivo / propuesta**. Ninguna recomendación se presenta como hecho implementado.

---

## 1. Resumen ejecutivo

### Propósito de la plataforma

Plataforma web privada para preparación SAT que conecta a una tutora (rol `TEACHER`) y sus alumnos (rol `STUDENT`), con soporte administrativo (`ADMIN`) y de apoderados (`PARENT`). El sistema permite construir un banco de contenido académico estructurado según la taxonomía SAT, agruparlo en **Practice Sets**, asignarlos a alumnos, resolverlos con un player de una pregunta por pantalla, calificarlos automáticamente y dar seguimiento mediante dashboards, reportes y analítica.

No es una plataforma pública masiva: es una operación privada tutora/alumnos donde el control de acceso, la confiabilidad del historial y la fidelidad del contenido son prioritarios.

### Alcance del MVP

El MVP de negocio se centra en el **ciclo de vida del Practice Set**:

1. La tutora crea preguntas y las publica.
2. Agrupa preguntas en un Practice Set y lo publica.
3. Asigna el Practice Set a uno o varios alumnos.
4. El alumno resuelve con autosave, pausa y reanudación.
5. El sistema califica, guarda historial inmutable y notifica.
6. La tutora revisa intentos, comenta, reabre o invalida, y consulta analítica.

### Estado respecto al Gantt

Según `STATUS_PROYECTO_VS_GANTT.md` (corte 2026-06-23, semana 7), los hitos H1–H10 están **completados funcionalmente** a nivel de rutas, APIs y modelo de datos. El modelo Prisma cubre usuarios, programas, grupos, banco de preguntas, Practice Sets, asignaciones, intentos, snapshots, notificaciones, auditoría, padres, materiales y Full Practice Tests. Lo pendiente no es construir pantallas base, sino:

- Cargar y revisar contenido real.
- Ejecutar QA manual end-to-end por rol.
- Preparar la operación productiva (SMTP, storage, backups, HTTPS, despliegue).
- Ejecutar el piloto controlado (H11/H12).

### Capacidades adelantadas (fuera del núcleo MVP, ya implementadas)

- **Full Practice Tests**: tests SAT-like con módulos RW/Math, timer por módulo y scoring escalado 200–800 / 400–1600.
- **Portal de padre / apoderado** con consentimiento parental para menores.
- **Analytics docente** por pregunta, topic, dificultad y tiempo.
- **Materiales de estudio**.
- **Reportes PDF** individuales.
- **Auditoría ampliada** y **auto-progresión de dificultad** por desempeño.

Estas capacidades no deben condicionar el cierre del MVP de Practice Sets.

---

## 2. Principios de arquitectura

1. **MVP primero.** Practice Sets es el flujo central; todo lo demás es soporte o extensión.
2. **Separación por roles y portales.** Cada rol tiene su árbol de rutas (`/admin`, `/teacher`, `/student`, `/parent`) y su layout protegido server-side.
3. **Historial confiable e inmutable mediante snapshots.** Un intento enviado conserva una copia JSON de la versión de las preguntas y del set, de modo que editar contenido después no altera notas históricas.
4. **Seguridad por rol y por scope de programa.** Un teacher solo gobierna alumnos dentro de sus programas activos/aprobados; un alumno solo opera sus propios intentos.
5. **Contenido académico estructurado por taxonomía SAT.** `Section → Domain → Topic → Subskill` sostiene preguntas, sets y materiales.
6. **Operación privada, no plataforma pública.** Sin registro abierto: el alta es por invitación con token y validación administrativa.
7. **Extensibilidad sin rehacer el banco.** Full Practice Tests **reutilizan** el modelo `Question` existente; no duplican el banco de preguntas.

---

## 3. Vista funcional de alto nivel

Para cada módulo: responsabilidad, usuarios, rutas/capacidades, entidades y estado.

| Módulo | Responsabilidad | Usuarios | Rutas/capacidades clave | Entidades | Estado |
|---|---|---|---|---|---|
| Autenticación y cuentas | Login, activación por invitación, reset/cambio de password, consentimiento parental | Todos | `/login`, `/auth/activate`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/parent-consent` | `User`, `InviteToken`, `PasswordResetToken` | MVP core |
| Roles y permisos | Autorización por rol y scope, validación admin | Admin, Teacher | `lib/rbac.ts`, `lib/program-scope.ts`, layouts | `User` | MVP core |
| Programas, grupos e inscripciones | Ciclo de vida de programa, asignación de profesores, inscripción de alumnos, grupos | Admin, Teacher, Student | `/admin/programs`, `/teacher/programs`, `/student/program`, `/teacher/groups` | `Program`, `ProgramTeacher`, `ProgramEnrollment`, `Group`, `GroupMembership` | MVP core |
| Banco de contenido académico | Taxonomía SAT | Teacher, Admin | `/teacher/content`, `/teacher/subskills` | `Section`, `Domain`, `Topic`, `Subskill` | MVP core |
| Preguntas y media | Crear/editar preguntas MC/NUMERIC, opciones, fórmulas KaTeX, imagen | Teacher, Admin | `/teacher/questions`, `/api/questions` | `Question`, `QuestionOption` | MVP core |
| Practice Sets | Composición ordenada de preguntas por topic/dificultad | Teacher, Admin | `/teacher/practice-sets/new`, `/api/practice-sets` | `PracticeSet`, `PracticeSetQuestion` | MVP core |
| Asignaciones | Materializar disponibilidad por alumno, due date, lock/unlock | Teacher, Admin | `/teacher/students/[id]/assign`, `/api/assignments` | `Assignment`, `UnlockRequest`, `Group` | MVP core |
| Player del alumno | Resolver una pregunta por pantalla, autosave, pausa | Student | `/student/practice/assignment/[id]`, `/api/attempts/[id]/autosave` | `Attempt`, `AttemptAnswer` | MVP core |
| Scoring e historial | Calificar, snapshots, intentos múltiples, revisión | Student, Teacher | `/api/attempts/[id]/submit`, `/student/results/[id]`, `/student/history` | `Attempt`, `AttemptAnswer` | MVP core |
| Seguimiento docente | Dashboard, pendientes/vencidos, detalle de intento, comentarios | Teacher, Admin | `/teacher`, `/teacher/students/[id]`, `/teacher/students/[id]/attempts/[id]` | `User`, `Assignment`, `Attempt` | MVP core |
| Analytics y reportes | Métricas por pregunta/topic/dificultad/tiempo, PDF individual | Teacher, Admin | `/teacher/analytics`, `/teacher/compare`, `/api/reports/students/[id]/pdf` | `Attempt`, `AttemptAnswer` | Extensión adelantada |
| Notificaciones | Comunicación interna y recordatorios | Todos | `/notifications`, `/api/notifications`, `notifications:generate` | `Notification` | Soporte operativo |
| Auditoría | Registro de acciones críticas | Admin (lectura) | `/admin/logs` | `AuditLog` | Soporte operativo |
| Admin / importación | Validar usuarios, maestro de programas, import masivo | Admin | `/admin/users`, `/admin/import` | `User`, `Program`, `Question`… | Soporte operativo |
| Padres / apoderados | Consentimiento parental y progreso de hijos | Parent | `/parent`, `/auth/parent-consent` | `ParentStudent`, `InviteToken`, `ProgramEnrollment` | Extensión adelantada |
| Full Practice Tests | Tests SAT-like con módulos y scoring escalado | Teacher, Student | `/teacher/full-tests`, `/student/full-tests` | `FullPracticeTest*` (7 entidades) | Extensión adelantada |
| Materiales de estudio | Recursos publicados, opcionalmente por topic | Teacher, Student | `/teacher/materials`, `/student/materials` | `StudyMaterial` | Extensión adelantada |

---

## 4. Flujos funcionales principales

### 4.1 Invitación y activación de estudiante

1. **Teacher/Admin invita** vía `POST /api/students/invite`. Se crea un `InviteToken` (`role = STUDENT`), con `email`, `name`, expiración (`expiresAt`, 7 días) y, opcionalmente, `programId`.
2. **Datos de menor / padre.** Si `isMinor = true` o se proveen `parentName`/`parentEmail`, el token guarda esos datos y un `parentConsentToken` único para el flujo de consentimiento.
3. **Consentimiento parental (si aplica).** El padre abre `/auth/parent-consent?token=...`; al aprobar se registran `parentConsentAt` y `parentConsentIp`.
4. **Activación de cuenta.** El alumno abre `/auth/activate?token=...` y define su contraseña. Se crea el `User` (`role = STUDENT`), se marca el token con `usedAt`, y si el token traía `programId` se crea/vincula el `ProgramEnrollment` correspondiente.
5. **Vinculación con programa.** El alumno queda inscrito en el programa indicado (estado de inscripción según reglas de la sección 7). Si el token no traía programa, el alumno puede solicitar inscripción luego desde `/student/program`.
6. **Validaciones de cuenta.** El acceso real depende de `User.active = true` y `User.validationStatus = APPROVED` (validación administrativa).

Entidades: `User`, `InviteToken`, `Program`, `ProgramEnrollment`, `ParentStudent`.

### 4.2 Login y autorización

1. **Login con Credentials** (`POST /api/auth/[...nextauth]`): se valida email/password (`passwordHash` con bcrypt) y se exige `active = true`.
2. **Sesión JWT.** El callback `jwt` (`lib/auth.config.ts`) incrusta `id` y `role`; el callback `session` los expone en `session.user`.
3. **Validación de usuario aprobado.** Los helpers `requireApprovedSession`, `requireTeacherOrAdmin` y `requireAdmin` (`lib/rbac.ts`) reconsultan la BD para verificar `active` y `validationStatus = APPROVED` en cada operación sensible — la sola posesión del JWT no basta.
4. **Redirección por rol.** Los layouts protegidos redirigen: sesión nula → `/login`; usuario inactivo → `/login`; `validationStatus != APPROVED` → `/auth/pending-validation`; rol incorrecto → su portal.
5. **Protección server-side.** No hay `middleware.ts` (Edge) porque `better-sqlite3` y el adapter Prisma requieren Node runtime; la autorización vive en `app/(teacher)/layout.tsx`, `app/(student)/layout.tsx`, `app/(parent)/layout.tsx` y helpers, con `dynamic = "force-dynamic"`.

Entidades/helpers: `User`, `lib/auth.ts`, `lib/rbac.ts`, layouts de rol.

### 4.3 Gestión académica de contenido

1. **Taxonomía SAT** jerárquica: `Section` → `Domain` → `Topic` → `Subskill`.
2. **Creación/edición de preguntas** (`/api/questions`, `/api/questions/[id]`).
3. **Tipos:** `MC` (opción múltiple A/B/C/D) y `NUMERIC` (respuesta numérica). La pregunta pertenece a un `Topic` y opcionalmente a un `Subskill`.
4. **Media y formato:** `imageUrl`, `stimulus`, `supportsGraph`, y contenido matemático renderizado con KaTeX en `stem`/`explanation`.
5. **Estados:** `DRAFT`, `PUBLISHED`, `ARCHIVED`.
6. **Validación antes de publicar** (`lib/content-validation.ts`): para `PUBLISHED` se exige topic, dificultad, stem, respuesta correcta y explicación. Para `MC` se exigen las 4 opciones A–D y que la respuesta correcta sea A/B/C/D.

Entidades: `Section`, `Domain`, `Topic`, `Subskill`, `Question`, `QuestionOption`.

### 4.4 Creación y publicación de Practice Set

1. **Pertenencia:** cada `PracticeSet` pertenece a un `Topic` y una `difficulty`.
2. **Asociación ordenada de preguntas** vía `PracticeSetQuestion` (relación N:M con campo `order`).
3. **Visibilidad de explicación:** `explanationVisibility` = `IMMEDIATE` | `AFTER_FINISH` | `HIDDEN`.
4. **Estados:** `DRAFT`, `PUBLISHED`, `BLOCKED`, `ARCHIVED`.
5. **Validación al publicar** (`lib/content-validation.ts`): nombre, topic, dificultad, visibilidad de explicación y al menos una pregunta; no se permiten preguntas duplicadas. *(Invariante de producto: un set publicado no debería contener preguntas no publicadas; ver sección 7 y riesgos en 11.)*

Entidades: `PracticeSet`, `PracticeSetQuestion`, `Question`.

### 4.5 Asignación de Practice Set

1. **Tipos de asignación** (`POST /api/assignments`): individual, múltiple o por grupo (expandiendo `GroupMembership`). Cada combinación alumno–set genera un `Assignment`.
2. **Fecha límite:** `dueDate` opcional.
3. **Bloqueo:** `locked` (bloqueo manual) y `unlockAt` (desbloqueo programado).
4. **Estados:** `PENDING`, `IN_PROGRESS`, `COMPLETED`, `OVERDUE`.
5. **Solicitud de desbloqueo:** el alumno crea `UnlockRequest` (`POST /api/unlock-requests`); la tutora resuelve (`APPROVED`/`DENIED`).
6. **Notificación al alumno** vía `Notification`.
7. **Jobs de mantenimiento** (`lib/assignments.ts`, `notifications:generate`): `markOverdueAssignments` pasa a `OVERDUE` los `PENDING`/`IN_PROGRESS` vencidos; `releaseScheduledUnlocks` libera los `locked` cuyo `unlockAt` ya pasó.

Entidades: `Assignment`, `Group`, `GroupMembership`, `UnlockRequest`, `Notification`.

### 4.6 Resolución de Practice Set por alumno

1. **Inicio o continuación:** al entrar a `/student/practice/assignment/[id]` se busca un `Attempt` `IN_PROGRESS`; si no existe, se crea uno nuevo (`attemptNumber` incremental).
2. **Una pregunta por pantalla**, con navegación y progreso (`currentQuestion`).
3. **Autosave** (`POST /api/attempts/[id]/autosave`): guarda respuesta, pregunta actual, tiempos, marcas de revisión (`markedForReview`), notas (`note`) y opciones eliminadas (`eliminatedOptions`).
4. **Tiempos:** `Attempt.totalTime` y `AttemptAnswer.timeSpent` por pregunta.
5. **Respuestas MC/NUMERIC** y **blanks/omitidas** (`answer = null`).
6. **Pausa y continuidad:** el intento `IN_PROGRESS` persiste entre sesiones; soporta reconexión.
7. **Submit final** (`POST /api/attempts/[id]/submit`).

Entidades: `Attempt`, `AttemptAnswer`, `Assignment`, `PracticeSet`.

### 4.7 Scoring, historial y revisión

1. **Cálculo** (`/api/attempts/[id]/submit`): cada respuesta se compara contra el snapshot de la pregunta (no contra el banco vivo). La comparación es case-insensitive y con trim. Las no respondidas se marcan `isCorrect = false`.
2. **Snapshots** (`lib/attempt-snapshots.ts`): al enviar, se persiste `Attempt.practiceSetSnapshot` (JSON del set) y `AttemptAnswer.questionSnapshot` (JSON de cada pregunta con stem, opciones, respuesta correcta y explicación). Esto **congela la versión histórica**.
3. **Estado final:** `Attempt.status = SUBMITTED`, `submittedAt`, `totalTime`. Si proviene de una asignación, el `Assignment` pasa a `COMPLETED`.
4. **Notas y porcentaje:** correctas/incorrectas/omitidas y porcentaje derivado; el **último intento válido** funciona como nota vigente y se permiten **múltiples intentos** (`attemptNumber`).
5. **Auto-progresión** (`lib/practice-progression.ts`, regla de negocio no obvia): si `scorePercent ≥ 70%` se desbloquea/crea automáticamente el siguiente set del mismo nivel; si `≥ 75%` se desbloquea el primer set de la siguiente dificultad del mismo topic. Esta automatización **respeta el bloqueo manual y el unlock programado**: si encuentra un `Assignment` con `locked = true` o `unlockAt` futuro, **no** lo abre y registra `AUTO_UNLOCK_SKIPPED_*` en `AuditLog`.
6. **Revisión:** el alumno ve resultados respetando `explanationVisibility`.
7. **Acciones docentes:** comentar (`/api/attempts/[id]/comment` → `teacherComment`), reabrir (`/reopen`) e invalidar (`/invalidate` → `status = INVALIDATED`).

Entidades: `Attempt`, `AttemptAnswer`, `AuditLog`.

### 4.8 Seguimiento docente y reportería

1. **Dashboard** (`/teacher`) con alumnos en scope, pendientes/vencidos, último acceso (`User.lastActiveAt`) y resultados recientes.
2. **Detalle por intento** (`/teacher/students/[id]/attempts/[id]`).
3. **Reporte individual y PDF** (`/teacher/students/[id]/report`, `/api/reports/students/[id]/pdf`).
4. **Analytics** (`/teacher/analytics`) por pregunta, topic, dificultad y tiempo; comparación privada en `/teacher/compare`.
5. **Impersonation** (`/teacher/impersonate/[id]`) para soporte, auditada.

Entidades: `User`, `Assignment`, `Attempt`, `AttemptAnswer`, `Notification`, `AuditLog`.

### 4.9 Full Practice Test (extensión adelantada)

> Documentado solo como capacidad adelantada; no es bloqueo del MVP de Practice Sets.

1. **Test SAT-like** (`FullPracticeTest`) con módulos (`FullPracticeTestModule`): `section` RW/MATH, `order`, `timeLimit`.
2. **Preguntas reutilizadas:** `FullPracticeTestQuestion` enlaza módulos con `Question` del banco existente.
3. **Asignación** (`FullPracticeTestAssignment`).
4. **Attempt por alumno** (`FullPracticeTestAttempt`) con `currentModule`, `currentQuestion`, `moduleTimerState`, `timeExpiredEvents`, `extraTimeUsed`.
5. **Scoring por tabla de conversión** (`lib/full-test-scoring.ts`): raw correct por sección → `FullPracticeTestScoreConversion`; con interpolación entre filas y fallback aproximado lineal 200–800 si no hay tabla. Resultados `rwScore`, `mathScore`, `totalScore` (RW + Math, 400–1600).

Entidades: `FullPracticeTest`, `FullPracticeTestModule`, `FullPracticeTestQuestion`, `FullPracticeTestAssignment`, `FullPracticeTestAttempt`, `FullPracticeTestAnswer`, `FullPracticeTestScoreConversion`.

---

## 5. Modelo de datos conceptual (por dominios)

> Las entidades y campos provienen literalmente de `prisma/schema.prisma`. En SQLite los enums se modelan como `String` con valores convenidos (ver sección 7).

### 5.1 Identidad y acceso

**Entidades:** `User`, `InviteToken`, `PasswordResetToken`, `ParentStudent`.

- **`User`** es la entidad central. Campos clave: `role` (`STUDENT`|`TEACHER`|`ADMIN`; `PARENT` se usa también como rol operativo de portal), `active`, `validationStatus` (`PENDING`|`APPROVED`|`REJECTED`) con `validationReviewedAt`/`validationReviewedById`, `passwordHash` (nullable hasta activar), `lastActiveAt`, `avatarUrl`, `birthDate`, `startDate`.
- **`InviteToken`** soporta alta por invitación (`role` STUDENT|PARENT), con datos de menor (`isMinor`, `parentName/Email/Phone`, `linkedStudentEmail`) y consentimiento (`parentConsentToken` único, `parentConsentAt`, `parentConsentIp`). `token` único, `expiresAt`, `usedAt`.
- **`PasswordResetToken`**: `token` único, `expiresAt`, `usedAt`, ligado a `User` con cascade.
- **`ParentStudent`**: tabla puente N:M padre↔alumno con `authorizedAt`; doble relación nombrada (`ParentLinks`/`ChildLinks`) sobre `User`.

**Explica:** roles, activación, validación administrativa, menores y consentimiento, tokens de invitación/reset.

### 5.2 Programas y grupos

**Entidades:** `Program`, `ProgramTeacher`, `ProgramEnrollment`, `Group`, `GroupMembership`.

- **`Program`**: `name`, `startDate`, `endDate?`, `active`, `deletedAt?` (borrado lógico). Estado vigente = `active` AND no borrado AND dentro de ventana de fechas.
- **`ProgramTeacher`** (PK compuesta `programId+teacherId`): asigna profesores a programas, con `startDate`/`endDate?` para vigencia.
- **`ProgramEnrollment`** (PK compuesta `programId+studentId`): inscripción con `status` (`PENDING`|`APPROVED`|`REJECTED`), `active`, y aprobación parental opcional (`parentApprovalStatus`, `parentApprovedAt`).
- **`Group`** + **`GroupMembership`** (PK `userId+groupId`): agrupación operativa para asignar en lote y organizar horarios (`schedule`).

**Explica:** un programa tiene muchos profesores y muchos alumnos vía tablas puente; un alumno puede estar en más de un programa/grupo; el **scope docente** se calcula sobre programas activos/aprobados (`lib/program-scope.ts`).

### 5.3 Taxonomía y banco de preguntas

**Entidades:** `Section`, `Domain`, `Topic`, `Subskill`, `Question`, `QuestionOption`.

- Jerarquía 1:N: `Section`(name único) → `Domain` → `Topic` → `Subskill`.
- **`Question`** pertenece a un `Topic` (obligatorio) y opcionalmente a un `Subskill`. Campos: `stem`, `stimulus?`, `type` (`MC`|`NUMERIC`), `difficulty` (`EASY`|`MEDIUM`|`HARD`), `correctAnswer`, `explanation?`, `status` (`DRAFT`|`PUBLISHED`|`ARCHIVED`), `imageUrl?`, `supportsGraph`.
- **`QuestionOption`**: opciones A–D para preguntas MC (cascade desde `Question`).

**Explica:** jerarquía SAT, pertenencia topic/subskill, opciones solo en MC, `status` controla publicación, soporte de media/KaTeX.

### 5.4 Practice Sets y asignaciones

**Entidades:** `PracticeSet`, `PracticeSetQuestion`, `Assignment`, `UnlockRequest`.

- **`PracticeSet`** ligado a `Topic`, con `difficulty`, `status` y `explanationVisibility`.
- **`PracticeSetQuestion`** (PK `practiceSetId+questionId`, `order`): relación N:M ordenada.
- **`Assignment`** materializa disponibilidad por alumno: `practiceSetId`, `studentId`, `assignedById?`, `dueDate?`, `unlockAt?`, `locked`, `status`.
- **`UnlockRequest`**: workflow de excepción del alumno con `status` (`PENDING`|`APPROVED`|`DENIED`) y `resolvedAt?`.

**Explica:** la relación N:M con orden, la materialización de disponibilidad por alumno, el bloqueo manual/programado y el unlock request como excepción.

### 5.5 Intentos, respuestas y snapshots

**Entidades:** `Attempt`, `AttemptAnswer`.

- **`Attempt`** pertenece a `studentId` y `practiceSetId`; `assignmentId?` (un intento puede existir sin asignación). Campos: `attemptNumber`, `startedAt`, `submittedAt?`, `totalTime?`, `status` (`IN_PROGRESS`|`SUBMITTED`|`INVALIDATED`), `currentQuestion`, `teacherComment?`, `practiceSetSnapshot?` (JSON).
- **`AttemptAnswer`** (único por `attemptId+questionId`): `answer?`, `isCorrect?`, `timeSpent?`, `markedForReview`, `note?`, `eliminatedOptions?`, `questionSnapshot?` (JSON).

**Explica:** unicidad de respuesta por pregunta/intento, snapshots que preservan la versión histórica, estados del intento y campos de progreso/tiempo.

### 5.6 Notificaciones y auditoría

**Entidades:** `Notification`, `AuditLog`.

- **`Notification`**: comunicación interna por usuario (`title`, `body?`, `href?`, `readAt?`).
- **`AuditLog`**: acciones críticas y soporte operativo (`userId` actor, `action`, `targetType?`, `targetId?`, `metadata?` JSON, `createdAt`). Registra import, edición/publicación, intentos, impersonation, operaciones de programa/inscripción y los eventos de auto-progresión/auto-unlock.

### 5.7 Full Practice Tests (extensión adelantada)

**Entidades:** `FullPracticeTest`, `FullPracticeTestModule`, `FullPracticeTestQuestion`, `FullPracticeTestAssignment`, `FullPracticeTestAttempt`, `FullPracticeTestAnswer`, `FullPracticeTestScoreConversion`.

- **Reutiliza `Question`** vía `FullPracticeTestQuestion` (no duplica banco).
- **Módulos** modelan la estructura SAT (RW/Math, orden, `timeLimit`).
- **`FullPracticeTestScoreConversion`** (único por `section+rawCorrect`) permite score escalado.
- Es **extensión adelantada**, no bloqueo del MVP.

### 5.8 Materiales

**Entidad:** `StudyMaterial`.

- `status` `DRAFT`|`PUBLISHED`|`ARCHIVED`, asociación opcional a `Topic` (con `onDelete: SetNull`), y soporte de contenido interno (`body`) o externo (`url`).

---

## 6. Relaciones principales

| Relación | Cardinalidad | Propósito |
|---|---:|---|
| `Program` → `ProgramTeacher` → `User` | N:M | Profesores asignados a programas (vigencia por `endDate`). |
| `Program` → `ProgramEnrollment` → `User` | N:M | Alumnos inscritos en programas (estado + aprobación parental). |
| `Program` → `InviteToken` | 1:N | Invitaciones emitidas en contexto de un programa. |
| `Group` → `GroupMembership` → `User` | N:M | Agrupación operativa de alumnos. |
| `Section` → `Domain` → `Topic` → `Subskill` | 1:N jerárquico | Taxonomía académica SAT. |
| `Topic` → `Question` | 1:N | Preguntas por tema (subskill opcional). |
| `Topic` → `PracticeSet` | 1:N | Sets por tema. |
| `Topic` → `StudyMaterial` | 1:N (opcional) | Materiales por tema. |
| `Question` → `QuestionOption` | 1:N | Opciones MC (A–D). |
| `PracticeSet` → `PracticeSetQuestion` → `Question` | N:M ordenada | Preguntas ordenadas dentro de un set. |
| `User`(student) → `Assignment` | 1:N | Tareas asignadas al alumno. |
| `PracticeSet` → `Assignment` | 1:N | Asignaciones de un set. |
| `Assignment` → `Attempt` | 1:N | Intentos asociados a una asignación. |
| `Attempt` → `AttemptAnswer` | 1:N (única por pregunta) | Respuestas del intento. |
| `Assignment` → `UnlockRequest` | 1:N | Solicitudes de desbloqueo. |
| `User` → `Notification` | 1:N | Notificaciones por usuario. |
| `User` → `AuditLog` | 1:N | Acciones auditadas por usuario actor. |
| `User` ↔ `User` vía `ParentStudent` | N:M | Padres vinculados a alumnos. |
| `FullPracticeTest` → `FullPracticeTestModule` | 1:N | Módulos SAT-like. |
| `FullPracticeTestModule` → `FullPracticeTestQuestion` → `Question` | N:M ordenada | Preguntas por módulo, reutilizando banco. |
| `FullPracticeTestAttempt` → `FullPracticeTestAnswer` | 1:N (única por pregunta) | Respuestas del test completo. |

---

## 7. Estados y reglas de negocio

### Estados por entidad

| Entidad | Campo | Valores |
|---|---|---|
| `User` | `validationStatus` | `PENDING` → `APPROVED` / `REJECTED` |
| `User` | `active` | `true` / `false` |
| `Program` | `active` + `deletedAt` | Vigente / inactivo / borrado lógico |
| `ProgramEnrollment` | `status` | `PENDING` → `APPROVED` / `REJECTED` |
| `ProgramEnrollment` | `parentApprovalStatus` | `null` (no requiere) / `PENDING` → `APPROVED` / `REJECTED` |
| `Question` | `status` | `DRAFT` → `PUBLISHED` → `ARCHIVED` |
| `PracticeSet` | `status` | `DRAFT` → `PUBLISHED` / `BLOCKED` / `ARCHIVED` |
| `PracticeSet` | `explanationVisibility` | `IMMEDIATE` / `AFTER_FINISH` / `HIDDEN` |
| `Assignment` | `status` | `PENDING` → `IN_PROGRESS` → `COMPLETED` / `OVERDUE` |
| `Attempt` | `status` | `IN_PROGRESS` → `SUBMITTED` / `INVALIDATED` |
| `UnlockRequest` | `status` | `PENDING` → `APPROVED` / `DENIED` |
| `FullPracticeTest` | `status` | `DRAFT` → `PUBLISHED` → `ARCHIVED` |
| `FullPracticeTestAttempt` | `status` | `IN_PROGRESS` → `SUBMITTED` |

### Invariantes

- **Intentos propios:** un alumno solo puede operar sus propios `Attempt` (`submit` filtra por `studentId` y `status = IN_PROGRESS`).
- **Scope docente:** un teacher solo gestiona alumnos dentro de sus programas activos/aprobados (`teacherProgramEnrollmentScope`); un admin ve todos los `STUDENT`.
- **Contenido publicado válido:** un Practice Set publicado debe tener nombre, topic, dificultad, visibilidad y al menos una pregunta; sin preguntas duplicadas. *(La exigencia de que todas las preguntas estén `PUBLISHED` es invariante de producto; conviene confirmarla en QA — ver sección 11.)*
- **Historial inmutable:** un intento enviado se califica contra **snapshots** y no se recalcula si el contenido se edita luego.
- **No re-submit:** un intento ya `SUBMITTED` no puede reenviarse (el filtro `IN_PROGRESS` lo rechaza con 404); reabrir requiere acción docente explícita.
- **Blanks = omitidas:** las no respondidas se persisten con `answer = null` e `isCorrect = false`.
- **Desbloqueo automático seguro:** la auto-progresión por desempeño **no** salta bloqueo manual (`locked`) ni `unlockAt` futuro; ante esos casos no actúa y deja traza en `AuditLog`.
- **Tabla de conversión monótona:** los scores deben ser no decrecientes al aumentar `rawCorrect` (validación FPT).

---

## 8. Permisos y seguridad

### Matriz por rol

| Capacidad | Admin | Teacher | Student | Parent |
|---|:--:|:--:|:--:|:--:|
| Validar usuarios | Sí | No | No | No |
| Gestionar programas globales | Sí | Limitado (propios) | No | No |
| Invitar/editar alumnos | Sí | Sí, por scope | No | No |
| Crear preguntas/sets | Sí | Sí | No | No |
| Asignar Practice Sets | Sí | Sí, por scope | No | No |
| Resolver Practice Sets | No | No | Sí, propios | No |
| Ver intentos de alumno | Sí | Sí, por scope | Propios | Hijos vinculados, limitado |
| Ver banco de preguntas | Sí | Sí | No | No |
| Resolver unlock requests | Sí | Sí, por scope | No | No |
| Ver auditoría | Sí | Limitado/no | No | No |

### Mecanismos

- **Protección server-side** por layouts (`force-dynamic`) y helpers (`requireApprovedSession`, `requireTeacherOrAdmin`, `requireAdmin`), que reconsultan `active` y `validationStatus` en cada request.
- **Sin middleware Edge:** `better-sqlite3` y el adapter Prisma exigen Node runtime; usar Edge rompería la conexión a BD. Por eso la autorización vive en capa Node.
- **Scope por programa** centralizado en `lib/program-scope.ts`, evitando que cada ruta reinvente el filtro.

### Pendientes productivos de seguridad

- HTTPS/TLS en producción.
- Hashing de password ya con bcrypt; revisar política de complejidad y rate limiting básico en login/reset.
- URLs privadas / storage productivo para media y avatars (hoy local).
- Rate limiting y protección anti-abuso en endpoints públicos (`activate`, `forgot-password`, `parent-consent`).

---

## 9. Arquitectura técnica resumida

### Stack

- **Next.js 16 (App Router, webpack)**, **TypeScript 5**, **React 19**.
- **Prisma 7** con cliente generado en `app/generated/prisma`.
- **SQLite** con `@prisma/adapter-better-sqlite3` (desarrollo).
- **NextAuth v5 beta**, Credentials provider, sesión **JWT**.
- **Tailwind v4**, **Radix UI**, **lucide-react**, **TanStack Table v8**, **React Hook Form + Zod**.
- **KaTeX** para matemáticas.
- **Nodemailer + Brevo SMTP** para email transaccional.
- **Runtime objetivo:** Node.js 24+.

### Capas

1. **UI por portal:** `(auth)`, `(student)`, `(teacher)`, `(parent)`, `admin`. La raíz redirige según sesión/rol.
2. **Server routes / API** (`app/api/*`): route handlers para auth, alumnos, programas, preguntas, sets, asignaciones, intentos, FPT, materiales, notificaciones, reportes e import.
3. **Helpers de dominio** (`lib/`): `auth`/`rbac`/`program-scope` (seguridad), `attempt-snapshots` (historial), `content-validation`/`full-test-validation` (publicación), `full-test-scoring`/`practice-progression` (lógica de negocio), `notifications`/`notify`, `storage`, `email`, `observability`, `activity`.
4. **Prisma schema** como contrato de persistencia.
5. **Scripts de QA/operación:** `qa:p0`, `qa:authz`, `qa:edge`, `db:seed`, `db:backup`, `notifications:generate`.

### Información que viaja entre capas

- **Cliente → API:** payloads JSON (login, autosave con respuestas/tiempos/marcas, submit, asignaciones, edición de contenido). El autosave envía `answers`, `totalTime`, `timeSpentByQuestion`, `markedQuestionIds`, `notes`, `eliminatedOptions`.
- **API → BD:** vía Prisma sobre SQLite; las operaciones de scoring escriben snapshots JSON embebidos.
- **Sesión:** JWT firmado con `AUTH_SECRET`, transporta `id` y `role`; el resto (active, validationStatus) se reconsulta server-side.
- **Email saliente:** invitación/activación, reset, consentimiento (Brevo SMTP); en desarrollo sin SMTP válido, los links se imprimen en consola.

---

## 10. Operación y dependencias externas

| Dependencia | Estado desarrollo | Pendiente producción/piloto |
|---|---|---|
| **SMTP** (invitación/activación/reset) | Fallback a consola si no hay credenciales | Configurar Brevo definitivo y `EMAIL_FROM` verificado; probar emails reales |
| **Storage** (avatars/media) | Local en `public/uploads/avatars` (`lib/storage.ts`) | Migrar a bucket privado/objeto (ver `sugerencias-gcp-bucket.md`) |
| **Backups** | `npm run db:backup` (copia SQLite a `BACKUP_DIR`) | Programar backup automático diario (RNF-15); definir retención |
| **Variables de entorno** | `.env.example` documentado | Secrets gestionados; `AUTH_SECRET` robusto; `CORS_ALLOWED_ORIGINS` productivo |
| **HTTPS/TLS** | localhost | Obligatorio en producción |
| **Logs/observabilidad** | `lib/observability.ts` + `AuditLog` | Monitoreo básico y alertas |
| **Seed/carga inicial** | `prisma/seed.ts` con datos demo | Cargar contenido real validado académicamente |
| **Despliegue** | `next dev --webpack` | Definir dominio, hosting Node 24+, migraciones (`prisma migrate deploy`) |

---

## 11. Riesgos y decisiones pendientes

1. **Validación con contenido real.** Todo el modelo está probado con seed; falta cargar y revisar preguntas reales (fórmulas, tablas, imágenes, textos largos) y confirmar fidelidad visual.
2. **Base de datos productiva.** SQLite + `better-sqlite3` es adecuado para desarrollo/piloto pequeño; un crecimiento de concurrencia podría requerir evaluar Postgres. *(Propuesta, no decisión tomada.)*
3. **Storage productivo** para media/avatars (hoy local; no persiste en despliegues efímeros).
4. **Backup automático** diario y políticas de retención/eliminación aún por formalizar.
5. **Formato final de importación masiva.** El import existe, pero su calidad depende del formato de datos acordado.
6. **Invariante "set publicado solo con preguntas publicadas".** La validación actual exige al menos una pregunta y no duplicados; conviene verificar en QA que no se cuelen preguntas `DRAFT`/`ARCHIVED` en un set publicado.
7. **Versionado de banco vs snapshots.** El historial se protege con snapshots embebidos en el intento; no hay versionado explícito del banco vivo. Es suficiente para historial, pero conviene documentar la decisión.
8. **Rol PARENT.** En `User.role` el comentario del schema lista `STUDENT|TEACHER|ADMIN`, mientras `InviteToken.role` y la operación contemplan `PARENT`. Conviene unificar la declaración del enum para evitar ambigüedad. *(Propuesta de limpieza, no bug funcional confirmado.)*
9. **Pruebas E2E reales de navegador.** Los scripts `qa:*` son verificación estática; no sustituyen pruebas manuales ni de navegador.
10. **Alcance contractual de Full Practice Tests.** Decidir explícitamente si entran en el MVP contractual o se cierran como fase 2; hoy están adelantados pero no deben bloquear el cierre de Practice Sets.
11. **Higiene de repositorio.** Hay muchos archivos modificados/sin versionar; antes de entrega conviene ordenar commits separando documentación, features y migraciones.

---

## 12. Trazabilidad contra el MVP de Practice Sets

| Hito Gantt | Cobertura en este modelo | Entidades soporte |
|---|---|---|
| H5 Cuentas y roles | Auth, activación, validación, consentimiento, layouts | `User`, `InviteToken`, `PasswordResetToken`, `ParentStudent` |
| H6 Banco operativo | Taxonomía + preguntas + validación publicación | `Section/Domain/Topic/Subskill`, `Question`, `QuestionOption` |
| H7 Set resoluble | Player, autosave, pausa, tiempos, blanks | `PracticeSet`, `PracticeSetQuestion`, `Attempt`, `AttemptAnswer` |
| H8 Historial y scoring | Submit, snapshots, intentos múltiples, revisión | `Attempt`, `AttemptAnswer` |
| H9 Asignaciones | Individual/grupo, due date, lock/unlock, requests | `Assignment`, `Group`, `GroupMembership`, `UnlockRequest` |
| H10 Dashboard docente | Pendientes/vencidos, detalle, comentarios, analytics | `User`, `Assignment`, `Attempt`, `Notification`, `AuditLog` |

**Conclusión:** la arquitectura funcional y el modelo de datos cubren el MVP de Practice Sets de extremo a extremo, con extensiones adelantadas claramente separadas. El cierre del Hito 3 depende de aprobar este documento más las decisiones operativas (despliegue, storage, backups) listadas en las secciones 10 y 11. Este documento es consistente con `STATUS_PROYECTO_VS_GANTT.md` y no declara como cerrado nada que sea recomendación o pendiente.
