# Roadmap faltante - Fase 1 Plataforma SAT

**Fecha de revisión:** 2026-06-11  
**Objetivo de fase:** cerrar el MVP operativo de Practice Sets para una tutora SAT y sus alumnos.  
**Documento base de alcance:** `ALCANCE_Y_CARACTERISTICAS_CONSOLIDADO.md`  
**Estado técnico verificado:** `npm run typecheck`, `npm run lint`, `npm run qa:p0`, `npm run qa:authz`, `npm run qa:edge` y `npm run build` pasan correctamente.

---

## 1. Objetivo de Fase 1

Fase 1 debe dejar lista una plataforma SAT usable para operación real de clases con Practice Sets:

- La profesora puede invitar alumnos, administrarlos, agruparlos, asignar Practice Sets, bloquear/desbloquear contenido y revisar resultados.
- El alumno puede activar cuenta, iniciar sesión, ver asignaciones, resolver Practice Sets, pausar/continuar, enviar, reintentar y revisar según reglas de visibilidad.
- El sistema conserva historial confiable de intentos, respuestas, tiempos, puntajes y versiones de contenido.
- Los permisos por rol impiden acceso indebido entre alumnos, padres, profesora y admin.
- El banco de preguntas puede recibir contenido real sin publicar preguntas incompletas o rotas.
- El proyecto puede desplegarse y operarse con backups, auditoría básica y documentación suficiente.

Full Practice Tests, portal de padres avanzado, reportes avanzados y branding quedan como alcance secundario dentro de Fase 1 solo si no ponen en riesgo el cierre del MVP de Practice Sets.

---

## 2. Estado actual verificado

### Ya implementado

| Área | Estado actual |
|---|---|
| Auth | Login, activación por invitación, recuperación/cambio de contraseña, validación de usuario. |
| Roles | `ADMIN`, `TEACHER`, `STUDENT`, `PARENT`. |
| Portales | Student, Teacher, Admin y Parent existen. |
| Programas | Programas, inscripciones, aprobación de inscripción y asignación de profesores. |
| Grupos | Gestión básica de grupos y miembros. |
| Alumnos | Invitación, edición, activación/desactivación y detalle de alumno. |
| Practice Sets | Crear/editar, asignar, resolver, autosave, submit, scoring, resultados, historial, snapshots y avance automático base. |
| Player | Una pregunta por pantalla, dos columnas, timer, navegación, notas, mark for review, eliminación visual y autosave offline básico. |
| Banco de preguntas | Preguntas MC/NUMERIC, dificultad, topic/subskill, explicación, preview KaTeX y estado. |
| Content map | Vista de contenido para alumno y profesor. |
| Unlock requests | Solicitud y resolución básica de desbloqueo. |
| Dashboard profesora | Lista de alumnos, alertas básicas, unlock requests, pendientes y último intento. |
| Dashboard alumno | Pendientes, resultados recientes y métricas básicas. |
| Reporte individual | Vista de reporte y PDF presentable con progreso temporal del puntaje, temas débiles, comentarios y referencias de media. |
| Notificaciones | Modelo, API, campana y eventos básicos. |
| Auditoría | `AuditLog` para programas, inscripciones, asignaciones, unlock requests, cambios de alumno y avance automático. |
| Full Practice Tests | Modelo, creación, asignación, player, submit y scoring base. |
| Materiales | CRUD básico de materiales. |
| Padres | Consentimiento/vinculación y dashboard básico. |
| Operación | Backup local SQLite y documentación actualizada en README. |

### Validaciones ejecutadas

| Validación | Resultado |
|---|---|
| `npm run typecheck` | Pasa. |
| `npm run lint` | Pasa. |
| `npm run qa:p0` | Pasa. |
| `npm run qa:authz` | Pasa. |
| `npm run qa:edge` | Pasa. |
| `npm run build` | Pasa. |

---

## 3. Brechas críticas para cerrar Fase 1

Las tareas están ordenadas por impacto sobre el MVP real. `P0` bloquea cierre de Fase 1; `P1` debe quedar cerrado antes de piloto; `P2` puede entrar si no retrasa el cierre.

---

## 4. Detalles mínimos extraídos del Excel

Estos detalles vienen de la hoja `Preguntas y decisiones` y deben tratarse como reglas de producto, no como ideas opcionales.

### 4.1 Taxonomía y distribución académica

| Tema | Regla mínima |
|---|---|
| Idioma | Toda la interfaz y taxonomía visible debe estar en inglés. No hay selector de idioma. |
| Secciones | Usar `Mathematics` y `Reading & Writing`. |
| Dominios Math | `Algebra`, `Advanced Math`, `Problem Solving and Data Analysis`, `Geometry and Trigonometry`. |
| Dominios Reading & Writing | `Information and Ideas`, `Craft and Structure`, `Expression of Ideas`, `Standard English Conventions`. |
| Dificultades | Siempre `Easy`, `Medium`, `Hard`. |
| Taxonomía base | La estructura principal es SAT; la metodología propia solo va como tags/notas/subskills, no reemplaza la taxonomía SAT. |
| Mezcla de temas | En general, una pregunta pertenece a un tema y un Practice Set no debería mezclar preguntas de varios temas. |
| Temas vacíos | Alumno no debe ver temas sin ejercicios; profesora/admin sí puede verlos como draft/empty. |
| Orden | Debe existir orden por defecto, con capacidad de orden manual para lo visible por alumnos/grupos. |

**Fuente:** Q18-Q31, Q45-Q46, Q51, Q53, Q198-Q199.

### 4.2 Reglas mínimas de pregunta

| Tema | Regla mínima |
|---|---|
| Tipos | `MC` con alternativas A/B/C/D y `NUMERIC` para Math. |
| Respuesta numérica | Aproximadamente 30% de preguntas de Math pueden requerir respuesta numérica libre. |
| Respuesta correcta | Una sola respuesta correcta. No se requieren preguntas con múltiples respuestas correctas. |
| Explicación | Cada pregunta debe tener explicación o solución desarrollada. |
| Fórmulas | Soporte mínimo LaTeX/MathJax/KaTeX en enunciado, alternativas y explicación. |
| Media | Preguntas pueden incluir imágenes, gráficos, fórmulas, tablas y textos largos. |
| Formatos media | Permitir PNG, JPG/JPEG, WebP y SVG. |
| Dificultad propia | Cada pregunta tiene dificultad propia; el Practice Set también tiene dificultad. |
| Campos mínimos publicables | Enunciado, tipo, respuesta correcta, explicación, subject, domain/topic, dificultad, estado published y orden/asociación. |
| Pregunta sin respuesta | No se puede publicar ni calificar; queda draft/incomplete. |

**Fuente:** Q36-Q47, Q195, Q246, Q250.

### 4.3 Reglas mínimas de Practice Set

| Tema | Regla mínima |
|---|---|
| Pertenencia | Un Practice Set pertenece obligatoriamente a un tema y dificultad. |
| Estados | Debe soportar draft/borrador, published/publicado, blocked/bloqueado y archived/archivado. |
| Cantidad de preguntas | No se exige exactamente 8 a 10 preguntas para publicar. |
| Asignación | Individual, múltiple y por grupo/cohorte. |
| Fecha límite | Debe existir como alternativa configurable. |
| Temporizador | Practice Sets deben tener timer y registrar tiempo. |
| Pausa/continuidad | Alumno puede pausar, salir y continuar. |
| Autosave | Guardar respuesta y tiempo al cambiar respuesta, navegar, pausar, salir o cada pocos segundos. |
| Navegación | Una pregunta por pantalla, navegación entre preguntas y progreso visible. |
| Blanks | El alumno puede dejar preguntas en blanco. Quedan omitted/unanswered y cuentan como no correctas. |
| Blanks y respuesta | Si dejó blank, no debe ver respuesta correcta cuando esa regla aplique. |
| Submit | Se considera completado cuando presiona Submit/Finish y confirma. Puede enviarse con blanks. |
| Aprobación | Recomendación de aprobado: >=70% por defecto, configurable por set/grupo. |
| Reintentos | Se permiten múltiples intentos; debe registrarse cuántos attempts hizo. |
| Nota vigente | Para Practice Sets, la nota vigente es la última válida. |
| Reasignación | Profesora puede reasignar un Practice Set ya completado. |
| Bloqueo base | El bloqueo/desbloqueo operativo principal es manual por profesora. |
| Desbloqueo programado | Debe poder programarse desbloqueo por fecha. |
| Solicitud de desbloqueo | Alumno puede pedir desbloqueo de un Practice Set bloqueado. |
| Transición automática | Debe contemplarse desbloquear automáticamente el siguiente Practice Set si el alumno aprueba el anterior. |
| Umbral mismo nivel/tema | `>=70%` permite avanzar dentro del mismo nivel/tema. |
| Umbral subir dificultad | `>=75%` permite pasar a la siguiente dificultad. |
| Aprobación manual de avance | La profesora no debería tener que aprobar manualmente el avance automático. |

**Fuente:** Q50, Q53-Q77, Q108, Q121, Q149, Q162-Q165, Q168, Q242-Q243, Q247, Q251.

### 4.4 Resultado, historial y analytics

| Tema | Regla mínima |
|---|---|
| Score Practice Set | `correctas / total de preguntas`. |
| Desglose | Mostrar correctas, incorrectas y omitidas por separado. |
| Porcentaje | Se calcula sobre el total de preguntas. |
| Detalle por pregunta | Debe incluir enunciado, respuesta del alumno, respuesta correcta, explicación, estado, tiempo, dominio/tema/dificultad. |
| Visibilidad | El detalle se muestra solo si la profesora lo habilita. |
| Tiempos | Registrar fecha/hora inicio, fecha/hora fin, tiempo total y tiempo por pregunta. |
| Historial profesora | Todo intento, respuesta, tiempo, resultado, asignación, estado, comentarios, versiones y actividad por fecha. |
| In progress | Historial debe incluir Practice Sets abiertos pero no terminados con avance y última actividad. |
| Versiones | Debe registrarse versión de pregunta y versión de Practice Set respondida. |
| Retención | Mantener historial mientras alumno esté activo y al menos 6 meses después de finalizar. |
| Dashboard profesora | Lista alumnos, último acceso, pendientes/vencidos, últimos resultados, progreso por tema/dificultad, alertas, acceso a detalle. |
| Filtros profesora | Sección, tema, dificultad, fecha, estado de asignación y alumno. |
| Analytics | Respuestas seleccionadas, tiempo por pregunta, preguntas donde más alumnos fallan y bajo desempeño por tema/dominio/dificultad. |

**Fuente:** Q70, Q75-Q77, Q108, Q111-Q113, Q125, Q132, Q135-Q140, Q170-Q180, Q229, Q253.

### 4.5 Full Practice Test y puntaje SAT

Full Practice Tests son secundarios frente a Practice Sets para cerrar Fase 1, pero las reglas ya están definidas y deben respetarse cuando se endurezca ese flujo.

| Tema | Regla mínima |
|---|---|
| Nombre del módulo de producto | Usar `Full Practice Test`, no “mock exam” en UI final. |
| Cantidad inicial | 8 Full Practice Tests iniciales. |
| Capacidad esperada | Hasta 20 Full Practice Tests por alumno como máximo operativo. |
| Asignación | Principalmente por alumno. |
| Preguntas | Fijas, no generadas dinámicamente. |
| Estructura RW | Reading & Writing es una sección con 2 modules; cada module tiene 27 preguntas. |
| Estructura Math | Math tiene 2 modules; cada module tiene 22 preguntas. |
| Total módulos | 4 módulos: RW Module 1, RW Module 2, Math Module 1, Math Module 2. |
| Timer | Timer por módulo, formato tipo SAT digital. |
| Días separados | Alumno puede tomar módulos/secciones en días separados. |
| Fin de tiempo | Registrar `time expired`; alumno puede continuar hasta acabar el módulo. |
| Blanks al acabar tiempo | No se marcan automáticamente como incorrectas por el solo hecho de acabarse el tiempo. |
| Auto-submit | No como regla base; opcional configurable. |
| Overtime | Registrar tiempo extra usado. |
| Calculadora | Calculadora gráfica en módulos Math mediante proveedor configurable: Desmos SAT, Desmos API, GeoGebra, GeoGebra API o fallback local 2D/3D. |
| Repetición | Alumno puede repetir Full Practice Test, pero resultado visible conserva solo el último intento. |
| Reset | Profesora puede resetear FPT para un alumno. |
| Score SAT | Raw score por módulo/sección -> tabla de conversión SAT -> RW 200-800, Math 200-800, Total 400-1600. |
| Scores visibles | Deben existir puntaje bruto, porcentaje y escala SAT. |
| Resultado | Separar por sección, dominio, tema y dificultad. |
| Visibilidad alumno | Alumno ve puntaje inmediatamente. |
| Review | Revisión posterior con explicaciones, solo después de completar/habilitar review. |
| Publicación/asignación | Un FPT necesita nombre, módulos, preguntas por módulo, respuestas correctas, tabla de conversión, timers y estado published. |

**Estado implementado:** la tabla `FullPracticeTestScoreConversion` es configurable desde UI, valida secciones `RW/MATH`, raw score entero, score SAT 200-800 en incrementos de 10 y orden no decreciente. El submit usa la tabla exacta cuando existe e interpola entre puntos configurados si falta una fila intermedia; sin tabla usa fallback aproximado marcado como pendiente operativo de carga de tablas reales. La creación de FPT valida estructura SAT: publicar exige RW 27+27, Math 22+22, preguntas publicadas, sección correcta por módulo y sin duplicados. La calculadora Math usa `MathToolPanel` con proveedor paramétrico por `NEXT_PUBLIC_CALCULATOR_PROVIDER`, soportando `desmos_sat`, `desmos_api`, `geogebra`, `geogebra_api`, `local_2d`, `local_3d` y `none`.

**Fuente:** Q78-Q110, Q118-Q121, Q183-Q184, Q244-Q245, Q248, Q252, Q257, RF-50-RF-55, RNF-21.

### 4.6 Carga inicial y distribución de contenido

| Tema | Regla mínima |
|---|---|
| Material fuente | Mayormente PDFs. |
| Volumen | No más de 500 hojas para Practice Sets/contenido inicial. |
| Respuestas | Las respuestas correctas ya están digitalizadas. |
| Experiencia objetivo | Convertir PDFs/materiales a preguntas digitales separadas; visor PDF solo como respaldo temporal. |
| Separación | Un examen/archivo debe separarse en preguntas individuales para calificar, revisar y reportar por tema. |
| Creación manual | Profesora/admin debe poder crear tests/sets desde banco de preguntas. |
| Carga inicial | La realiza el desarrollador/equipo; la tutora no debe depender de Excel. |

**Fuente:** Q32-Q35, Q181-Q195, RNF-22.

### 4.7 Gaps detectados al revalidar Excel vs plan

Estos puntos estaban en RF/RNF o en `Preguntas y decisiones` y no estaban suficientemente explícitos como cierre pendiente del roadmap. Deben tratarse como backlog real de Fase 1/piloto.

| Gap | Fuente | Decisión de plan |
|---|---|---|
| Recuperación ante pérdida de conexión con estado visible de guardado/conexión. | RNF-8, Q237-Q239 | Practice Set ya tiene guardado local y resincronización; falta llevar el mismo estándar a FPT y validar con E2E. |
| Respaldos automáticos con frecuencia definida. | RNF-15, Q235-Q236 | Backup local y restore local existen; producción requiere programar backup automático de base y archivos, mínimo diario según RNF. |
| Auditoría amplia de acciones críticas. | RNF-16, Q240 | El modelo y `/admin/logs` cubren programas, asignaciones, unlocks, intentos, comentarios, preguntas, Practice Sets, import e impersonation. |
| Protección del banco de preguntas. | RNF-19, Q241 | Falta URLs privadas/storage productivo y rate limiting básico; no se promete anti-copia total. |
| Privacidad, menores y gestión de datos. | RNF-12, RNF-13, Q230-Q234 | El flujo de padre/consentimiento existe; falta política operativa de descarga/eliminación/retención. |
| Observabilidad operativa. | RNF-23 | Falta logging estructurado de errores, latencias, autosave fallido y eventos críticos fuera de auditoría funcional. |
| Trazabilidad de cambios de respuesta antes del submit. | Q173 | Autosave guarda estado vigente; falta event log histórico de cambios si la tutora lo exige para auditoría fina. |
| Capacidad y seed de 8 FPT iniciales. | RF-49, RNF-21, Q183 | La estructura existe; falta carga real de 8 FPT, tablas reales y seed representativo completo. |

---

## 5. P0 - Bloqueantes de MVP

### 5.1 Versionado/snapshot de contenido respondido

**Problema:** Los intentos referencian preguntas y Practice Sets vivos. Si se edita una pregunta después de que un alumno la respondió, el historial puede cambiar retroactivamente.

**Estado implementado:** snapshots de Practice Set en `Attempt` y snapshots de pregunta en `AttemptAnswer`, usados en submit, resultados del alumno, detalle del profesor, reporte individual y PDF. Queda pendiente decidir si el banco evolucionará con versiones explícitas además del snapshot histórico.

**Trabajo restante:**

- Definir si además del snapshot histórico habrá versionado explícito del banco de preguntas.
- Convertir la verificación estática de snapshots en prueba runtime/E2E: responder un set, editar pregunta usada y verificar que el resultado histórico no cambia.

**QA automatizada actual:** `npm run qa:p0` y `npm run qa:edge` verifican que submit/resultados usen snapshots y que un reintento nuevo tome la versión viva del contenido.

**Criterio de aceptación:**

- Un alumno responde un set.
- La profesora edita el texto/respuesta de una pregunta.
- El resultado histórico sigue mostrando exactamente la versión respondida.
- Un nuevo intento usa la versión nueva.

**Referencias:** RF-34, RF-35, RNF-17, Q47-Q48, Q179-Q180.

### 5.2 Ciclo de vida correcto de intentos y reintentos

**Problema:** El flujo existe, pero falta cerrar reglas operativas para `Start`, `Continue`, `Try Again`, reapertura, invalidación y estado de assignment.

**Estado implementado:** el inicio marca `Assignment.status = IN_PROGRESS`, el submit exige intento `IN_PROGRESS`, se refrescan vencidos/programados y el submit aplica `COMPLETED`. Los reportes y dashboards omiten intentos `INVALIDATED` en flujos principales. `Try Again` crea un nuevo intento cuando no existe intento `IN_PROGRESS`; la UI de detalle permite razón opcional para reabrir/invalidar y comentario docente.

**Trabajo restante:**

- Convertir la verificación estática de `Try Again` en prueba runtime/E2E.
- Definir formalmente si el reintento bajo assignment completado debe conservar el mismo `Assignment` o crear un intento libre asociado al mismo Practice Set.
- Mostrar claramente último intento vigente vs intentos anteriores en todas las vistas.

**QA automatizada actual:** `npm run qa:edge` verifica que solo se reutilicen intentos `IN_PROGRESS`, que submit rechace re-submit y que invalidar/reabrir envíe razón.

**Criterio de aceptación:**

- Un alumno puede completar el mismo Practice Set dos veces.
- La nota vigente es la última válida.
- Un intento invalidado no afecta promedio ni último resultado.
- Una asignación cambia correctamente `PENDING -> IN_PROGRESS -> COMPLETED`.
- Una asignación vencida se muestra como overdue sin romper el acceso.

**Referencias:** RF-18, RF-32, RF-33, RF-35.

### 5.3 Seguridad y autorización por rol

**Problema:** Hay protección server-side, pero falta verificación sistemática de límites entre roles.

**Estado implementado:** se reforzó scoping por programa en reportes, PDF, detalle de intentos, acciones de intentos, edición/activación de alumnos, impersonación, asignación de Practice Sets, asignación de Full Practice Tests y resolución de unlock requests. Existe `npm run qa:authz` como suite estática de autorización para auditar RBAC, scope docente, ownership de estudiante, acciones parent-only y rutas admin-only.

**Trabajo restante:**

- Convertir la suite estática en pruebas runtime/E2E cuando haya servidor y base QA disponibles:
  - Alumno no ve intentos/resultados de otro alumno.
  - Alumno no accede a sets bloqueados no asignados.
  - Profesor no ve alumnos fuera de sus programas activos.
  - Padre solo ve alumnos vinculados/autorizados.
  - Admin-only routes rechazan teacher/student/parent.
  - Teacher routes rechazan student/parent.
- Mantener `npm run qa:authz` en cada cierre de P0.

**Criterio de aceptación:**

- Existe checklist o test automatizado de autorización.
- Todas las rutas críticas devuelven `401/403/404` cuando el usuario no corresponde.
- No hay forma de cambiar IDs en URL para ver datos ajenos.

**Referencias:** RNF-11, RNF-12, RNF-16, Q258.

### 5.4 Validación de publicación de contenido

**Problema:** El editor permite guardar contenido, pero falta bloquear publicación incompleta o inconsistente.

**Estado implementado:** validación backend y errores accionables en UI para publicar preguntas y Practice Sets. Los Practice Sets publicados exigen preguntas publicadas, sin duplicados y coherentes con el topic del set.

**Trabajo restante:**

- Validar URL/formato de media si existe y se pasa a storage productivo.
- Agregar validación explícita de configuración de timer cuando el modelo la separe del default.
- Convertir validaciones a pruebas unitarias o runtime además de `qa:p0/qa:edge`.

**QA automatizada actual:** `npm run qa:p0` y `npm run qa:edge` verifican publicación incompleta, opciones MC A/B/C/D, respuesta correcta válida, Practice Set vacío, duplicados, preguntas no publicadas y topic inconsistente.

**Criterio de aceptación:**

- No se puede publicar una pregunta sin respuesta correcta o sin opciones completas.
- No se puede publicar un Practice Set vacío.
- El alumno nunca recibe un set con preguntas incompletas.

**Referencias:** RF-45, RF-48, Q246-Q250, RNF-18.

### 5.5 Importación robusta de contenido

**Problema:** El import actual usa split por coma, lo que rompe pasajes largos, fórmulas, comas dentro de texto y campos multilínea.

**Estado implementado:** parser CSV con comillas, comas y campos multilínea, importación como draft por defecto, validación por fila antes de insertar y pantalla de preview/validación antes de confirmar importación.

**Trabajo restante:**

- Mejorar UX de errores por fila para lotes grandes.
- Definir si se mantendrá CSV robusto o si se agregará import template JSON estructurado.

**Criterio de aceptación:**

- Se puede importar un lote con texto largo, fórmulas y comas sin corromper columnas.
- Las filas inválidas no se publican.
- El usuario ve cuántas filas entraron y cuáles fallaron.

**Referencias:** RF-46, RF-47, RNF-18.

---

## 6. P1 - Cierre funcional de Practice Sets

### 6.1 Confirmación de envío y reglas de revisión

**Estado implementado:** confirmación antes de submit con conteo de blanks, submit permitido con omitidas y scoring sobre total de preguntas. Las vistas de resultados respetan snapshots y aplican reglas de visibilidad: `HIDDEN` no revela respuestas correctas, explicación ni estado correcto/incorrecto por pregunta; `AFTER_FINISH` revela soluciones solo después de enviado; las unanswered no muestran explicación.

**Trabajo restante:**

- Permitir volver a revisar antes de enviar.
- Permitir feedback inmediato dentro del player si se decide usar `IMMEDIATE` antes del submit.

**Criterio de aceptación:**

- Si el alumno intenta enviar con blanks, ve confirmación clara.
- Si envía con blanks, esas preguntas cuentan como omitidas/no correctas.
- Las omitidas no muestran respuesta si esa regla aplica.

### 6.2 Student History con filtros

**Estado implementado:** historial del alumno con filtros por section, topic, difficulty y date range, manteniendo enlace a detalle del intento.

**Trabajo restante:**

- Validar UX responsive del filtro en mobile.
- Agregar conteo visible de resultados filtrados si se requiere en piloto.

**Criterio de aceptación:**

- Un alumno puede encontrar intentos previos por materia, tema, dificultad y fecha.

### 6.3 Teacher dashboard y detalle con filtros

**Estado implementado:** dashboard de profesora con búsqueda por alumno, filtro por grupo, topic, difficulty y date range. El promedio se calcula sobre los intentos filtrados, se muestra un resumen de bajo rendimiento por topic/difficulty y el último acceso usa `User.lastActiveAt` real actualizado en login/autosave/submit.

**Trabajo restante:**

- Agregar filtro explícito por ciclo/programa si la operación usa más de un ciclo simultáneo.
- Extender los mismos filtros al detalle individual donde todavía aplique.

**Criterio de aceptación:**

- La profesora puede ubicar rápidamente alumnos con bajo rendimiento o inactividad.
- Puede filtrar por grupo y revisar progreso por tema/dificultad.

### 6.4 Analytics por pregunta y contenido

**Estado implementado:** `/teacher/analytics` muestra preguntas más falladas, accuracy, tiempo promedio, breakdown por topic y difficulty, enlace a la pregunta y scoping por programa docente.

**Trabajo restante:**

- Agregar breakdown por subskill cuando el contenido real esté etiquetado de forma consistente.
- Enlazar desde analytics a intentos relacionados además del enlace directo a pregunta.

**QA automatizada actual:** `npm run qa:edge` verifica analytics por pregunta, topic, difficulty, tiempo y scoping.

**Criterio de aceptación:**

- La profesora puede identificar qué preguntas o temas fallan más en un grupo/alumno.

### 6.5 Media en preguntas

**Estado implementado:** el editor permite capturar/previsualizar `imageUrl`; el player, resultados de alumno y detalle de intento docente renderizan la imagen desde snapshot/live data. La imagen abre en una pestaña nueva para inspección básica.

**Trabajo restante:**

- Subida real de archivos a storage.
- Definir almacenamiento de producción.

**Criterio de aceptación:**

- Una pregunta con gráfico/imagen se ve correctamente al resolver y revisar.

### 6.6 Estados locked/unlocked, scheduled unlock y transición entre niveles

**Estado implementado:** refresh de estados overdue/scheduled unlock, bloqueo de acceso directo a sets bloqueados/futuros, resolución de unlock requests con scoping, avance automático `>=70%` mismo topic/difficulty y `>=75%` siguiente dificultad, respetando bloqueo manual y unlock programado. Hay seed QA para locked/unlock request y transición.

**Trabajo restante:**

- Mostrar de forma consistente:
  - bloqueado
  - disponible
  - programado por fecha
  - solicitado desbloqueo
  - desbloqueo aprobado/rechazado
- Hacer configurable por set/grupo si la transición automática está activa.
- Convertir la verificación estática de precedencia de bloqueo manual y unlock programado en prueba runtime/E2E.

**QA automatizada actual:** `npm run qa:edge` verifica umbrales `>=70%` y `>=75%`, bloqueo manual, unlock programado y auditoría de saltos automáticos omitidos.

**Criterio de aceptación:**

- Un alumno puede solicitar desbloqueo y la profesora puede aprobar/rechazar.
- Si obtiene `>=70%`, se habilita el siguiente Practice Set del mismo tema/nivel cuando la regla está activa.
- Si obtiene `>=75%`, se habilita el siguiente nivel de dificultad cuando la regla está activa.
- Si la profesora mantiene un bloqueo manual, el alumno no puede saltarlo por avance automático.
- El acceso directo a un Practice Set bloqueado falla.

**Fuente:** Q58, Q149, Q162-Q165, Q168, Q210, Q243.

---

## 7. P1 - Reportes, operación y QA

### 7.1 Reporte individual usable

**Estado implementado:** reporte web con intentos, promedio, tiempo total, último score válido, progreso por topic/difficulty, temas débiles, comentarios de profesora, media referenciada y evolución temporal del puntaje obtenido. El PDF presentable incluye secciones, paginación, intentos, promedio, tiempo, progreso por topic/difficulty, progreso del score en el tiempo, temas débiles, comentarios y URLs de media.

**Trabajo restante:**

- Convertir la verificación estática de permisos de descarga en prueba runtime/E2E.

**QA automatizada actual:** `npm run qa:p0` verifica que el PDF use scoping por programa y que incluya las secciones enriquecidas.

**Criterio de aceptación:**

- La profesora puede descargar un reporte individual comprensible para compartir.

### 7.2 Auditoría de acciones críticas

**Estado implementado:** `AuditLog` registra acciones de programas, inscripciones, asignaciones, unlock requests, intentos, comentarios, preguntas, Practice Sets, importación e impersonation. `/admin/logs` muestra actor, fecha, acción, target y metadata.

**Trabajo restante:**

- Agregar filtros por actor/acción/fecha si el volumen de auditoría crece.
- Convertir auditoría crítica a pruebas runtime/E2E.

**QA automatizada actual:** `npm run qa:edge` verifica auditoría de pregunta, Practice Set, importación e impersonation.

**Criterio de aceptación:**

- Una acción crítica puede rastrearse con actor, fecha, target y metadata mínima.

### 7.3 Backup y restore runbook

**Estado implementado:** `npm run db:backup` copia SQLite a `BACKUP_DIR`. `BACKUP_FILE=... npm run db:restore` restaura SQLite y crea copia previa `pre-restore` antes de reemplazar la base. Restore local probado contra copia temporal en `/tmp`.

**Trabajo restante:**

- Programar backup automático en producción; el Excel contiene decisión de 15 días en preguntas, pero RNF-15 exige al menos diario, así que para piloto debe prevalecer diario salvo decisión explícita de alcance.
- Aclarar storage productivo para archivos, porque `db:backup` solo cubre SQLite.

**QA automatizada actual:** `npm run qa:edge` verifica que restore exija `BACKUP_FILE`, cree copia previa y reporte evento `backup.restored`.

**Criterio de aceptación:**

- Existe procedimiento probado para restaurar `dev.db` o base equivalente.

### 7.4 Seed QA completo

**Estado implementado:** el seed ya incluye alumnos aprobados/pendientes, padre aprobado/pendiente, menores con consentimiento pendiente/aprobado, pregunta `NUMERIC`, Practice Set con `HIDDEN`, unlock request, datos de transición y nota de auditoría para probar `>=70%`/`>=75%`. También incluye 8 Full Practice Tests tipo mock publicados, 32 módulos, distribución RW 27+27 y Math 22+22, 784 relaciones módulo-pregunta, tabla de conversión SAT RW 0-54/MATH 0-44 y asignaciones FPT en estados completed, pending e in progress.

**Trabajo restante:**

- Validar si el seed cubre explícitamente todos estos estados en UI, no solo en datos:
  - assignment normal
  - assignment locked
  - unlock request pendiente
  - desbloqueo programado por fecha
  - bloqueo manual que prevalece sobre avance automático
  - assignment overdue
  - intento submitted
  - intento invalidated
  - intento reopened/in progress
  - pregunta con imagen
  - Practice Set con preguntas omitted/unanswered
- Reemplazar mocks sintéticos por contenido real del piloto cuando estén los PDFs/preguntas finales.

**QA automatizada actual:** `npm run qa:edge` verifica presencia mínima de seed para consentimiento, `NUMERIC`, review hidden, unlock request, transición y mocks FPT.

**Criterio de aceptación:**

- QA manual puede recorrer los estados principales sin crear datos desde cero.

---

## 8. P2 - Alcance secundario si queda tiempo en Fase 1

### 8.1 Full Practice Tests hardening

Full Practice Tests ya existen, pero no deben bloquear el cierre de Practice Sets.

**Estado implementado:** seed FPT completo para QA con 8 mocks, 4 módulos por test, timers SAT-like, preguntas fijas, tabla de conversión SAT simulada, intento submitted con score 1270 e intento in progress con `moduleTimerState`. Los módulos Math ya consumen la calculadora paramétrica compartida con Practice Sets.

**Trabajo faltante:**

- Validar edge cases de timer por módulo en múltiples dispositivos/sesiones concurrentes con E2E.
- Afinar UI avanzada de review FPT si el piloto pide más detalle que módulo/topic/difficulty.
- Cargar tablas reales del piloto para cada sección y reemplazar preguntas sintéticas por contenido real.
- Convertir edge cases de `time expired` y tiempo extra sin auto-submit obligatorio en prueba runtime.

**QA automatizada actual:** `npm run qa:edge` verifica guardado de `moduleTimerState`, `timeExpiredEvents`, `extraTimeUsed`, ausencia de auto-submit por expiración y cálculo SAT RW/Math/Total.

**Criterio de aceptación:**

- Un alumno puede empezar un FPT, pausar, volver y terminar sin perder respuestas.

### 8.2 Parent portal ampliado

**Trabajo faltante:**

- Ver programa activo del alumno.
- Ver asignaciones recientes.
- Ver resultados recientes.
- Ver estado de consentimiento/aprobación.
- Respetar límites de privacidad definidos.

**Criterio de aceptación:**

- Un padre solo ve alumnos vinculados y datos autorizados.

### 8.3 Notificaciones programadas

**Estado implementado:** `npm run notifications:generate` crea recordatorios idempotentes para Practice Sets con due date próxima, overdue y desbloqueos programados vencidos. Probado con dos corridas: primera creó 1 overdue, segunda creó 0 duplicados.

**Trabajo restante:**

- Programar el comando en producción.

**QA automatizada actual:** `npm run qa:edge` verifica existencia del job, recordatorios y función `notifyOnce`.

**Criterio de aceptación:**

- Se puede ejecutar un proceso idempotente que genera recordatorios pendientes.

### 8.4 Almacenamiento productivo de archivos

**Trabajo faltante:**

- Reemplazar avatars/media locales por bucket o storage persistente.
- URLs privadas o firmadas si aplica.
- Borrado seguro al reemplazar archivo.

**Criterio de aceptación:**

- Los archivos sobreviven redeploys y respetan permisos.

---

## 9. Orden recomendado de ejecución

1. **Snapshots/versionado de contenido respondido.**
2. **Intent lifecycle:** reintentos, estados de assignment, invalidation/reopen.
3. **Autorización y scoping:** pruebas o scripts para rutas críticas.
4. **Validación de publicación:** preguntas y Practice Sets.
5. **Importación robusta:** parser real, preview y validación por fila.
6. **Submit confirmation y review rules.**
7. **Locked/unlocked access hardening.**
8. **Student/teacher filters y analytics MVP.**
9. **Reporte individual presentable.**
10. **Auditoría de acciones críticas.**
11. **Seed QA completo.**
12. **Backup/restore runbook.**
13. **Full Practice Tests hardening:** autosave, distribución RW/Math y review.
14. **Parent portal ampliado.**
15. **Notificaciones programadas y storage productivo.**

---

## 10. Definición de terminado de Fase 1

Fase 1 se considera terminada cuando se cumpla todo lo siguiente:

- `npm run quality` pasa en ambiente limpio.
- La profesora puede invitar un alumno y el alumno puede activar su cuenta.
- La profesora puede crear o importar preguntas, publicar un Practice Set válido y asignarlo.
- El alumno puede resolver, pausar, continuar, enviar y reintentar un Practice Set.
- Autosave recupera progreso ante navegación/salida razonable.
- Las preguntas MC soportan A/B/C/D y las preguntas Math soportan respuesta numérica libre.
- El contenido puede mostrar fórmulas, textos largos, tablas e imágenes/gráficos.
- Practice Sets pertenecen a un tema y dificultad definidos.
- Las reglas de explicación/revisión se cumplen.
- Los blanks se registran como omitidos y no muestran respuesta cuando aplica.
- La profesora puede ver detalle de intento, respuesta por pregunta, tiempo, score y comentario.
- La profesora puede reabrir o invalidar un intento sin romper historial.
- El historial conserva la versión exacta respondida aunque el contenido se edite después.
- Los dashboards muestran pendientes, vencidos, progreso y bajo rendimiento con filtros mínimos.
- El alumno no puede acceder a contenido bloqueado por URL directa.
- Los permisos por rol están verificados.
- El reporte individual es descargable y útil.
- Las acciones críticas quedan auditadas.
- Existe seed QA para los estados principales.
- Existe procedimiento de backup y restore probado.

---

## 11. Fuera de Fase 1

Estos puntos no deben bloquear el cierre de Fase 1:

- Comunidad, foros, rankings públicos, gamificación o streaks.
- Proctoring, cámara, fullscreen forzado o bloqueo de pestañas.
- Modo oscuro.
- Optimización móvil completa.
- Exportación Excel para usuarios finales.
- Branding final avanzado.
- Portal de padres avanzado si el flujo básico de consentimiento ya funciona.
- Full Practice Tests completamente refinados si Practice Sets aún no están cerrados.
