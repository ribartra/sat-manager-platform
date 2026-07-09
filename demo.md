# Demo de utilizacion - Plataforma SAT

**Objetivo:** ejecutar una muestra completa del sistema para validar la Fase 1 con datos seed: administracion, profesor, alumno, padre, Practice Sets, Full Practice Tests, reportes, notificaciones, auditoria y calculadora matematica parametrizable.

**Base funcional:** el seed crea usuarios demo, programa SAT Core, grupos, taxonomia SAT, Practice Sets, 8 Full Practice Tests con estructura SAT, conversion de puntaje, intentos completados/en progreso y casos de permisos.

---

## 1. Preparacion del entorno

### 1.1 Variables minimas

Crear `.env` desde `.env.example` o verificar estas variables:

```bash
DATABASE_URL="file:./dev.db"
AUTH_SECRET="replace-with-a-random-secret"
AUTH_URL="http://localhost:3000"
CORS_ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
BACKUP_DIR="./backups"
NEXT_PUBLIC_CALCULATOR_PROVIDER="desmos_sat"
NEXT_PUBLIC_CALCULATOR_PRACTICE_SETS="true"
NEXT_PUBLIC_CALCULATOR_FULL_TESTS="true"
```

Para probar proveedores alternativos de calculadora:

```bash
# Desmos SAT embebido
NEXT_PUBLIC_CALCULATOR_PROVIDER="desmos_sat"

# Desmos API, requiere key publica de Desmos
NEXT_PUBLIC_CALCULATOR_PROVIDER="desmos_api"
NEXT_PUBLIC_DESMOS_API_KEY="..."

# GeoGebra iframe
NEXT_PUBLIC_CALCULATOR_PROVIDER="geogebra"

# GeoGebra Apps API
NEXT_PUBLIC_CALCULATOR_PROVIDER="geogebra_api"

# Fallbacks locales sin servicio externo
NEXT_PUBLIC_CALCULATOR_PROVIDER="local_2d"
NEXT_PUBLIC_CALCULATOR_PROVIDER="local_3d"

# Sin calculadora
NEXT_PUBLIC_CALCULATOR_PROVIDER="none"
```

### 1.2 Instalar, preparar DB y levantar app

```bash
npm install
npm run prisma:generate
npm run db:seed
npm run dev
```

Abrir:

```text
http://localhost:3000
```

Antes de una demo formal, ejecutar calidad completa:

```bash
npm run quality
```

La suite valida Prisma, lint, TypeScript, permisos, edge cases, FPT, calculadora parametrica y build.

---

## 2. Cuentas demo

| Rol | Usuario | Password | Caso de demo |
|---|---|---|---|
| Admin | `admin@sat.com` | `admin123` | Admin aprobado con acceso a `/admin/*` y `/teacher/*`. |
| Teacher | `teacher@sat.com` | `teacher123` | Profesora aprobada asignada a SAT Core Program. |
| Teacher pendiente | `teacher.pending@sat.com` | `teacher123` | Cuenta pendiente para validar bloqueo por aprobacion. |
| Parent | `parent@sat.com` | `parent123` | Padre aprobado vinculado a Ana Torres. |
| Parent pendiente | `parent.pending@sat.com` | `parent123` | Padre pendiente sin alumno aprobado. |
| Student 1 | `student1@sat.com` | `student123` | Ana Torres: alumno principal con Practice Set completado y FPT completado. |
| Student 2 | `student2@sat.com` | `student123` | Alumno con assignment vencido y FPT pendiente. |
| Student 3 | `student3@sat.com` | `student123` | Alumno con FPT en progreso. |
| Student 4 | `student4@sat.com` | `student123` | Alumno aprobado en SAT Core. |
| Student pendiente | `student.pending@sat.com` | `student123` | Cuenta pendiente de validacion. |
| Student rechazado | `student.rejected@sat.com` | `student123` | Cuenta rechazada. |
| Student sin programa | `student.noenroll@sat.com` | `student123` | Cuenta aprobada sin inscripcion. |
| Student menor A | `student.minor@sat.com` | `student123` | Menor esperando aprobacion parental. |
| Student menor B | `student.minor2@sat.com` | `student123` | Menor con padre aprobado, esperando profesor. |
| Parent menor | `parent.minor@sat.com` | `parent123` | Padre de casos menores. |

---

## 3. Guion principal de demo

### 3.1 Admin: control de cuentas y auditoria

1. Iniciar sesion con `admin@sat.com`.
2. Ir a `/admin/users`.
3. Confirmar que aparecen cuentas `PENDING`, `APPROVED` y `REJECTED`.
4. Abrir `/admin/teachers` y validar activacion/desactivacion de profesores.
5. Abrir `/admin/programs` y revisar `SAT Core Program`.
6. Abrir `/admin/import` para mostrar la entrada de importacion masiva.
7. Abrir `/admin/logs`.

Resultado esperado:

- Admin puede ver y operar cuentas, programas, profesores, import y logs.
- Los eventos seed relevantes aparecen en auditoria, incluyendo `SEED_QA_TRANSITION_READY` y `SEED_QA_FPT_MOCKS_READY`.
- Usuarios pendientes/rechazados no entran al portal funcional hasta aprobarse.

### 3.2 Teacher: operacion diaria

1. Cerrar sesion e ingresar con `teacher@sat.com`.
2. Abrir `/teacher`.
3. Revisar alumnos, pendientes, vencidos, ultimos resultados y alertas.
4. Abrir `/teacher/groups` y validar `Group A` y `Group B`.
5. Abrir `/teacher/programs` y confirmar alcance del programa.
6. Abrir `/teacher/content` y revisar taxonomia SAT:
   - `Mathematics`
   - `Reading & Writing`
   - dominios SAT oficiales
   - dificultades `Easy`, `Medium`, `Hard`
7. Abrir `/teacher/questions`.
8. Crear o editar una pregunta:
   - tipo `MC` con A/B/C/D o `NUMERIC`
   - dificultad
   - respuesta correcta unica
   - explicacion
   - formulas con KaTeX
9. Abrir `/teacher/practice-sets/new` y crear un Practice Set por topic/difficulty.
10. Abrir detalle de un alumno, por ejemplo Ana Torres, desde `/teacher`.
11. Usar asignacion de Practice Set para un estudiante o grupo.
12. Revisar unlock requests si existen.

Resultado esperado:

- La profesora opera solo alumnos dentro de su scope de programa.
- Los Practice Sets respetan topic, difficulty, estado y reglas de publicacion.
- Las preguntas incompletas no deben ser publicables/calificables.

### 3.3 Student: Practice Set end-to-end

1. Ingresar con `student1@sat.com`.
2. Abrir `/student`.
3. Confirmar pendientes, resultados recientes y estado del programa.
4. Abrir `/student/content-map`.
5. Entrar a un topic visible con ejercicios, por ejemplo `Linear Equations`.
6. Abrir un Practice Set asignado desde `/student/practice/assignment/[assignmentId]`.
7. Resolver preguntas:
   - seleccionar MC
   - responder NUMERIC
   - dejar una pregunta en blanco
   - usar notas
   - marcar for review
   - eliminar visualmente opciones
8. Cambiar de pregunta y salir con pausa.
9. Volver al Practice Set y confirmar que autosave recupera respuestas, notas, tiempo, pregunta actual y marcas.
10. Enviar con `Submit/Finish`.
11. Abrir resultado en `/student/results/[attemptId]`.
12. Revisar score, correctas, incorrectas, omitidas, explicaciones si estan habilitadas y boton de reintento.

Resultado esperado:

- Score Practice Set se calcula como `correctas / total`.
- Blanks cuentan como omitidas/no correctas.
- El intento queda historico con snapshots de preguntas y set.
- Si el alumno aprueba con umbrales configurados, la logica de transicion puede desbloquear/crear siguiente asignacion segun reglas:
  - `>=70%` para avanzar dentro del mismo nivel/tema.
  - `>=75%` para pasar a siguiente dificultad, sin saltar bloqueos manuales de profesora.

### 3.4 Student: Full Practice Test SAT-like

1. Ingresar con `student2@sat.com` o `student3@sat.com`.
2. Abrir `/student/full-tests`.
3. Seleccionar un Full Practice Test asignado.
4. Validar estructura:
   - Reading & Writing Module 1, 27 preguntas.
   - Reading & Writing Module 2, 27 preguntas.
   - Math Module 1, 22 preguntas.
   - Math Module 2, 22 preguntas.
5. Resolver algunas preguntas y pausar.
6. Reingresar y confirmar continuidad de modulo, pregunta, respuestas y timer.
7. En Math, abrir la calculadora.
8. Probar proveedor activo:
   - `desmos_sat`: iframe SAT Desmos.
   - `desmos_api`: API Desmos con expresiones iniciales.
   - `geogebra`: iframe GeoGebra.
   - `geogebra_api`: GeoGebra Apps API.
   - `local_2d`: canvas local con slider.
   - `local_3d`: fallback 3D local.
9. Dejar que el timer llegue a cero o simular avance hasta registrar overtime si corresponde.
10. Enviar FPT.
11. Abrir `/student/full-tests/results/[attemptId]`.

Resultado esperado:

- El FPT no auto-envia por regla base.
- Se registra `time expired` y tiempo extra si aplica.
- El resultado muestra:
  - Reading & Writing score 200-800.
  - Math score 200-800.
  - Total SAT score 400-1600.
  - raw score y porcentaje.
  - desglose por modulo, topic y dificultad.
  - review con explicaciones cuando esta habilitado.

### 3.5 Teacher: reporte individual y progreso temporal

1. Ingresar con `teacher@sat.com`.
2. Abrir un alumno desde `/teacher`.
3. Entrar a `/teacher/students/[studentId]/report`.
4. Revisar:
   - average score
   - last valid score
   - progress by topic
   - progress by difficulty
   - weak topics
   - recent attempts
   - `Score Progress Over Time`
5. Descargar PDF desde `Download PDF`.

Resultado esperado:

- El reporte incluye progreso en el tiempo respecto al puntaje obtenido.
- Los intentos invalidados no contaminan metricas principales.
- El PDF conserva resumen, progreso, debilidades y referencias de resultados.

### 3.6 Teacher: analytics y revision academica

1. Abrir `/teacher/analytics`.
2. Revisar:
   - preguntas con mas fallos.
   - respuestas seleccionadas.
   - tiempo por pregunta.
   - breakdown por topic.
   - breakdown por difficulty.
3. Entrar desde un item a la pregunta asociada cuando aplique.

Resultado esperado:

- La profesora identifica preguntas problematicas y bajo desempeno por taxonomia SAT.
- Los datos se calculan desde intentos y respuestas guardadas.

### 3.7 Parent: progreso del alumno

1. Ingresar con `parent@sat.com`.
2. Abrir `/parent`.
3. Revisar progreso reciente del alumno vinculado.
4. Probar `parent.pending@sat.com` para validar restriccion por estado pendiente.

Resultado esperado:

- Padre aprobado ve solo alumnos vinculados.
- Padre pendiente o sin autorizacion no accede a informacion de otros alumnos.

---

## 4. Casos de permisos para mostrar

| Caso | Accion | Esperado |
|---|---|---|
| Teacher pendiente | Login con `teacher.pending@sat.com` | Redireccion a estado pendiente o bloqueo funcional. |
| Student pendiente | Login con `student.pending@sat.com` | No accede al portal aprobado. |
| Student rechazado | Login con `student.rejected@sat.com` | Bloqueado por validacion. |
| Student sin programa | Login con `student.noenroll@sat.com` | Ve flujo sin inscripcion activa. |
| Parent pendiente | Login con `parent.pending@sat.com` | Sin acceso a datos aprobados. |
| Teacher fuera de scope | Intentar operar alumno fuera de su programa | API debe devolver forbidden/not found segun ruta. |

---

## 5. Datos seed que debe evidenciar la demo

| Area | Dato esperado |
|---|---|
| Programa | `SAT Core Program`. |
| Grupos | `Group A`, `Group B`. |
| Practice Sets | `Linear Equations - Easy #1`, `Linear Equations - Easy #2`, `Linear Equations - Medium #1`. |
| Taxonomia Math | Algebra, Advanced Math, Problem Solving and Data Analysis, Geometry and Trigonometry. |
| Taxonomia RW | Information and Ideas, Craft and Structure, Expression of Ideas, Standard English Conventions. |
| FPT | 8 Full Practice Tests publicados. |
| FPT modules | 4 modulos por test: RW 1, RW 2, Math 1, Math 2. |
| FPT distribucion | RW 27+27, Math 22+22. |
| Scoring | RW raw 0-54 y Math raw 0-44 con escala 200-800. |
| Assignments FPT | Casos completed, pending e in_progress. |
| Auditoria seed | `SEED_QA_TRANSITION_READY`, `SEED_QA_FPT_MOCKS_READY`. |

---

## 6. Operacion auxiliar durante la demo

### 6.1 Notificaciones

Generar notificaciones operativas:

```bash
npm run notifications:generate
```

Luego abrir `/notifications` con teacher o student.

### 6.2 Backup local

Crear respaldo:

```bash
npm run db:backup
```

Restaurar respaldo:

```bash
npm run db:restore -- <archivo>
```

### 6.3 Validacion automatizada rapida

```bash
npm run qa:p0
npm run qa:authz
npm run qa:edge
```

### 6.4 Validacion completa

```bash
npm run quality
```

---

## 7. Checklist de aceptacion de la muestra

- [ ] Admin valida usuarios y ve auditoria.
- [ ] Teacher gestiona alumnos, grupos, programas, preguntas y Practice Sets.
- [ ] Teacher asigna Practice Sets individualmente o por grupo.
- [ ] Student resuelve Practice Set con autosave, pausa, blanks y submit.
- [ ] Resultado de Practice Set muestra score, correctas, incorrectas, omitidas y revision segun visibilidad.
- [ ] Logica de transicion respeta `>=70%`, `>=75%` y bloqueos manuales.
- [ ] Student abre Full Practice Test SAT-like con 4 modulos y timers por modulo.
- [ ] Math muestra calculadora segun `NEXT_PUBLIC_CALCULATOR_PROVIDER`.
- [ ] FPT calcula raw score, RW, Math y Total SAT.
- [ ] Teacher ve reporte individual con progreso temporal del score.
- [ ] Teacher descarga PDF de reporte.
- [ ] Teacher usa analytics por pregunta, topic, difficulty y tiempo.
- [ ] Parent ve progreso solo de alumno vinculado.
- [ ] Cuentas pendientes/rechazadas quedan bloqueadas.
- [ ] `npm run quality` pasa antes de cerrar la demo.

---

## 8. Narrativa sugerida de demo

1. **Contexto:** mostrar que el sistema cubre operacion SAT por roles y que la UI visible usa taxonomia SAT en ingles.
2. **Control:** entrar como admin para validar cuentas, programas y auditoria.
3. **Operacion docente:** entrar como teacher para revisar dashboard, alumnos, contenido, preguntas y asignaciones.
4. **Experiencia alumno:** resolver Practice Set, pausar, continuar y enviar.
5. **Reglas academicas:** explicar score, blanks, explicaciones, snapshots y transicion entre niveles.
6. **FPT:** ejecutar Full Practice Test con estructura SAT, calculadora parametrica y score 400-1600.
7. **Seguimiento:** mostrar reporte individual con progreso temporal y PDF.
8. **Gobierno:** cerrar con analytics, notificaciones, backups, permisos y suite `quality`.
