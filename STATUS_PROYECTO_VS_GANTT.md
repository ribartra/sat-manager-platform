# Status del proyecto vs Gantt_v1

**Fecha de corte:** 2026-06-23  
**Referencia:** `Gantt_v1.md`  
**Semana planificada actual:** Semana 7, tomando como base el inicio 2026-05-11 y entrega MVP 2026-07-31.  
**Conclusión ejecutiva:** el desarrollo técnico está adelantado respecto al Gantt. El MVP de Practice Sets cubre la mayor parte de los hitos 1 a 10 y además incluye capacidades post-MVP o fase 2 como Full Practice Tests, portal de padre, materiales, analytics, PDF y auditoría ampliada. El foco pendiente no es tanto construir pantallas base, sino cerrar QA funcional/manual, carga de contenido real, validación con usuarios y preparación operativa para piloto.

## Resumen por estado

| Estado | Semanas / hitos | Lectura |
|---|---|---|
| Completado funcionalmente | H1-H10 | Hay implementación en rutas, APIs, modelo de datos y flujos principales para alcance, auth, contenido, Practice Sets, scoring, asignaciones, dashboard y reportería docente. |
| Parcial / por validar | H11 | Existen scripts de QA estática y checklist, pero falta evidencia de prueba manual end-to-end con contenido real y cuentas piloto. |
| Pendiente de ejecución real | H12 | Falta piloto controlado con profesora/alumnos, medición de uso, feedback y backlog fase 2 aprobado. |
| Adelantado vs Gantt | Full Practice Tests, padres, materiales, analytics, PDF, auditoría | Funcionalidad adicional ya implementada o con base fuerte, aunque debe validarse antes de declararla cerrada de producto. |

## Status por semana del Gantt

| Semana | Hito Gantt | Estado actual | Qué se hizo | Qué falta |
|---:|---|---|---|---|
| 1 | H1 - Alcance MVP cerrado | Completado | Alcance consolidado documentado. MVP prioriza Practice Sets; roles principales definidos: admin, teacher, student y parent. | Mantener control de alcance para que Full Practice Tests no bloqueen cierre MVP. |
| 2 | H2 - Inventario de contenido validado | Parcial | Taxonomía SAT modelada: secciones, dominios, topics, subskills, dificultad Easy/Medium/Hard. Hay editor y carga/admin import. | Cargar contenido real desde PDFs, validar volumen inicial, revisar fidelidad visual de preguntas, fórmulas, tablas e imágenes. |
| 3 | H3 - Arquitectura aprobada | Completado | Modelo Prisma cubre usuarios, programas, grupos, preguntas, Practice Sets, assignments, attempts, snapshots, notificaciones, auditoría, padres, materiales y Full Practice Tests. | Documentar decisión final de despliegue, storage productivo y política de backups. |
| 4 | H4 - Prototipo UX validado | Parcial | Pantallas principales existen para login, student dashboard, content map, player, resultados, teacher dashboard, impersonation, admin y parent. | Validación UX formal con profesora y alumnos; ajustes visuales contra referencia SAT/PDF en laptop/tablet. |
| 5 | H5 - Cuentas y roles listos | Completado | Login NextAuth, JWT, roles, validación admin, invitación, activación, recuperación/cambio de contraseña, aprobación parental y layouts protegidos. | Configurar SMTP definitivo y validar emails reales en ambiente piloto. |
| 6 | H6 - Banco de preguntas operativo | Completado funcional | Banco de preguntas, alternativas, respuesta numérica, dificultad, estado, topic/subskill, media, KaTeX, Practice Sets y validaciones de publicación. | Carga inicial completa y revisión académica del contenido importado. |
| 7 | H7 - Practice Set resoluble por alumno | Completado funcional | Player de Practice Set con una pregunta por pantalla, navegación, progreso, autosave, pausa/salida, reconexión, respuestas A/B/C/D y numéricas, tiempos y blanks. | Prueba manual con alumnos piloto y casos de red/interrupción reales. |
| 8 | H8 - Historial y scoring funcional | Completado funcional | Submit, scoring, correctas/incorrectas/omitidas, porcentaje, tiempo, historial, snapshots de preguntas/sets, resultados y revisión con visibilidad de explicaciones. | Validar reglas académicas con datos reales y confirmar presentación de resultados esperada por la profesora. |
| 9 | H9 - Asignaciones completas | Completado funcional | Asignaciones individuales/múltiples/grupo, due date, lock/unlock, unlockAt, solicitudes de desbloqueo, estados y notificaciones internas. | QA manual del flujo completo teacher asigna -> student resuelve -> teacher revisa, incluyendo vencidos y desbloqueos. |
| 10 | H10 - Dashboard profesora funcional | Completado funcional | Dashboard docente, alumnos, grupos, programas, últimos accesos, pendientes, resultados, reportes, intentos, comentarios, analytics e impersonation. | Validar utilidad operativa con la profesora; ajustar métricas y alertas prioritarias para clase real. |
| 11 | H11 - Piloto interno listo | Parcial | Hay checklist P0 y scripts `qa:p0`, `qa:authz`, `qa:edge`. Build, lint, typecheck y Prisma validan correctamente. | Ejecutar checklist manual con contenido real, cuentas por rol, carga piloto, capturas/evidencia y corrección de bugs encontrados. |
| 12 | H12 - MVP validado | Pendiente | Base técnica lista para piloto. Backlog fase 2 parcialmente adelantado por Full Practice Tests y módulos extra. | Ejecutar piloto controlado, medir uso/errores/claridad, recopilar feedback y cerrar backlog priorizado fase 2. |

## Qué se hizo

- Autenticación, activación por invitación, recuperación/cambio de contraseña y validación de usuarios.
- Roles y permisos para `ADMIN`, `TEACHER`, `STUDENT` y `PARENT`.
- Programas, grupos, inscripciones, scope por programa y gestión de alumnos.
- Consentimiento/aprobación parental para menores y portal de padre.
- Banco de preguntas con topic, subskill, dificultad, MC/numérica, estado, media e input matemático con KaTeX.
- Practice Sets con creación, edición, publicación, asignación, bloqueo/desbloqueo y solicitudes de desbloqueo.
- Player de Practice Sets con autosave, pausa, continuación, tiempos, respuestas omitidas, marcadores/notas y recuperación offline.
- Scoring e historial con snapshots para preservar versiones históricas.
- Resultados del alumno y revisión respetando visibilidad de soluciones/explicaciones.
- Dashboard docente, detalle de alumno, intentos, comentarios, reportes y PDF.
- Notificaciones internas y job de recordatorios.
- Auditoría de acciones relevantes: importación, edición/publicación, intentos, impersonation y operaciones administrativas.
- Importación admin con preview/validación por fila.
- Full Practice Tests con estructura SAT-like, asignación, player, autosave, timer por módulo, scoring 200-800/400-1600 y resultados.
- Materiales de estudio, analytics docentes, comparación privada y avatar de usuario.

## Qué falta

### Para cerrar MVP

- Cargar y revisar contenido real inicial desde PDFs o fuente acordada.
- Ejecutar QA manual end-to-end con cuentas reales o semilla piloto para los roles Student, Teacher, Admin y Parent.
- Validar visualmente player, resultados y preguntas con fórmulas, imágenes, gráficos, tablas y textos largos.
- Confirmar con la profesora que los dashboards, reportes y alertas responden a su operación diaria.
- Configurar correo SMTP definitivo y probar invitaciones, activación y recuperación de contraseña con emails reales.
- Definir storage productivo para archivos/avatars/media; actualmente hay almacenamiento local para desarrollo.
- Definir despliegue, dominio, HTTPS, variables de entorno, backups y monitoreo básico.
- Preparar protocolo de piloto: usuarios, contenido, escenarios, checklist, criterios de aceptación y canal de feedback.

### Riesgos / brechas

- El avance técnico supera el cronograma, pero el cierre de producto depende de validación funcional con contenido real.
- Full Practice Tests ya existen, pero no deberían condicionar el MVP si Practice Sets está listo.
- La importación masiva existe, pero su calidad depende del formato final de datos.
- Los scripts de QA son estáticos; no reemplazan pruebas manuales ni pruebas reales de navegador.
- Producción requiere resolver almacenamiento, backup, SMTP, HTTPS y operación.
- El trabajo actual está en un árbol Git con muchos archivos modificados/no versionados; antes de entrega conviene ordenar commits y separar documentación, features y migraciones.

## Verificación técnica ejecutada

| Comando | Resultado |
|---|---|
| `npm run qa:p0` | OK - P0 static verification passed. |
| `npm run qa:authz` | OK - Authorization static verification passed. |
| `npm run qa:edge` | OK - Edge-case static verification passed. |
| `npm run prisma:validate` | OK - Prisma schema valid. |
| `npm run lint` | OK. |
| `npm run typecheck` | OK. |
| `npm run build` | OK - build de Next.js generado correctamente. |

## Próximos pasos recomendados

1. Congelar alcance MVP alrededor de Practice Sets.
2. Cargar un paquete piloto de contenido real.
3. Ejecutar QA manual del checklist P0 con evidencia.
4. Hacer sesión de validación con profesora sobre dashboard, asignaciones, resultados y reportes.
5. Corregir hallazgos críticos.
6. Preparar ambiente piloto con SMTP, storage, backups y datos iniciales.
7. Ejecutar piloto controlado y cerrar backlog fase 2.
