# Consolidado enriquecido de alcance y características - Plataforma SAT

**Fuente principal:** `Gestión de Proyecto SAT.xlsx`  
**Hojas cruzadas:** `Preguntas y decisiones`, `Requisitos Funcionales`, `Requisitos No Funcionales`, `Cronograma`, `Resumen`  
**Versión:** v1.0  
**Fecha base del Excel:** 2026-05-11  
**Entrega MVP planificada:** 2026-07-31 / semana 12  

---

## 1. Resumen ejecutivo

La plataforma SAT será una herramienta privada para una tutora SAT y sus alumnos, enfocada en operar clases, asignar práctica por tema, resolver Practice Sets en una experiencia similar al SAT digital, registrar intentos, calificar automáticamente y permitir seguimiento detallado por alumno, tema, dificultad y pregunta.

El MVP prioriza **Practice Sets** sobre mock exams completos. Los Full Practice Tests quedan preparados como capacidad posterior o incremental, aunque varias decisiones funcionales ya definen su comportamiento futuro.

El éxito de la primera versión se define por:

- Acceder rápidamente a ejercicios necesarios para cada clase.
- Dejar tareas desde la plataforma.
- Ver resultados de cada Practice Set rápidamente.
- Centralizar progreso, historial, intentos y tiempos por alumno.

**Trazabilidad:** Q1, Q2, Q5, RF-7, RF-12, RF-19, RF-29, RF-35, RF-36.

---

## 2. Alcance del MVP

### 2.1 Incluido en MVP

| Área | Alcance incluido | RF/RNF | Preguntas fuente |
|---|---|---|---|
| Cuentas y acceso | Cuenta individual por alumno, invitación por correo, activación, login, recuperación y cambio de contraseña. | RF-1, RF-2, RF-3, RNF-10, RNF-11 | Q6-Q11, Q209 |
| Administración de alumnos | Editar datos, activar/desactivar alumnos sin borrar historial, ver estado de cuenta. | RF-4, RNF-14 | Q4, Q9, Q17, Q177-Q178 |
| Grupos y ciclos | Crear grupos por ciclos y horarios; alumno puede pertenecer a más de un grupo. | RF-5 | Q16, Q158-Q160 |
| Impersonation | Profesora puede ver la plataforma como alumno. Es una función crítica. | RF-6, RNF-16 | Q15, Q240, Q255 |
| Taxonomía SAT | Estructura predefinida en inglés para Mathematics y Reading & Writing. | RF-8, RF-9, RF-10, RF-11, RNF-1 | Q18-Q31, Q198-Q199 |
| Banco de preguntas | Gestión de preguntas, clasificación, editor manual, carga inicial por equipo/admin, estados publicables. | RF-45, RF-46, RF-47, RF-48, RNF-18, RNF-22 | Q32-Q52, Q187-Q195, Q246-Q250 |
| Practice Sets | Crear, publicar, listar, asignar, bloquear/desbloquear y resolver Practice Sets por tema y dificultad. | RF-12-RF-25, RF-28-RF-35 | Q53-Q77, Q242-Q243, Q247 |
| Calificación | Correctas, incorrectas, omitidas, porcentaje, detalle por pregunta, explicaciones configurables. | RF-28-RF-31 | Q68-Q74, Q108, Q111-Q113, Q121, Q251 |
| Historial | Historial completo de intentos, tiempos, respuestas, versiones y actividad por fecha. | RF-34, RF-35, RNF-14, RNF-17 | Q75-Q77, Q170-Q180 |
| Dashboard profesora | Alumnos, últimos accesos, pendientes, vencidos, progreso, alertas y detalle de intento. | RF-36-RF-39 | Q123-Q140, Q253, Q255 |
| Dashboard alumno | Pendientes, continuar intento, fechas límite, desbloqueados, progreso, historial reciente, notificaciones. | RF-7 | Q144-Q154, Q254 |
| Notificaciones internas | Notificaciones dentro de la plataforma para asignaciones, desbloqueos, recordatorios y finalización. | RF-41, RF-42 | Q151, Q209-Q216 |
| Reporte individual | Reportes por alumno y exportación PDF como capacidad deseada del MVP/Should Have. | RF-43, RF-44 | Q118-Q120, Q220-Q225 |
| Seguridad y privacidad | HTTPS, hashing, roles, privacidad de datos, acceso restringido a banco de preguntas. | RNF-9-RNF-13, RNF-19 | Q230-Q241, Q258 |

### 2.2 Fuera del MVP o no prioritario

| Exclusión / post-MVP | Decisión | RF/RNF | Preguntas fuente |
|---|---|---|---|
| Comunidad y gamificación | No implementar. | RF-60 | Alcance general |
| Proctoring, cámara, anti-trampa invasivo | No implementar en MVP. | RF-61, RNF-29 | Q92-Q95 |
| Exportación Excel para usuarios | No para alumna/profesora en MVP; opcional técnico/admin. | RF-62 | Q141, Q222 |
| Modo oscuro | No requerido. | RNF-27 | Q206 |
| Optimización móvil completa | No requerida; foco en laptop y tablet. | RNF-2, RNF-28 | Q200-Q202 |
| Branding final | Segunda etapa. | RNF-26 | Q208 |
| Bandeja completa de mensajes | No como MVP; usar notificaciones y comentarios. | RF-40, RF-41 | Q216-Q217 |
| Ranking entre alumnos | No deseable; puede existir comparación privada sin ranking. | RF-57 | Q133-Q134 |

---

## 3. Usuarios, roles y permisos

### 3.1 Profesora

Actor operativo principal. Debe poder administrar alumnos, grupos, contenido, asignaciones, desbloqueos, resultados, reportes e impersonation.

Características clave:

- Crear acceso para alumnos por invitación.
- Editar datos y desactivar cuentas sin borrar historial.
- Crear grupos por ciclos y horarios.
- Asignar Practice Sets individualmente o por grupo.
- Bloquear, desbloquear y programar desbloqueos.
- Reabrir, resetear o invalidar intentos.
- Ver respuestas por pregunta, tiempos, desempeño por tema/dificultad y actividad por alumno.
- Ingresar como alumno para validar lo que ve el estudiante.

**Trazabilidad:** RF-1-RF-6, RF-13-RF-18, RF-33, RF-36-RF-39, RF-43-RF-45, RNF-11, RNF-16, Q6-Q17, Q55-Q59, Q123-Q140, Q255-Q256.

### 3.2 Alumno

Usuario final que resuelve práctica, revisa resultados y consulta su progreso.

Características clave:

- Activar cuenta por invitación.
- Ver tareas pendientes, intentos en progreso, fechas límite, Practice Sets habilitados y progreso.
- Resolver Practice Sets con timer, autosave, navegación y pausa/continuidad.
- Revisar resultados, historial e intentos previos.
- Solicitar desbloqueo de Practice Sets bloqueados.
- Ver comentarios o notificaciones si existen.

**Trazabilidad:** RF-1-RF-3, RF-7, RF-8, RF-12, RF-17, RF-19-RF-32, RF-35, RF-41, Q7-Q14, Q28-Q31, Q60-Q77, Q144-Q157, Q254, Q258.

### 3.3 Padre / apoderado

No es rol central del MVP, pero debe considerarse por privacidad y alumnos menores de edad.

Características deseadas:

- Acceso futuro a información autorizada del alumno.
- Soporte de consentimiento para menores.
- Gestión razonable de datos personales.

**Trazabilidad:** RF-58, RNF-12, RNF-13, Q230-Q234.

---

## 4. Taxonomía académica y contenido

### 4.1 Idioma y estructura

La interfaz y el contenido académico principal deben estar en inglés. No habrá selector de idioma en el MVP.

La taxonomía base debe alinearse al SAT:

- **Mathematics**
  - Algebra
  - Advanced Math
  - Problem Solving and Data Analysis
  - Geometry and Trigonometry
- **Reading & Writing**
  - Information and Ideas
  - Craft and Structure
  - Expression of Ideas
  - Standard English Conventions

Los niveles de dificultad son fijos:

- Easy
- Medium
- Hard

**Trazabilidad:** RF-8, RF-9, RF-10, RNF-1, Q18-Q25, Q198-Q199.

### 4.2 Temas, subskills y etiquetas

Los dominios y temas principales estarán predefinidos por el sistema. La metodología propia de la tutora no reemplaza la taxonomía SAT, pero puede existir como etiquetas, notas internas o agrupaciones de clase.

Los subskills deben ser administrables o, como mínimo, mantenibles por el equipo/admin para filtrar y agrupar contenido. En general, una pregunta pertenece a un solo tema y un Practice Set no debería mezclar temas.

**Trazabilidad:** RF-9, RF-11, RF-45, Q21-Q31, Q45-Q47, Q53.

### 4.3 Banco de preguntas

El banco debe permitir preguntas digitales con:

- Subject.
- Domain.
- Topic/skill.
- Subskill/tags.
- Difficulty.
- Type.
- Prompt/enunciado.
- Media opcional.
- Alternativas.
- Respuesta correcta.
- Explicación.
- Estado.
- Orden/asociación.
- Tiempo estimado opcional.

Tipos de respuesta:

- Selección única A/B/C/D.
- Respuesta numérica libre para Math, aproximadamente 30% de preguntas matemáticas.
- No se requieren múltiples respuestas correctas.

Las preguntas pueden incluir imágenes, gráficos, fórmulas, tablas y textos largos. Debe soportarse LaTeX/MathJax para fórmulas en enunciados, alternativas y explicaciones.

**Trazabilidad:** RF-20, RF-21, RF-45-RF-48, RNF-5, RNF-18, Q36-Q44, Q195, Q246, Q250.

### 4.4 Carga inicial y mantenimiento de contenido

Los materiales actuales están mayormente en PDF. Para la experiencia objetivo, deben convertirse a preguntas digitales separadas, no limitarse a un visor PDF.

La carga inicial será realizada por el equipo/desarrollador como parte del proyecto. Para MVP, la tutora no necesita cargar todo manualmente, pero sí debe existir editor para ajustes, correcciones y altas pequeñas. La carga masiva puede quedar como herramienta interna/admin.

**Trazabilidad:** RF-45-RF-48, RNF-18, RNF-22, Q32-Q35, Q187-Q195.

### 4.5 Versionado y trazabilidad de contenido

Si una pregunta o Practice Set cambia después de haber sido respondido, el sistema debe conservar la versión usada en cada intento. La profesora debe poder identificar que un alumno respondió una versión anterior y reasignar o reabrir según corresponda.

**Trazabilidad:** RNF-17, RF-33, RF-34, RF-35, Q47-Q48, Q173-Q180, Q240.

---

## 5. Practice Sets

### 5.1 Definición

Un Practice Set pertenece a un tema y dificultad específica. Debe tener estado publicable y poder ser asignado, bloqueado, desbloqueado, archivado o revisado.

Campos mínimos para publicar:

- Título.
- Subject.
- Domain/topic.
- Difficulty.
- Preguntas publicadas.
- Configuración de timer.
- Configuración de explicación/review.
- Estado published.

No se requiere validar que tenga exactamente 8 a 10 preguntas.

**Trazabilidad:** RF-12, RF-13-RF-18, RF-48, Q50, Q53-Q59, Q247.

### 5.2 Asignación y disponibilidad

La profesora debe poder asignar Practice Sets:

- A un alumno específico.
- A varios alumnos.
- A un grupo/cohorte.

El bloqueo/desbloqueo base es manual. También se desea programar desbloqueos por fecha y permitir solicitud de desbloqueo desde el alumno.

Existe una decisión adicional de desbloqueo automático por avance:

- 70% para avanzar dentro del mismo nivel/tema.
- 75% para subir dificultad.
- La profesora no necesita aprobar manualmente el avance.

Esta regla conviene tratarla como **Should Have** o parametrización post-MVP si entra en conflicto con la regla principal de control manual.

**Trazabilidad:** RF-13-RF-18, RF-41, Q55-Q59, Q149, Q160-Q168, Q243.

### 5.3 Player de resolución

El alumno debe resolver una pregunta por pantalla en una experiencia similar al SAT digital:

- Enunciado/pasaje y respuesta en zonas separadas.
- Timer visible.
- Navegación entre preguntas.
- Progreso tipo “Question 3 of 10”.
- Pausar, salir y continuar.
- Autosave al responder, navegar, pausar, salir y periódicamente.
- Cambiar respuestas antes de enviar.
- Marcar preguntas para revisar.
- Dejar preguntas en blanco.

Si el alumno deja una pregunta en blanco, debe quedar como omitted/unanswered. Si la regla de revisión lo exige, no se debe mostrar la respuesta correcta de esa pregunta.

**Trazabilidad:** RF-19-RF-28, RNF-3, RNF-4, RNF-7, RNF-8, Q60-Q68, Q155-Q156, Q237-Q239, Q251.

### 5.4 Calificación e intentos

La nota del Practice Set se calcula como:

`correctas / total de preguntas`

Debe mostrar:

- Número de correctas.
- Número de incorrectas.
- Omitidas / sin responder.
- Porcentaje.
- Tiempo total.
- Tiempo por pregunta.
- Detalle por pregunta si la profesora lo habilita.

Se permiten múltiples intentos. La nota vigente será la última, no la mejor ni el promedio. Cada intento debe quedar registrado.

La profesora puede reabrir, resetear o invalidar un intento. La eliminación funcional no debe borrar la auditoría interna.

**Trazabilidad:** RF-28-RF-35, RNF-14, RNF-16, Q13-Q14, Q68-Q77, Q108, Q111-Q113, Q170-Q180, Q242-Q243.

### 5.5 Explicaciones y revisión

Cada pregunta debe tener explicación. La visibilidad para el alumno debe ser configurable por Practice Set:

- Inmediata.
- Al final.
- Oculta.
- Habilitada manualmente por profesora.

El detalle de revisión debe incluir enunciado, respuesta del alumno, respuesta correcta, explicación, estado, tiempo, dominio, tema y dificultad, siempre respetando la configuración de visibilidad.

**Trazabilidad:** RF-30, RF-31, Q42-Q44, Q70, Q121, Q154.

---

## 6. Full Practice Tests / Mock Exams

Los Full Practice Tests no son el foco inicial del MVP, pero el sistema debe quedar preparado para implementarlos sin rehacer la base de preguntas, intentos, scoring, timers y reportes.

Decisiones consolidadas:

- El término de producto será **Full Practice Test**.
- Se cargarían inicialmente 8.
- Máximo esperado: hasta 20 por alumno.
- Asignación principalmente por alumno.
- Preguntas fijas.
- Repetición permitida, pero para mock exams se conserva como resultado visible solo el último intento.
- Reset por profesora.
- Estructura SAT:
  - Reading & Writing: 2 modules, 27 preguntas cada uno.
  - Math: 2 modules, 22 preguntas cada uno.
- Temporizador por módulo.
- El alumno puede tomar secciones en días separados.
- Si se acaba el tiempo, se registra `time expired`, pero el alumno puede continuar; debe medirse tiempo extra.
- No auto-submit como regla base.
- Calculadora Desmos para Math.
- Puntaje tipo SAT: raw score -> tabla de conversión -> RW 200-800, Math 200-800, Total 400-1600.
- Revisión posterior con explicaciones.

**Trazabilidad:** RF-49-RF-55, RNF-21, Q78-Q107, Q109-Q110, Q118-Q121, Q244-Q245, Q248, Q257.

---

## 7. Dashboard y seguimiento

### 7.1 Dashboard del alumno

Debe mostrar:

- Tareas pendientes.
- Intentos en progreso.
- Fechas límite.
- Practice Sets desbloqueados/habilitados.
- Resultados recientes.
- Progreso global.
- Comentarios o notificaciones disponibles.
- Historial.
- Comparación contra intentos previos.
- Explicación de errores si está habilitada.

Los alumnos solo deben ver temas habilitados. Los temas sin ejercicios deben ocultarse para alumnos y verse como draft/empty para admin/profesora.

**Trazabilidad:** RF-7, RF-8, RF-12, RF-17, RF-35, RF-41, Q28-Q31, Q144-Q154, Q254.

### 7.2 Dashboard de profesora

Pantalla principal esperada:

- Lista de alumnos.
- Último acceso.
- Pendientes y vencidos.
- Últimos resultados.
- Alertas de bajo rendimiento.
- Alertas de no práctica.
- Progreso por tema y dificultad.
- Acceso rápido al detalle de alumno.

Indicadores por alumno:

- Practice Sets resueltos.
- Resultados por dificultad.
- Resultados por tema.
- Puntaje por set.
- Porcentaje de avance por sección.
- Último Practice Set completado.
- Último Full Practice Test tomado, cuando aplique.
- Línea de tiempo de actividad.

**Trazabilidad:** RF-36-RF-39, RF-57, RF-59, Q123-Q140, Q170-Q176, Q253, Q255.

### 7.3 Analítica

La profesora debe poder ver:

- Detalle de cada intento.
- Respuestas seleccionadas por pregunta.
- Tiempo por pregunta.
- Preguntas donde más alumnos fallan.
- Desempeño por contenido, tema y dificultad.
- Comparación privada por grupo/tema sin ranking.

**Trazabilidad:** RF-37-RF-39, RF-57, Q132-Q140.

---

## 8. Notificaciones, comentarios y reportes

### 8.1 Notificaciones

Las notificaciones serán principalmente dentro de la plataforma.

Eventos esperados:

- Cuenta creada / invitación enviada.
- Practice Set desbloqueado.
- Practice Set asignado.
- Full Practice Test asignado, cuando aplique.
- Recordatorio de fechas límite.
- Alumno termina Practice Set.
- Alumno termina Full Practice Test, cuando aplique.

No se requiere bandeja completa de mensajes en MVP.

**Trazabilidad:** RF-41, RF-42, Q151, Q209-Q216.

### 8.2 Comentarios de profesora

Los comentarios manuales son deseables, pero no centrales. El alumno debe poder verlos si existen.

**Trazabilidad:** RF-40, Q116-Q117, Q217.

### 8.3 Reportes

Reportes deseados:

- Reporte individual por alumno.
- PDF descargable.
- Reporte posterior a Full Practice Test.
- Envío por correo como capacidad deseada.
- Gráficos de progreso.
- Recomendaciones de temas débiles.
- Cantidad de práctica realizada.
- Tiempo invertido por alumno.

No se requiere reporte general de grupo ni exportación Excel para usuarios en MVP.

**Trazabilidad:** RF-43, RF-44, RF-62, Q118-Q120, Q141-Q143, Q218-Q229.

---

## 9. Seguridad, privacidad y operación

### 9.1 Seguridad

Requisitos mínimos:

- HTTPS con TLS 1.2 o superior.
- Hashing seguro de contraseñas.
- Políticas básicas de sesión.
- Control de acceso por rol.
- Alumnos no pueden acceder a datos de otros alumnos, contenido bloqueado, respuestas ocultas ni funciones de profesora.
- Banco de preguntas protegido con autenticación, permisos, URLs privadas y ocultamiento de respuestas hasta review.
- Rate limiting básico para evitar abuso.

**Trazabilidad:** RNF-9, RNF-10, RNF-11, RNF-19, Q241, Q258.

### 9.2 Privacidad y menores

Debe asumirse que puede haber alumnos menores de edad.

Datos personales mencionados:

- Nombre.
- Correo.
- Teléfono.
- Fecha de inicio.
- Edad.
- Año escolar.
- Colegio.
- Fecha de término del curso.

Debe contemplarse consentimiento de padre/apoderado para menores y consentimiento propio si el alumno es mayor de edad.

Acceso a datos:

- Profesora.
- Alumno sobre sus propios datos.
- Padres/apoderados, cuando aplique.

**Trazabilidad:** RF-1, RF-58, RNF-12, RNF-13, Q6, Q230-Q234.

### 9.3 Retención, respaldos y auditoría

Historial:

- Mantener mientras el alumno esté activo.
- Mantener al menos 6 meses después de finalizar.
- Recomendación consolidada: archivar indefinidamente salvo solicitud de eliminación.

Respaldos:

- El RNF indica respaldos automáticos diarios.
- La decisión Q236 menciona cada 15 días.
- Se recomienda resolver esta discrepancia a favor de respaldos diarios para base de datos y archivos críticos, con retención periódica.

Auditoría:

- Publicaciones.
- Ediciones.
- Desbloqueos.
- Reasignaciones.
- Borrado/invalidation de intentos.
- Impersonation.
- Eventos relevantes de respuesta y navegación como soporte/auditoría.

**Trazabilidad:** RNF-14, RNF-15, RNF-16, RNF-17, Q173-Q180, Q235-Q240.

### 9.4 Conectividad y recuperación

Ante pérdida de conexión:

- Conservar respuestas localmente.
- Sincronizar al reconectar.
- Mostrar estado de conexión/guardado.
- Permitir retomar intentos.

**Trazabilidad:** RF-23, RF-24, RNF-7, RNF-8, Q237-Q239.

---

## 10. Requisitos no funcionales principales

| Categoría | Requisito consolidado | RNF |
|---|---|---|
| Idioma | Interfaz y taxonomía en inglés; sin selector de idioma en MVP. | RNF-1 |
| Portabilidad | Laptop y tablet como foco; celular no optimizado en MVP. | RNF-2, RNF-28 |
| UX SAT | Player visualmente consistente con SAT digital. | RNF-3 |
| Legibilidad | Pasajes largos y controles críticos visibles. | RNF-4 |
| Matemática | Fórmulas, fracciones, símbolos y tablas sin deformaciones. | RNF-5 |
| Rendimiento | Vistas principales idealmente bajo 3 segundos en carga normal. | RNF-6 |
| Fiabilidad | Autosave rápido, recuperación de conexión y backups. | RNF-7, RNF-8, RNF-15 |
| Seguridad | HTTPS, credenciales protegidas, roles y banco protegido. | RNF-9, RNF-10, RNF-11, RNF-19 |
| Privacidad | Recolectar datos necesarios y proteger menores. | RNF-12, RNF-13 |
| Gobernanza | Retención de historial y trazabilidad de versiones. | RNF-14, RNF-17 |
| Operación | Auditoría y observabilidad. | RNF-16, RNF-23 |
| Accesibilidad | Accesibilidad básica. | RNF-25 |

---

## 11. Cronograma consolidado por entregables

| Semana | Fechas | Entregable | Alcance relacionado |
|---|---|---|---|
| 1 | 2026-05-11 a 2026-05-17 | Acta de proyecto v1, backlog priorizado | Cierre de alcance MVP |
| 2 | 2026-05-18 a 2026-05-24 | Inventario de contenido y taxonomía | Banco, PDFs, taxonomía SAT |
| 3 | 2026-05-25 a 2026-05-31 | Arquitectura y modelo de datos | Roles, permisos, preguntas, sets, intentos |
| 4 | 2026-06-01 a 2026-06-07 | Prototipo UX validado | Login, alumno, mapa, player, resultados, profesora |
| 5 | 2026-06-08 a 2026-06-14 | Cuentas y roles operativos | Auth, invitaciones, alumnos, grupos |
| 6 | 2026-06-15 a 2026-06-21 | Banco y Practice Sets administrables | Preguntas, dominios, editor, publicación |
| 7 | 2026-06-22 a 2026-06-28 | Practice Set resoluble end-to-end | Player, timer, navegación, autosave |
| 8 | 2026-06-29 a 2026-07-05 | Resultados e historial trazables | Scoring, intentos, tiempos, historial |
| 9 | 2026-07-06 a 2026-07-12 | Flujo completo de tareas | Asignaciones, estados, bloqueo, notificaciones |
| 10 | 2026-07-13 a 2026-07-19 | Dashboard profesora funcional | Seguimiento, detalle, analytics, impersonation |
| 11 | 2026-07-20 a 2026-07-26 | Piloto interno listo | QA funcional, permisos, autosave, contenido real |
| 12 | 2026-07-27 a 2026-08-02 | MVP aceptado | Piloto controlado, capacitación, cierre |

**Trazabilidad:** hoja `Cronograma`.

---

## 12. Riesgos, contradicciones y decisiones pendientes

| Tema | Observación | Recomendación |
|---|---|---|
| Backups | RNF-15 pide backups diarios; Q236 indica cada 15 días. | Mantener backup diario para BD y archivos críticos; usar retención quincenal/mensual como política adicional. |
| Datos de alumno | RF-1 menciona nombre, correo, teléfono y fecha de inicio; Q230 agrega edad, año escolar, colegio y fecha de término. | Definir campos obligatorios vs opcionales. Para MVP: obligatorios RF-1; opcionales los de Q230 salvo privacidad/operación. |
| Control manual vs avance automático | RF-15 establece control manual principal; Q163-Q165 define desbloqueo automático por score. | Implementar control manual primero; dejar reglas automáticas configurables como Should Have. |
| Explicaciones vs reutilización | Q122 dice que no se necesita ocultar respuestas para reutilizar; Q68/Q121 sí regulan respuestas ocultas en ciertos casos. | Mantener visibilidad configurable por set y regla especial para preguntas omitidas. |
| Full Practice Tests | MVP prioriza Practice Sets, pero hay alto detalle de FPT. | Modelar entidades pensando en FPT, pero construir interfaz FPT como fase posterior o incremento separado. |
| Reportes | Se piden reportes PDF individuales, reportes FPT y envío por correo; no se requiere reporte semanal/grupal. | Implementar primero reporte individual bajo demanda; correo y FPT según avance. |
| Eliminación de historial | Profesora puede borrar intentos, pero se pide retención/auditoría. | Usar invalidación lógica; no borrar físicamente por defecto. |
| Carga desde PDF | Q35 dice que PDF upload no parece necesario; Q190-Q192 consolidan conversión de PDFs a preguntas digitales. | Interpretar como: no visor PDF para alumno; sí proceso/admin de conversión desde materiales existentes. |

---

## 13. Priorización sugerida

### Must Have operativo

- Cuentas, invitación, login y recuperación.
- Alumno, grupos, desactivación e impersonation.
- Taxonomía SAT en inglés.
- Banco de preguntas digital con editor/admin.
- Practice Sets por tema y dificultad.
- Asignación individual/grupal.
- Bloqueo/desbloqueo manual.
- Player SAT-like con timer, navegación, pausa y autosave.
- Calificación automática.
- Historial completo.
- Dashboard profesora.
- Seguridad, roles, privacidad, backups y auditoría.

### Should Have

- Desbloqueo programado.
- Solicitud de desbloqueo.
- Recordatorios.
- Reporte individual PDF.
- Full Practice Tests.
- Desmos en Math para FPT.
- Vista padre/apoderado.
- Subskills administrables avanzados.
- Observabilidad operativa.

### Could Have

- Marcado para revisión y notas personales si no entra en el primer corte.
- Comentarios de profesora.
- Materiales teóricos.
- Comparativa privada entre alumnos.
- Branding propio.

### Won't Have MVP

- Comunidad.
- Gamificación.
- Proctoring/cámara/anti-trampa invasivo.
- Ranking.
- Modo oscuro.
- Optimización móvil completa.
- Exportación Excel para usuarios.

---

## 14. Mapa rápido de características a requisitos

| Característica | RF | RNF |
|---|---|---|
| Cuentas de alumno e invitación | RF-1, RF-2, RF-3, RF-4 | RNF-10, RNF-11, RNF-12 |
| Grupos/ciclos | RF-5 | RNF-11 |
| Impersonation | RF-6 | RNF-11, RNF-16 |
| Dashboard alumno | RF-7 | RNF-1, RNF-2 |
| Taxonomía y mapa de contenido | RF-8, RF-9, RF-10, RF-11 | RNF-1 |
| Practice Sets | RF-12-RF-18 | RNF-3, RNF-6 |
| Player de preguntas | RF-19-RF-27 | RNF-3, RNF-4, RNF-5, RNF-7, RNF-8 |
| Calificación y revisión | RF-28-RF-35 | RNF-14, RNF-17 |
| Dashboard profesora | RF-36-RF-39, RF-57, RF-59 | RNF-6 |
| Notificaciones y reportes | RF-40-RF-44 | RNF-23, RNF-24 |
| Banco de preguntas y contenido | RF-45-RF-48 | RNF-18, RNF-19, RNF-22 |
| Full Practice Tests | RF-49-RF-55 | RNF-21 |
| Padres/apoderados | RF-58 | RNF-12, RNF-13 |
| Exclusiones | RF-60-RF-62 | RNF-27, RNF-28, RNF-29 |

