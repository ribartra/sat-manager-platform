# /plan - Arquitectura funcional y modelo de datos

## Objetivo del agente

Crear un documento claro, detallado y validable de **arquitectura funcional y modelo de datos** para la Plataforma SAT, alineado al alcance MVP de Practice Sets, al Gantt `Gantt_v1.md`, al estado real documentado en `STATUS_PROYECTO_VS_GANTT.md` y al modelo actual en `prisma/schema.prisma`.

El entregable debe servir para aprobación del **Hito 3 - Arquitectura aprobada** y como referencia para desarrollo, QA, carga de contenido, despliegue y futuras extensiones como Full Practice Tests.

## Archivos de entrada obligatorios

El agente debe leer y usar como fuente:

- `Gantt_v1.md`
- `STATUS_PROYECTO_VS_GANTT.md`
- `ALCANCE_Y_CARACTERISTICAS_CONSOLIDADO.md`
- `README.md`
- `prisma/schema.prisma`
- `P0_QA_CHECKLIST.md`
- `package.json`

Fuentes opcionales si necesita más contexto:

- `SETUP_CORREO_SMTP.md`
- `sugerencias-gcp-bucket.md`
- `Integracion-calculadora-desmos.md`
- `calculadora.md`

## Entregable esperado

Crear un archivo nuevo:

`ARQUITECTURA_FUNCIONAL_Y_MODELO_DATOS.md`

El documento debe estar escrito en español, con lenguaje ejecutivo-técnico, suficientemente claro para cliente/product owner y suficientemente preciso para un equipo técnico.

No debe ser solo una lista de tablas. Debe explicar:

- Qué problema resuelve cada módulo.
- Qué usuarios participan.
- Qué entidades de datos sostienen el flujo.
- Qué reglas de negocio aplican.
- Qué permisos protegen cada operación.
- Qué queda fuera del MVP o queda como extensión.
- Qué riesgos o decisiones pendientes deben aprobarse.

## Criterios de calidad

El documento debe cumplir:

- Trazabilidad explícita contra el MVP de Practice Sets.
- Separación clara entre MVP, capacidades ya adelantadas y post-MVP.
- Modelo de datos explicado por dominios funcionales, no solo por orden del schema.
- Descripción de relaciones cardinales clave: 1:N, N:M, opcionales y dependencias.
- Explicación de estados principales: usuarios, programas, Practice Sets, assignments, attempts, preguntas, Full Practice Tests.
- Identificación de invariantes: historial no debe cambiar retroactivamente, permisos por rol, intentos propios, scoping por programa, contenido publicado válido.
- Mención de dependencias operativas: email, storage, backups, HTTPS, variables de entorno y QA.
- No inventar entidades que no existan, salvo en sección de recomendaciones o pendientes.
- Si hay una recomendación de cambio de modelo, marcarla como propuesta, no como hecho.

## Estructura requerida del documento

### 1. Resumen ejecutivo

Incluir:

- Propósito de la plataforma.
- Alcance del MVP: Practice Sets para tutora SAT y alumnos.
- Estado respecto al Gantt: arquitectura y modelo ya implementados funcionalmente, pendientes de validación documental/producto.
- Capacidades adelantadas: Full Practice Tests, padre/apoderado, analytics, materiales, PDF, auditoría ampliada.

### 2. Principios de arquitectura

Describir principios que guían el sistema:

- MVP primero: Practice Sets como flujo principal.
- Separación por roles y portales.
- Historial confiable e inmutable mediante snapshots.
- Seguridad por rol y scope de programa.
- Contenido académico estructurado por taxonomía SAT.
- Operación privada para tutora/alumnos, no plataforma pública masiva.
- Extensibilidad hacia Full Practice Tests sin rehacer banco de preguntas.

### 3. Vista funcional de alto nivel

Describir los módulos funcionales:

- Autenticación y cuentas.
- Roles y permisos.
- Programas, grupos e inscripciones.
- Banco de contenido académico.
- Preguntas y media.
- Practice Sets.
- Asignaciones.
- Player del alumno.
- Attempts, respuestas, autosave y scoring.
- Resultados, historial y reportes.
- Dashboard docente y analytics.
- Notificaciones.
- Auditoría.
- Admin/importación.
- Padres/apoderados.
- Full Practice Tests como extensión adelantada.
- Materiales de estudio.

Para cada módulo indicar:

- Responsabilidad.
- Usuarios involucrados.
- Rutas o capacidades principales si aplica.
- Entidades de datos relacionadas.
- Estado: MVP core, soporte operativo, extensión adelantada o post-MVP.

### 4. Flujos funcionales principales

Documentar con pasos numerados:

#### 4.1 Invitación y activación de estudiante

Debe cubrir:

- Teacher/Admin invita.
- Token de invitación.
- Activación de cuenta.
- Consentimiento parental si aplica.
- Vinculación con programa.
- Validaciones de cuenta activa/aprobada.

Entidades: `User`, `InviteToken`, `Program`, `ProgramEnrollment`, `ParentStudent`.

#### 4.2 Login y autorización

Debe cubrir:

- Login con credentials.
- Sesión JWT.
- Validación de usuario activo y aprobado.
- Redirección por rol.
- Protección server-side por layouts/helpers.

Entidades/helpers: `User`, `lib/auth.ts`, `lib/rbac.ts`, layouts de rol.

#### 4.3 Gestión académica de contenido

Debe cubrir:

- Taxonomía SAT: section, domain, topic, subskill.
- Creación/edición de preguntas.
- Estados de pregunta.
- Tipos MC y NUMERIC.
- Media, fórmulas y explicación.
- Validación antes de publicar.

Entidades: `Section`, `Domain`, `Topic`, `Subskill`, `Question`, `QuestionOption`.

#### 4.4 Creación y publicación de Practice Set

Debe cubrir:

- Practice Set pertenece a topic y dificultad.
- Asociación ordenada de preguntas.
- Validación de preguntas publicadas.
- Estados draft/published/blocked/archived.
- Configuración de visibilidad de explicación.

Entidades: `PracticeSet`, `PracticeSetQuestion`, `Question`.

#### 4.5 Asignación de Practice Set

Debe cubrir:

- Asignación individual, múltiple o por grupo.
- Fecha límite.
- Bloqueo manual y unlockAt.
- Estados pending/in progress/completed/overdue.
- Solicitud de desbloqueo.
- Notificación al alumno.

Entidades: `Assignment`, `Group`, `GroupMembership`, `UnlockRequest`, `Notification`.

#### 4.6 Resolución de Practice Set por alumno

Debe cubrir:

- Inicio o continuación de intento.
- Una pregunta por pantalla.
- Autosave.
- Tiempo total y tiempo por pregunta.
- Respuestas MC/NUMERIC.
- Blanks/omitidas.
- Pausa y continuidad.
- Submit final.

Entidades: `Attempt`, `AttemptAnswer`, `Assignment`, `PracticeSet`.

#### 4.7 Scoring, historial y revisión

Debe cubrir:

- Correctas, incorrectas, omitidas y porcentaje.
- Último intento válido como nota vigente.
- Múltiples intentos.
- Snapshots de Practice Set y preguntas.
- Revisión con visibilidad de explicaciones.
- Comentarios de profesora.
- Invalidar/reabrir intento.

Entidades: `Attempt`, `AttemptAnswer`, `AuditLog`.

#### 4.8 Seguimiento docente y reportería

Debe cubrir:

- Dashboard de alumnos.
- Pendientes/vencidos.
- Último acceso.
- Resultados recientes.
- Detalle por intento.
- Reporte individual y PDF.
- Analytics por pregunta, topic, dificultad y tiempo.

Entidades: `User`, `Assignment`, `Attempt`, `AttemptAnswer`, `Notification`, `AuditLog`.

#### 4.9 Full Practice Test como extensión

Debe cubrir solo como capacidad adelantada:

- Test con módulos SAT-like.
- Asignación.
- Attempt por alumno.
- Timer por módulo.
- Scoring por tabla de conversión.
- Resultados RW/Math/Total.

Entidades: `FullPracticeTest`, `FullPracticeTestModule`, `FullPracticeTestQuestion`, `FullPracticeTestAssignment`, `FullPracticeTestAttempt`, `FullPracticeTestAnswer`, `FullPracticeTestScoreConversion`.

### 5. Modelo de datos conceptual

Agrupar entidades por dominio:

#### 5.1 Identidad y acceso

Entidades:

- `User`
- `InviteToken`
- `PasswordResetToken`
- `ParentStudent`

Explicar:

- Roles.
- Activación.
- Validación admin.
- Menores y consentimiento.
- Tokens de invitación/reset.

#### 5.2 Programas y grupos

Entidades:

- `Program`
- `ProgramTeacher`
- `ProgramEnrollment`
- `Group`
- `GroupMembership`

Explicar:

- Un programa tiene muchos teachers y muchos students por tablas puente.
- Un alumno puede estar en más de un programa/grupo.
- El scope docente se basa en programas activos/aprobados.

#### 5.3 Taxonomía y banco de preguntas

Entidades:

- `Section`
- `Domain`
- `Topic`
- `Subskill`
- `Question`
- `QuestionOption`

Explicar:

- Jerarquía SAT.
- Pregunta pertenece a topic y opcionalmente subskill.
- Pregunta tiene opciones si es MC.
- `Question.status` controla publicación.
- `imageUrl` y contenido KaTeX/media.

#### 5.4 Practice Sets y asignaciones

Entidades:

- `PracticeSet`
- `PracticeSetQuestion`
- `Assignment`
- `UnlockRequest`

Explicar:

- `PracticeSetQuestion` es relación N:M con orden.
- `Assignment` materializa disponibilidad por alumno.
- Bloqueo manual/programado.
- Unlock request como workflow de excepción.

#### 5.5 Intentos, respuestas y snapshots

Entidades:

- `Attempt`
- `AttemptAnswer`

Explicar:

- Attempt pertenece a alumno y Practice Set; puede venir de assignment.
- AttemptAnswer es única por attempt/question.
- Snapshots preservan versión histórica.
- Estado `IN_PROGRESS`, `SUBMITTED`, `INVALIDATED`.
- `attemptNumber`, `currentQuestion`, `totalTime`, `timeSpent`.

#### 5.6 Notificaciones y auditoría

Entidades:

- `Notification`
- `AuditLog`

Explicar:

- Notificación es comunicación interna.
- Auditoría registra acciones críticas y soporte operativo.

#### 5.7 Full Practice Tests

Entidades:

- `FullPracticeTest`
- `FullPracticeTestModule`
- `FullPracticeTestQuestion`
- `FullPracticeTestAssignment`
- `FullPracticeTestAttempt`
- `FullPracticeTestAnswer`
- `FullPracticeTestScoreConversion`

Explicar:

- Reutiliza `Question`.
- Módulos modelan estructura SAT.
- Tabla de conversión permite score escalado.
- Es extensión adelantada, no bloqueo del MVP de Practice Sets.

#### 5.8 Materiales

Entidad:

- `StudyMaterial`

Explicar:

- Material publicado/draft/archive.
- Puede asociarse opcionalmente a topic.
- Soporta contenido interno o URL.

### 6. Relaciones principales

Incluir tabla de relaciones:

| Relación | Cardinalidad | Propósito |
|---|---:|---|
| Program -> ProgramTeacher -> User | N:M | Profesores asignados a programas. |
| Program -> ProgramEnrollment -> User | N:M | Alumnos inscritos en programas. |
| Group -> GroupMembership -> User | N:M | Agrupación operativa de alumnos. |
| Section -> Domain -> Topic -> Question | 1:N jerárquico | Taxonomía académica SAT. |
| Topic -> PracticeSet | 1:N | Sets por tema. |
| PracticeSet -> PracticeSetQuestion -> Question | N:M | Preguntas ordenadas dentro de set. |
| User(student) -> Assignment | 1:N | Tareas asignadas al alumno. |
| Assignment -> Attempt | 1:N | Intentos asociados a una asignación. |
| Attempt -> AttemptAnswer | 1:N | Respuestas del intento. |
| User -> Notification | 1:N | Notificaciones por usuario. |
| User -> AuditLog | 1:N | Acciones auditadas por usuario actor. |
| ParentStudent | N:M | Padres vinculados a alumnos. |
| FullPracticeTest -> FullPracticeTestModule | 1:N | Módulos SAT-like. |
| FullPracticeTestModule -> FullPracticeTestQuestion -> Question | N:M | Preguntas ordenadas por módulo. |

### 7. Estados y reglas de negocio

Documentar reglas:

- `User.active` y `User.validationStatus`.
- `Program.active`, `deletedAt`, vigencia teacher/enrollment.
- `Question.status`: draft/published/archived.
- `PracticeSet.status`: draft/published/blocked/archived.
- `Assignment.status`: pending/in progress/completed/overdue.
- `Attempt.status`: in progress/submitted/invalidated.
- `UnlockRequest.status`: pending/approved/denied.
- `FullPracticeTest.status`: draft/published/archived.

Incluir invariantes:

- Un alumno solo puede operar sus propios attempts.
- Un teacher solo gestiona alumnos dentro de sus programas activos/aprobados.
- Un Practice Set publicado no debe tener preguntas incompletas o no publicadas.
- Un intento enviado no debe recalcularse con contenido editado posteriormente.
- Un re-submit de intento ya enviado debe rechazarse.
- Los blanks se contabilizan como omitidos.
- El desbloqueo automático no debe saltarse bloqueo manual ni unlockAt.

### 8. Permisos y seguridad

Incluir matriz por rol:

| Capacidad | Admin | Teacher | Student | Parent |
|---|---:|---:|---:|---:|
| Validar usuarios | Si | No | No | No |
| Gestionar programas globales | Si | Limitado | No | No |
| Invitar/editar alumnos | Si | Si, por scope | No | No |
| Crear preguntas/sets | Si | Si | No | No |
| Asignar Practice Sets | Si | Si, por scope | No | No |
| Resolver Practice Sets | No | No | Si, propios | No |
| Ver intentos de alumno | Si | Si, por scope | Propios | Hijos vinculados, limitado |
| Ver banco de preguntas | Si | Si | No | No |
| Resolver unlock requests | Si | Si, por scope | No | No |
| Ver auditoría | Si | Limitado/no | No | No |

Explicar:

- Protección server-side por layouts y helpers.
- Por qué no se depende de middleware Edge para Prisma/better-sqlite3.
- Necesidad de HTTPS, hashing de password, URLs privadas/storage productivo y rate limiting básico como pendientes productivos.

### 9. Arquitectura técnica resumida

Describir stack actual:

- Next.js App Router.
- TypeScript.
- React.
- Prisma 7.
- SQLite con `better-sqlite3` en desarrollo.
- NextAuth Credentials.
- Tailwind/Radix/lucide.
- KaTeX.
- Nodemailer/Brevo SMTP.

Describir capas:

- UI por portal: auth, student, teacher, admin, parent.
- Server routes/API.
- Helpers de dominio: auth, RBAC, scope, scoring, snapshots, notifications, storage.
- Prisma schema como contrato de persistencia.
- Scripts de QA y operación.

### 10. Operación y dependencias externas

Documentar:

- SMTP para invitaciones/reset.
- Storage productivo para avatars/media.
- Backups automáticos de base y archivos.
- Variables de entorno.
- HTTPS/TLS en producción.
- Logs/observabilidad.
- Seed/carga inicial de contenido.

Separar:

- Ya existe para desarrollo.
- Pendiente para producción/piloto.

### 11. Riesgos y decisiones pendientes

Incluir al menos:

- Validación con contenido real.
- Storage productivo.
- Políticas de retención/eliminación.
- Backup automático.
- Formato final de importación masiva.
- Versionado explícito de banco vs snapshots históricos.
- Pruebas E2E reales de navegador.
- Confirmar si Full Practice Tests entran o no en MVP contractual.

### 12. Criterios de aceptación del documento

El agente debe cerrar el trabajo solo si:

- El archivo `ARQUITECTURA_FUNCIONAL_Y_MODELO_DATOS.md` existe.
- Describe arquitectura funcional y modelo de datos.
- Usa entidades reales del schema.
- Incluye relaciones, estados, flujos y permisos.
- Diferencia MVP vs extensión.
- Declara pendientes productivos.
- No contradice `STATUS_PROYECTO_VS_GANTT.md`.
- Puede ser leído por una persona no técnica sin perder precisión técnica.

## Proceso recomendado para el agente

1. Leer documentos fuente obligatorios.
2. Extraer entidades reales desde `prisma/schema.prisma`.
3. Agrupar entidades por dominio funcional.
4. Mapear cada flujo MVP a entidades y permisos.
5. Redactar el documento con la estructura requerida.
6. Revisar consistencia contra `STATUS_PROYECTO_VS_GANTT.md`.
7. Revisar que las capacidades de Full Practice Tests estén marcadas como extensión adelantada.
8. Ejecutar una lectura final del documento para eliminar duplicación, promesas no implementadas y ambigüedades.

## Restricciones

- No modificar código.
- No modificar `prisma/schema.prisma`.
- No cambiar `plan.md` salvo que el usuario lo pida.
- No marcar como implementado algo que solo sea recomendación.
- No convertir pendientes operativos en alcance cerrado.
- No omitir riesgos críticos por mantener tono optimista.

