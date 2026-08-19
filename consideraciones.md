# Consideraciones SATSOL — backlog acordado

Documento de trabajo tras revisión de la reunión y aclaración de inconsistencias.
Actualizado: **2026-08-18**.

---

## Decisiones cerradas

| Tema                     | Acuerdo                                                                                                                                                                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scoring Practice vs Exam | **Practice Sets = solo porcentaje.** **Full Practice Tests / Exams = sí mantienen score tipo SAT.**                                                                                                                                                                  |
| Materials                | **No eliminar.** Ocultar detrás de un **flag Admin** (mismo patrón que otros `AppSetting`), **desactivado por defecto**. Cuando el flag esté OFF, se oculta para **Student y Teacher** (menú y rutas útiles). Solo Admin puede activar el flag en `/admin/settings`. |
| Contenido “blocked”      | **Fuera de alcance.** Fue error de usuario, no bug de producto.                                                                                                                                                                                                      |
| Semáforo de color        | Aplica a **Individual Report** (`/teacher/students/[id]/report`) y **Student Analytics** (`/teacher/analytics`). Mismo código visual rojo / amarillo / verde que ya usa Student (umbrales actuales: &lt;60 rojo, 60–79 amarillo, ≥80 verde).                         |

---

## Requerimientos prioritarios

| #   | Requerimiento                                                   | Tipo             | Criterio esperado                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | --------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Quitar puntajes/conversiones tipo SAT de Practice Sets**      | Funcional / UI   | En prácticas (resultados, historial alumno, Practice History del teacher, Individual Report, analytics ligados a practice) **no** mostrar valores tipo **400**, `SAT`, `SAT Average`, `SAT R&W avg`, `SAT Math avg`, etc. Solo **porcentaje** (y correctas/total si aplica). Los **Full Practice Tests / Exams conservan** scoring SAT.                                                                                                                          |
| 2   | **Semáforo de % en Individual Report y Student Analytics**      | UI               | Los porcentajes del alumno en esas dos pantallas deben colorearse rojo/amarillo/verde como en Student. Ej.: 33% en rojo.                                                                                                                                                                                                                                                                                                                                         |
| 3   | **Separar resultados Practice vs Exam en reportes del teacher** | Funcional        | El área de reportes del profesor debe presentar **Practice** y **Exam** por separado (no mezclar intentos ni promedios). Individual Report hoy está centrado en Practice; al limpiar SAT de practice, los promedios SAT de exam no deben colarse ahí.                                                                                                                                                                                                            |
| 4   | **Rediseñar layout del player de preguntas**                    | UX/UI            | Mejor uso del espacio vacío: enunciado/contenido más grande; mejor distribución de pregunta y alternativas. Referencia Izquierda estímulo y enunciado; Derecha, Alternativas. Mantener controles Next/Submit usables (no romper el viewport reciente).                                                                                                                                                                                                           |
| 5   | **Materials como funcionalidad activable por Admin**            | Alcance / config | Flag en `/admin/settings`, **default OFF**. Con flag OFF: ocultar Materials en navegación y acceso de **Student y Teacher**. **No borrar** código ni datos.                                                                                                                                                                                                                                                                                                      |
| 6   | **Importación dual: preguntas + respuestas/explicaciones**      | UX / funcional   | En la vista de importación de **Practice Sets** y de **Full Practice Test**, mostrar **dos bandejas**: (1) archivo de **preguntas** y (2) archivo de **respuestas / explicaciones**. Indicaciones claras del tipo de archivo aceptado: **Preguntas** / **Respuestas** / **Explicaciones** / **Respuestas con explicaciones**. Dejar un checkbox para marcar en el caso del segundo archivo para indicar si es respuesta con explicaciones en un único documento. |
| 7   | **Mejorar visibilidad del botón de carga de archivos**          | UI               | El selector `Choose file` (y las bandejas del punto 6) debe ser más visible y entendible.                                                                                                                                                                                                                                                                                                                                                                        |
| 8   | **Mantener flujo Draft → Review → Publish**                     | Funcional        | Tras importar, queda versión preliminar; el profesor/admin revisa y corrige; solo tras `Publish` se puede asignar a alumnos. Dejar filtrado que en caso se inicia importación se trabaje con eso únicamente no la historia de importaciones pasadas. Debería aparecer correctamente la vista para teacher al cargar. Verificar                                                                                                                                   |

---

## Comportamientos que deben mantenerse (sin regresión)

- Asignar Practice Set desde Teacher y que aparezca en el dashboard del alumno.
- Navegación `Next` entre preguntas.
- `Mark for review`.
- Advertencia al enviar con preguntas sin responder.
- Historial del alumno: `Students → View → Practice History`, incluyendo incorrectas.
- Envío de reporte de progreso al padre (PDF/correo); el reporte simplificado mostrado se considera suficiente (**sin** reintroducir SAT score de practice).

---

## Fuera de alcance en esta etapa

- Ampliar contenido / seguir subiendo material masivo antes de corregir lo anterior.
- Tratar “This content is blocked” como bug de producto.
- Eliminar el módulo Materials (solo apagarlo por defecto).

---

## Backlog inmediato (orden sugerido)

1. **FIX:** Practice = solo %; Exam = conservar SAT. Quitar SAT/400/averages de pantallas de practice (Student, Teacher Practice History, Individual Report, analytics de practice).
2. **UI:** semáforo de % en **Individual Report** + **Student Analytics**.
3. **FEATURE:** separar Practice vs Exam en reportes del teacher.
4. **CONFIG:** flag Admin `MATERIALS` (o nombre equivalente), default OFF; ocultar UI en Student **y** Teacher cuando esté apagado.
5. **FEATURE/UI:** import Practice Set y Full Practice Test con **dos bandejas** + etiquetas de tipo de archivo; `Choose file` más visible.
6. **UI:** rediseño player, sin romper Next/Submit.
7. **VERIFY:** Draft → Review/Edit → Publish → Assign.
8. **REGRESSION:** Student, Teacher, Practice History, Parent Report.

---

## Notas de implementación (contexto técnico)

- Scoring SAT de practice hoy vive en `lib/practice-set-scoring.ts` y se muestra p.ej. en resultados alumno, historial, ficha teacher e Individual Report (`SAT R&W avg` / `SAT Math avg`).
- Feature flags Admin ya existen vía `lib/app-settings.ts` + `/admin/settings` (mismo patrón que `QUESTION_GRAPH_VISUALIZATION`).
- Individual Report: `/teacher/students/[studentId]/report`. Student Analytics: `/teacher/analytics`.
