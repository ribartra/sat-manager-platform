# Script de presentacion del software y flujos de usuario

## Objetivo

Presentar la Plataforma SAT desde lo que ya funciona en el codigo y en la base regenerada con Prisma. La demo debe mostrar el valor del producto, las funcionalidades disponibles por rol y los flujos principales que deben validarse con usuarios reales.

El punto de partida recomendado es una base limpia regenerada con migraciones y seed. Desde ahi se muestran los flujos reales usando los usuarios de prueba, Practice Sets, Full Practice Tests, grupos, programas y contenido SAT cargado por `prisma/seed.ts`.

## Preparacion antes de la presentacion

1. Regenerar la base de datos local:

```bash
npm run db:reset
```

2. Validar Prisma y generar cliente:

```bash
npm run prisma:validate
npm run prisma:generate
```

3. Levantar la aplicacion:

```bash
npm run dev
```

4. Abrir:

```text
http://localhost:3000
```

5. Tener disponibles estas cuentas seed:

| Rol | Email | Password | Uso en demo |
|---|---|---|---|
| Admin | `admin@sat.com` | `admin123` | Administracion, usuarios, profesores, programas, importacion y logs. |
| Teacher | `teacher@sat.com` | `teacher123` | Dashboard docente, contenido, Practice Sets, asignaciones, analytics y reportes. |
| Student | `student1@sat.com` | `student123` | Alumna con actividad, assignments y resultados. |
| Student | `student2@sat.com` | `student123` | Alumno con assignments pendientes. |
| Parent | `parent@sat.com` | `parent123` | Vista de progreso de alumno vinculado. |

## Mensaje de apertura

"Esta plataforma centraliza la operacion academica SAT para una tutora, sus alumnos y padres. El flujo principal del MVP es Practice Sets: la profesora administra contenido SAT, crea sets por tema y dificultad, los asigna a alumnos, el alumno resuelve con autosave y scoring, y la profesora revisa resultados, progreso y necesidades de refuerzo.

La base que estamos viendo fue regenerada desde Prisma, por lo que la demo parte de datos consistentes: usuarios por rol, programa SAT Core, grupos, taxonomia SAT, preguntas, Practice Sets, asignaciones, intentos, notificaciones, materiales y Full Practice Tests como capacidad adelantada."

## Funcionalidades que deben demostrarse

### 1. Acceso, roles y redireccion

Guion:

"La plataforma separa la experiencia por rol. Al iniciar sesion, el sistema valida usuario activo, estado aprobado y rol. Un teacher o admin entra al portal docente; un student entra a su dashboard; un parent entra al seguimiento de sus hijos. Esto evita que un alumno vea herramientas docentes o administrativas."

Demostrar:

- Login en `/login`.
- Redireccion automatica desde `/`.
- Teacher/Admin a `/teacher`.
- Student a `/student`.
- Parent a `/parent`.
- Cuentas pendientes o rechazadas quedan fuera del flujo principal.

### 2. Portal docente: tablero operativo

Entrar como:

```text
teacher@sat.com / teacher123
```

Guion:

"La vista docente esta pensada para operar el dia a dia: alumnos, pendientes, assignments vencidos, solicitudes de desbloqueo, ultimos intentos y filtros por grupo, topic, dificultad o fechas. Desde aqui la profesora puede detectar rapidamente quien no practico, quien tiene tareas pendientes y que resultados requieren revision."

Demostrar:

- `/teacher`: listado de alumnos, filtros y alertas.
- Detalle de alumno desde `/teacher/students/[studentId]`.
- Intentos recientes, resultados y acciones docentes.
- Impersonation de alumno en modo lectura si se necesita explicar soporte academico.

### 3. Programas, grupos e inscripciones

Guion:

"El modelo organiza alumnos y profesores alrededor de programas. El seed incluye SAT Core Program como programa activo. Encima de eso se gestionan grupos, horarios y membresias. Esto permite filtrar contenido y progreso por cohortes reales."

Demostrar:

- `/teacher/programs`: programa SAT Core e inscripciones.
- `/teacher/groups`: grupos A y B con miembros.
- Scope por programa para que el docente trabaje sobre sus alumnos.

### 4. Banco de contenido SAT

Guion:

"El banco de contenido estructura las preguntas segun la taxonomia SAT: secciones, dominios, topics y subskills. Cada pregunta tiene tipo, dificultad, estado, respuesta correcta, explicacion y soporte para contenido matematico o media. Esto es la base para crear Practice Sets reutilizables y, mas adelante, examenes completos."

Demostrar:

- `/teacher/content`: mapa de contenido.
- `/teacher/questions`: banco de preguntas con filtros.
- Crear o editar pregunta en `/teacher/questions/new`.
- Tipos `MC` y `NUMERIC`.
- Estados `DRAFT`, `PUBLISHED`, `ARCHIVED`.
- Importacion masiva desde `/admin/import` si se entra como admin.

### 5. Practice Sets

Guion:

"El Practice Set es el nucleo del MVP. La profesora selecciona un topic y dificultad, arma una secuencia de preguntas publicadas, define visibilidad de explicaciones y publica el set. Solo los sets publicados pueden asignarse."

Demostrar:

- `/teacher/practice-sets`: listado de Practice Sets.
- Practice Sets seed:
  - `Linear Equations - Easy #1`
  - `Linear Equations - Medium #1`
- Ver cantidad de preguntas, topic, dificultad, estado y asignaciones.
- Crear nuevo set en `/teacher/practice-sets/new`.
- Editar set existente.

Puntos a mencionar:

- `PracticeSet.status`: `DRAFT`, `PUBLISHED`, `BLOCKED`, `ARCHIVED`.
- `PracticeSet.explanationVisibility`: `IMMEDIATE`, `AFTER_FINISH`, `HIDDEN`.
- La publicacion debe depender de preguntas validas y publicadas.

### 6. Asignacion a alumnos

Guion:

"La profesora asigna Practice Sets a uno o varios alumnos. Puede definir fecha limite, bloqueo o desbloqueo programado. El sistema registra la asignacion, notifica al alumno y luego actualiza el estado segun progreso: pendiente, en progreso, completado o vencido."

Demostrar:

- Entrar al detalle de un alumno.
- Usar la accion de asignar Practice Sets.
- Revisar assignments en dashboard docente.
- Mostrar solicitudes de desbloqueo si existen.

Puntos a mencionar:

- Se evita asignar Practice Sets no publicados.
- El estado del assignment se recalcula para vencidos.
- Existe flujo de `UnlockRequest` para que el alumno pida acceso.

### 7. Portal alumno y resolucion de Practice Set

Entrar como:

```text
student1@sat.com / student123
```

Guion:

"El alumno ve su carga de trabajo, assignments pendientes, resultados recientes e historial. Al abrir un Practice Set, resuelve una pregunta por pantalla. El sistema guarda progreso con autosave, tiempos, respuestas, notas, marcadores y permite continuar si sale antes de terminar."

Demostrar:

- `/student`: dashboard con pending Practice Sets, promedio y resultados recientes.
- `/student/practice-sets`: lista de asignaciones.
- Abrir una asignacion en `/student/practice/assignment/[assignmentId]`.
- Resolver preguntas tipo alternativa y numerica.
- Pausar o continuar.
- Enviar intento.
- Ver resultado en `/student/results/[attemptId]`.

Puntos a mencionar:

- El intento guarda snapshot del Practice Set y de cada pregunta.
- Esto protege el historial si luego la profesora edita una pregunta.
- Se registran correctas, incorrectas, omitidas y porcentaje.

### 8. Historial, resultados y revision

Guion:

"Despues del submit, el alumno y la profesora pueden revisar resultados. La revision respeta la visibilidad configurada para explicaciones. El historial permite filtrar por seccion, topic, dificultad y fecha."

Demostrar:

- `/student/history`.
- Resultado individual en `/student/results/[attemptId]`.
- Como teacher, entrar al intento del alumno.
- Agregar comentario docente.
- Reabrir o invalidar intento cuando aplique.
- Reporte individual y PDF desde vista docente.

### 9. Analytics y seguimiento docente

Guion:

"La profesora no solo ve notas finales. Tambien puede analizar desempeno por pregunta, topic, dificultad y tiempo. Esto convierte la practica en informacion accionable para planificar refuerzos."

Demostrar:

- `/teacher/analytics`.
- `/teacher/compare`.
- Detalle de alumno y reporte.
- PDF individual si se requiere evidencia exportable.

### 10. Portal de padres

Entrar como:

```text
parent@sat.com / parent123
```

Guion:

"El rol padre tiene una vista limitada al progreso de sus hijos vinculados. No administra contenido ni assignments. Su objetivo es dar visibilidad simple: intentos recientes y promedio."

Demostrar:

- `/parent`.
- Alumno vinculado.
- Intentos recientes y promedio.

Puntos a mencionar:

- El modelo soporta consentimiento parental para menores.
- Hay cuentas seed de menores y padres pendientes para validar edge cases.

### 11. Administracion

Entrar como:

```text
admin@sat.com / admin123
```

Guion:

"El admin gestiona la operacion base: validacion de usuarios, profesores, programas, importacion de contenido y logs. Esto separa la operacion academica de la administracion del sistema."

Demostrar:

- `/admin/users`: aprobar/rechazar cuentas.
- `/admin/teachers`: activar/desactivar profesores.
- `/admin/programs`: programas.
- `/admin/import`: carga masiva con preview/validacion.
- `/admin/logs`: auditoria.

### 12. Full Practice Tests como capacidad adelantada

Guion:

"Ademas del MVP de Practice Sets, el sistema ya incluye una base funcional para Full Practice Tests tipo SAT. Esto no debe bloquear el cierre del MVP, pero demuestra que el modelo ya puede extenderse hacia examenes completos con modulos, timer y scoring escalado."

Demostrar:

- Como teacher: `/teacher/full-tests`.
- Scoring table: `/teacher/full-tests/scoring`.
- Asignar examen desde detalle.
- Como student: `/student/full-tests`.
- Resolver o continuar examen.
- Ver resultado RW, Math y total.

Puntos a mencionar:

- El seed incluye 8 Full Practice Tests publicados.
- Cada test tiene 4 modulos: RW Module 1, RW Module 2, Math Module 1 y Math Module 2.
- La tabla de conversion soporta puntajes SAT por seccion.

## Flujo recomendado para una demo de 30 a 45 minutos

### Bloque 1 - Contexto y login

1. Explicar objetivo del software.
2. Mostrar login.
3. Entrar como teacher.
4. Mostrar redireccion por rol y dashboard docente.

### Bloque 2 - Operacion docente

1. Mostrar alumnos, filtros y alertas.
2. Mostrar programa SAT Core y grupos.
3. Abrir banco de preguntas.
4. Explicar taxonomia SAT y estados de pregunta.
5. Mostrar Practice Sets publicados.
6. Asignar un Practice Set a un alumno.

### Bloque 3 - Experiencia alumno

1. Cerrar sesion e ingresar como student.
2. Mostrar dashboard del alumno.
3. Abrir Practice Set asignado.
4. Resolver parcialmente para evidenciar autosave.
5. Enviar intento.
6. Revisar resultado e historial.

### Bloque 4 - Seguimiento y reporte

1. Volver como teacher.
2. Abrir detalle del alumno.
3. Revisar intento.
4. Agregar comentario.
5. Mostrar analytics.
6. Mostrar reporte/PDF.

### Bloque 5 - Roles complementarios

1. Entrar como parent y mostrar progreso limitado.
2. Entrar como admin y mostrar usuarios, programas, import y logs.
3. Cerrar con Full Practice Tests como extension adelantada.

## Que ya funciona

- Autenticacion con roles `ADMIN`, `TEACHER`, `STUDENT` y `PARENT`.
- Validacion de usuarios activos y aprobados.
- Invitacion, activacion, reset y cambio de password.
- Programas, profesores por programa, inscripciones y grupos.
- Consentimiento/vinculo parental.
- Taxonomia SAT: secciones, dominios, topics y subskills.
- Banco de preguntas con dificultad, tipo, estado, opciones, explicacion y media.
- Practice Sets con preguntas ordenadas, estados y visibilidad de explicaciones.
- Asignaciones con due date, bloqueo, unlock programado y solicitudes de desbloqueo.
- Player del alumno con autosave, continuidad, tiempos, respuestas, notas y omitidas.
- Scoring, historial y snapshots.
- Revision de resultados por alumno y profesor.
- Comentarios docentes, reabrir e invalidar intentos.
- Dashboard docente, analytics, comparacion y reportes.
- Notificaciones internas.
- Auditoria.
- Importacion masiva admin.
- Portal padre.
- Materiales de estudio.
- Full Practice Tests con modulos, timer, autosave y scoring escalado.

## Que deberia hacerse antes de piloto

1. Regenerar base con Prisma y confirmar que el seed cubre todos los escenarios de demo.
2. Ejecutar una demo interna completa con los cuatro roles.
3. Documentar cada flujo con capturas y resultado esperado.
4. Cargar contenido real inicial desde PDFs o fuente aprobada.
5. Revisar academicamente preguntas, alternativas, respuestas y explicaciones.
6. Validar visualmente formulas, tablas, imagenes y textos largos.
7. Probar invitacion, activacion y reset con SMTP real.
8. Definir storage productivo para media y avatars.
9. Definir deploy, dominio, HTTPS, variables de entorno, backups y monitoreo.
10. Ejecutar QA manual end-to-end con cuentas piloto.
11. Hacer sesion con la profesora para validar dashboard, asignaciones, reportes y metricas.
12. Separar el cierre MVP de Practice Sets de las extensiones Full Practice Test.

## Pasos a seguir para construir los flujos desde BD regenerada y codigo

### Paso 1 - Congelar el escenario base

Usar `npm run db:reset` como punto de partida. Confirmar que existen:

- Programa `SAT Core Program`.
- Teacher aprobado.
- Admin aprobado.
- Students aprobados, pendientes, rechazados, sin inscripcion y menores.
- Padres vinculados y pendientes.
- Grupos A y B.
- Taxonomia SAT.
- Practice Sets publicados.
- Assignments en estados distintos.
- Intentos submitted e in progress.
- Full Practice Tests publicados.

### Paso 2 - Mapear cada flujo a datos Prisma

Crear una matriz de flujo contra entidades:

| Flujo | Entidades clave |
|---|---|
| Login y rol | `User` |
| Invitacion | `InviteToken`, `User`, `ProgramEnrollment`, `ParentStudent` |
| Programa/grupo | `Program`, `ProgramTeacher`, `ProgramEnrollment`, `Group`, `GroupMembership` |
| Banco de preguntas | `Section`, `Domain`, `Topic`, `Subskill`, `Question`, `QuestionOption` |
| Practice Set | `PracticeSet`, `PracticeSetQuestion` |
| Assignment | `Assignment`, `UnlockRequest`, `Notification` |
| Player | `Attempt`, `AttemptAnswer` |
| Resultados | `Attempt`, `AttemptAnswer`, snapshots |
| Auditoria | `AuditLog` |
| Parent | `ParentStudent`, `Attempt`, `AttemptAnswer` |
| Full Test | `FullPracticeTest`, `FullPracticeTestModule`, `FullPracticeTestQuestion`, `FullPracticeTestAssignment`, `FullPracticeTestAttempt`, `FullPracticeTestAnswer`, `FullPracticeTestScoreConversion` |

### Paso 3 - Validar rutas por rol

Recorrer y documentar:

- Teacher: `/teacher`, `/teacher/students/[studentId]`, `/teacher/questions`, `/teacher/practice-sets`, `/teacher/analytics`, `/teacher/full-tests`.
- Student: `/student`, `/student/practice-sets`, `/student/practice/assignment/[assignmentId]`, `/student/results/[attemptId]`, `/student/history`, `/student/full-tests`.
- Parent: `/parent`.
- Admin: `/admin/users`, `/admin/teachers`, `/admin/programs`, `/admin/import`, `/admin/logs`.

### Paso 4 - Convertir demo en pruebas manuales

Por cada flujo, registrar:

- Usuario usado.
- Ruta inicial.
- Accion realizada.
- Datos esperados antes.
- Resultado esperado despues.
- Entidades que cambian.
- Evidencia: captura, ID de registro o log.

### Paso 5 - Corregir brechas de producto

Priorizar hallazgos asi:

1. Bloqueantes de login, permisos o perdida de datos.
2. Bloqueantes del player y submit.
3. Errores de scoring o historial.
4. Problemas de asignacion/desbloqueo.
5. Problemas visuales en preguntas SAT.
6. Mejoras de dashboard, reportes y analytics.
7. Extensiones Full Practice Test.

## Cierre sugerido para la presentacion

"El software ya cubre el flujo completo del MVP: la profesora administra contenido, crea y asigna Practice Sets; el alumno resuelve con autosave y scoring; la profesora revisa resultados y reportes; el padre puede ver progreso; y el admin opera usuarios, programas, importacion y auditoria.

Lo que falta para declarar MVP validado no es construir el flujo base, sino validarlo con contenido real, usuarios piloto, SMTP/storage productivo y QA manual con evidencia. La recomendacion es cerrar primero Practice Sets como MVP y dejar Full Practice Tests como extension ya avanzada para fase posterior o demo secundaria."
