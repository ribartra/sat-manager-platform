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
