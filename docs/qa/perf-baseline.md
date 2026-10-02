# Línea base de tiempos de carga (RNF-6)

**Fecha:** 2026-09-30 · **Build:** producción (`next start`), rama `feat/obs-fixes-nav-stats-review`
**Datos:** copia de `dev.db` con un alumno de prueba. Tiene 26 intentos de Practice, 3 de FPT y un banco de 2 500 preguntas.
**Método:** Playwright hace 20 navegaciones por vista con sesión iniciada y calcula dos percentiles.
- **TTFB** (`responseStart − requestStart`): lo que tarda el servidor.
- **Carga:** hasta el evento `load`.

| Vista | TTFB p50 | TTFB p95 | Carga p50 | Carga p95 |
|---|---:|---:|---:|---:|
| `/teacher` (dashboard) | 102 ms | 157 ms | 185 ms | 259 ms |
| `/teacher/students/[id]` | 111 ms | 162 ms | 219 ms | 272 ms |
| `/teacher/questions` (banco, 50 por página) | 92 ms | 121 ms | 275 ms | 320 ms |
| `/student` | 101 ms | 160 ms | 205 ms | 265 ms |
| `/student/history` | 93 ms | 130 ms | 203 ms | 288 ms |
| `/student/content-map` | 104 ms | 131 ms | 198 ms | 250 ms |
| Player de Practice | 75 ms | 95 ms | 160 ms | 197 ms |

**Objetivo de aceptación:** p95 < 3 s. **Se cumple en todas las vistas**, con más de 9 veces de margen en la medición local.

La medición se hizo en local, sin la latencia de red de la VM (us-east1), que añade unos 150–250 ms por petición desde Lima. Falta repetirla en producción con usuarios reales y hacer una prueba de concurrencia (RNF-20).

## Cambios que la sostienen
- **Índices** (migración `20261001_rnf_hardening`):
  - `Attempt(studentId,status)`, `Attempt(assignmentId)`, `Attempt(practiceSetId)`
  - `AttemptAnswer(questionId)`
  - `Assignment(status,dueDate)`, `Assignment(locked,unlockAt)`
  - `FullPracticeTestAttempt(studentId,status)`, `FullPracticeTestAttempt(assignmentId)`, `FullPracticeTestAttempt(testId)`
  - `FullPracticeTestAnswer(questionId)`
  - `FullPracticeTestAssignment(status,dueDate)`
  - `Question(topicId,difficulty,status)`, `Question(createdAt)`
  - `Notification(userId,readAt)`
  - `AuditLog(createdAt)`, `AuditLog(targetId)`
- **`refreshAssignmentStates`:** primero lee y solo escribe si hay filas que cambiar. Como mucho se ejecuta 1 vez cada 30 s por proceso. El cron horario también marca vencidos y libera desbloqueos.
- **Dashboard de la profesora, portal del padre y content-map:** cargan solo `isCorrect` de cada respuesta, en lugar de la fila completa con el snapshot de la pregunta.
- **Banco de preguntas:** paginado en servidor (50 por página, con `count`) en lugar de `take: 100`. El uso por pregunta se calcula con `_count`.

## Prueba de carga y concurrencia (2026-10-02, RNF-20 / RNF-21)

`scripts/qa/load-test.mjs`.

**Entorno**
- La imagen de producción `web:ws-20261002-rnf-closure`, en un contenedor limitado como la e2-medium (`--cpus=2 --memory=4g`).
- Copia de `dev.db` con el contenido real (2 600 preguntas, 10 FPT); `migrate deploy` lo aplica el propio entrypoint.

**Escenario**
- N alumnos inician el mismo FPT a la vez y envían un autosave cada 2–3 s, como el player real: el payload completo, con respuestas, tiempos y marcas.
- 2 profesores refrescan el dashboard y la ficha de un alumno cada 5 s.
- Al final, todos envían el examen **en el mismo instante** y abren sus resultados.

| Escenario | Peticiones | Errores | Enviados | Autosave p50 / p95 | Dashboards p95 | Submit p95 | CPU p95 | RAM máx. | `SQLITE_BUSY` |
|---|---|---|---|---|---|---|---|---|---|
| 10 alumnos · 5 min | 1 463 | 0 | 10/10 | 46 / 89 ms | 115–211 ms | 656 ms | 45 % de 2 vCPU | 708 MB | 0 |
| 25 alumnos · 2 min | 1 364 | 0 | 25/25 | 37 / 139 ms | 131–380 ms | 2,9 s | — | — | 0 |

Lectura de los resultados:
- **Operaciones de régimen** (autosave y dashboards): p95 por debajo de 400 ms incluso con 25 alumnos.
- **Picos simultáneos:** solo se nota latencia cuando todos hacen lo mismo en el mismo segundo.
  - Login: bcrypt de coste 10, unos 1–2,5 s.
  - Primera carga del examen: snapshot de unos 180 KB por intento, 0,75–2,4 s.
  - Envío simultáneo: 0,2–2,9 s.

  Son operaciones de una sola vez por examen, nunca fallan y no bloquean la base.
- **Capacidad (RNF-21):** con 10 FPT y 8–10 alumnos queda un margen holgado. Con 25 alumnos simultáneos la VM sigue sin errores.
- **Autosave del examen:** los clics, Mark, eliminar y la navegación se agrupan en un guardado diferido de 600 ms. Así baja el número de escrituras por alumno frente al guardado por cada clic.
