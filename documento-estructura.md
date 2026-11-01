# Estado actual, brechas y plan de cierre técnico — SAT Platform

**Fecha de corte:** 30 de septiembre de 2026  
**Objetivo:** establecer el estado real del proyecto frente al alcance comprometido, identificar observaciones pendientes y justificar el periodo adicional necesario para completar el cierre técnico del producto.

## 1. Resumen ejecutivo

A la fecha, el proyecto ha alcanzado un nivel en el que **los principales requerimientos funcionales se encuentran implementados**: gestión por roles, banco de preguntas, Practice Sets, Full Practice Tests, asignaciones, ejecución de evaluaciones, resultados, analytics, reportes e ingesta de contenido.

El repositorio documenta un ciclo funcional bastante completo. Practice Sets dispone de creación, edición, duplicación, publicación, asignación, player, autosave, pausa, submit, scoring y revisión. Los Full Practice Tests disponen de los cuatro módulos SAT-like, asignaciones, intentos, autosave, pausa, reanudación, submit, scoring y ciclo de creación hasta reporte.

Por lo tanto, **la ampliación de plazo no debería presentarse como tiempo requerido para terminar las funcionalidades originalmente solicitadas**, sino como un periodo de **hardening, validación y cierre técnico** destinado a cubrir principalmente requerimientos no funcionales.

La situación puede resumirse así:

| Dimensión                                | Estado                                                   |
| ---------------------------------------- | -------------------------------------------------------- |
| Alcance funcional principal              | **Completado**                                           |
| Flujo Teacher / Student / Admin / Parent | **Completado**                                           |
| Practice Sets                            | **Completado funcionalmente**                            |
| Full Practice Tests                      | **Completado funcionalmente, sujeto a validación final** |
| Analytics / Reports / History            | **Completado funcionalmente, sujeto a regresión**        |
| Ingesta de contenido                     | **Completado funcionalmente**                            |
| Persistencia y operación productiva      | **Requiere hardening**                                   |
| Escalabilidad                            | **Requiere hardening**                                   |
| Seguridad                                | **Requiere hardening y validación**                      |
| Resiliencia                              | **Requiere pruebas de cierre**                           |
| Observabilidad                           | **Parcial**                                              |
| Pruebas automáticas / regresión          | **Requiere fortalecimiento**                             |
| Performance / carga                      | **Pendiente de validación formal**                       |
| Documentación de operación               | **Pendiente de cierre**                                  |

En consecuencia, se propone **congelar el alcance funcional actual** y dedicar un periodo mínimo adicional de una semana exclusivamente a estabilización y requisitos no funcionales.

---

# 2. Alcance funcional comprometido versus estado actual

## 2.1 Gestión de usuarios y roles

### Alcance esperado

La plataforma debía permitir operación diferenciada para:

- Administrador.

- Profesor.

- Estudiante.

- Padre de familia.

### Estado actual

**COMPLETADO.**

El repositorio contiene los cuatro portales y los mecanismos correspondientes de autenticación, autorización por rol y navegación. Admin administra usuarios, programas, taxonomía e ingesta; Teacher administra alumnos, preguntas, Practice Sets, Full Tests y reportes; Student ejecuta actividades y consulta resultados; Parent consulta el progreso de estudiantes relacionados.

### Observación

Aunque existe protección por rol, el cierre técnico debe validar autorización a nivel de recurso para evitar que un usuario autenticado pueda acceder mediante identificadores a recursos que no le corresponden.

---

# 3. Practice Sets

### Alcance esperado

El profesor debe poder:

- gestionar preguntas;

- construir Practice Sets;

- asignarlos;

- permitir que el alumno los complete;

- guardar progreso;

- calcular resultados;

- visualizar resultados posteriormente.

### Estado actual

**COMPLETADO FUNCIONALMENTE.**

El repositorio documenta explícitamente creación, edición, duplicación, publicación, archivo, asignación, autosave, pausas, submit, scoring, revisión y reporte.

### Observaciones de cierre

Durante las revisiones de septiembre se definieron reglas adicionales relativas a:

- modo `IMMEDIATE`;

- modo `AFTER_SET`;

- aislamiento entre Practice y Mock;

- taxonomía Math / Reading / Writing;

- consistencia de History, Analytics y Reports.

Estas reglas formaron parte del backlog de estabilización del 14/09.

De acuerdo con el estado reportado actualmente, estas funcionalidades ya han sido cubiertas; por tanto, el pendiente debe tratarse como **QA de regresión**, no como desarrollo funcional nuevo.

---

# 4. Full Practice Tests

### Alcance esperado

Debe existir un flujo de examen SAT separado de Practice Sets, compuesto por:

1. Reading & Writing — Module 1.

2. Reading & Writing — Module 2.

3. Math — Module 1.

4. Math — Module 2.

Debe permitir:

- asignación;

- ejecución;

- temporización;

- persistencia;

- submit;

- revisión;

- resultados;

- scoring.

### Estado actual

**COMPLETADO FUNCIONALMENTE.**

El modelo y las rutas correspondientes ya existen y el repositorio registra un ciclo completo desde creación hasta reporte.

### Observaciones

El backlog del 14/09 identificó como puntos sensibles:

- timers independientes por módulo;

- finalización anticipada;

- `Finish / Submit Module`;

- break no obligatorio;

- separación completa respecto de Practice;

- review por módulos;

- persistencia después de reinicios.

Estos elementos deben formar parte de la prueba de regresión final.

Existe además una dependencia funcional externa que debe quedar documentada: la estructura visual del score está definida, pero el backlog señalaba que la fórmula SAT definitiva no debía hardcodearse mientras la responsable funcional no proporcionara la regla final.

Si dicha fórmula ya fue proporcionada e implementada, deberá simplemente incorporarse como evidencia de cierre. Si no, debe quedar explícitamente registrada como **dependencia de producto**, no como incumplimiento técnico.

---

# 5. Analytics, History y Reports

### Estado

**COMPLETADO FUNCIONALMENTE, CON VALIDACIÓN FINAL PENDIENTE.**

El repositorio ya contiene analytics por alumno, pregunta, skill, dificultad y tiempo, además de reportes individuales, PDF y visualización para padres.

El backlog posteriormente exigió consistencia transversal entre:

- Math;

- Reading;

- Writing;

- Difficulty;

- Topics;

- número de intentos;

- PDF;

- Analytics;

- History;

- Reports.

También definió casos específicos que debían probarse antes de considerar cerrada la versión.

Por ello, en esta etapa no corresponde ampliar funcionalidad, sino ejecutar **pruebas de regresión sobre datos y visualización**.

---

# 6. Diferencia fundamental entre “funcional” y “cerrado”

Actualmente el proyecto puede considerarse **funcional**, pero un cierre de proyecto requiere adicionalmente demostrar que el sistema:

- mantiene información después de reinicios;

- soporta múltiples usuarios sin corrupción de datos;

- maneja adecuadamente fallos parciales;

- puede desplegarse y recuperarse repetidamente;

- protege datos y recursos;

- dispone de trazabilidad suficiente para diagnosticar incidentes;

- dispone de pruebas repetibles;

- mantiene un comportamiento aceptable bajo carga;

- cuenta con documentación suficiente para ser mantenido después de la entrega.

Ese es el principal motivo por el cual **completar requerimientos funcionales no implica automáticamente que todos los requerimientos no funcionales hayan sido satisfechos**.

---

# 7. Brechas no funcionales identificadas respecto al repositorio

## 7.1 Persistencia y concurrencia

El README disponible del repositorio continúa declarando:

`Prisma 7 + SQLite + better-sqlite3`.

Además, la configuración documentada utiliza:

`DATABASE_URL=file:./dev.db`

con la base persistida como archivo dentro del proyecto.

Esto funciona para desarrollo y cargas reducidas, pero introduce limitaciones para:

- escalado horizontal;

- múltiples instancias;

- concurrencia de escritura;

- despliegues serverless;

- alta disponibilidad;

- recuperación operacional.

### Trabajo requerido

Validar la rama actual y, si continúa esta arquitectura:

- migrar persistencia productiva a PostgreSQL;

- ejecutar migraciones;

- validar índices;

- probar integridad de datos;

- probar concurrencia;

- validar backup y restore.

Si la rama actual ya contiene PostgreSQL, este punto pasa de **implementación** a **validación y evidencia**.

---

# 8. Storage y persistencia de archivos

El propio README indica que los uploads locales deben migrarse a almacenamiento persistente externo para producción.

### Riesgo

Una instancia puede ser destruida o sustituida durante:

- despliegue;

- autoscaling;

- recuperación;

- cambio de infraestructura.

Los archivos almacenados localmente podrían desaparecer.

### Trabajo requerido

- utilizar almacenamiento externo persistente;

- validar permisos;

- validar paths;

- probar subida/recuperación;

- probar comportamiento después de redeploy.

---

# 9. Seguridad

La aplicación ya dispone de autenticación, roles, secretos y auditoría.

Sin embargo, el mismo README contiene instrucciones que todavía deben considerarse parte del hardening productivo:

- rotación de secretos;

- protección del servicio de ingesta;

- sincronización del token interno;

- protección de claves;

- backups;

- externalización del storage.

Adicionalmente, la arquitectura objetivo plantea autorización por recurso, validación runtime, protección de uploads, rate limiting y controles de seguridad integrados en CI.

### Trabajo requerido

- revisar authorization server-side;

- impedir acceso horizontal entre estudiantes;

- revisar teacher → student impersonation;

- verificar protección de endpoints;

- revisar manejo de secretos;

- validar uploads;

- configurar límites;

- ejecutar pruebas básicas de abuso.

---

# 10. Resiliencia

El backlog ya definía explícitamente tres pruebas que debían pasar antes del cierre:

- reiniciar el servicio y comprobar que `View Student` continúa funcionando;

- reiniciar y comprobar que el player no presenta overlays técnicos;

- refrescar durante impersonación y comprobar que no termina en 404.

### Trabajo requerido

Ampliar estas pruebas a:

- refresh durante un Practice Set;

- refresh durante un Full Practice Test;

- pérdida temporal de conexión;

- retry;

- submit duplicado;

- recuperación después de restart;

- expiración de sesión;

- fallos del servicio de ingesta;

- reejecución segura.

---

# 11. Observabilidad

Actualmente existen Audit Logs y eventos específicos del proceso de ingesta, lo cual es una base positiva.

Sin embargo, la arquitectura objetivo plantea observabilidad transversal mediante OpenTelemetry y correlation IDs entre:

Browser → Next.js → API/Action → Service/DAL → DB/jobs.

### Trabajo requerido

Como mínimo:

- request ID;

- logs estructurados;

- errores centralizados;

- latencia de requests;

- latencia de base de datos;

- errores de submit;

- fallos de autosave;

- tiempos de procesamiento de ingesta.

El objetivo no es construir una plataforma completa de observabilidad en esta semana, sino obtener suficiente trazabilidad para operar y diagnosticar la solución.

---

# 12. Pruebas y Quality Gates

El backlog funcional ya contiene un conjunto importante de escenarios de QA para:

- taxonomía;

- History;

- Reports;

- feedback;

- Full Practice Tests;

- resiliencia.

La arquitectura objetivo adicionalmente establece que los flujos críticos deben pasar pruebas E2E y propone Playwright, component testing y controles de accesibilidad.

### Trabajo requerido

Automatizar al menos los caminos críticos:

Teacher → Assignment → Student → Practice → Submit → Report.

Teacher → Full Test → Assignment → Student → Module 1 → Module 2 → Math → Submit → Result.

No es necesario automatizar las 63 pantallas para cerrar esta etapa.

---

# 13. Performance y escalabilidad

Actualmente no existe en la evidencia disponible un resultado formal de:

- prueba de carga;

- concurrencia;

- p95/p99;

- comportamiento bajo múltiples usuarios;

- recuperación después de saturación.

Por ello, este requisito debe figurar como **pendiente de validación no funcional**.

### Pruebas mínimas

Validar:

- login concurrente;

- carga de dashboards;

- consultas de analytics;

- autosave;

- submit;

- asignaciones;

- lectura de preguntas;

- generación de reportes.

El resultado debe permitir identificar cuellos de botella antes de declarar el sistema listo para operación.

---

# 14. Por qué se requiere no menos de una semana adicional

La extensión no se solicita porque falte construir el producto funcional.

Se solicita porque los cambios restantes son **transversales**.

Cambiar persistencia, despliegue, autorización, storage o manejo de errores puede afectar simultáneamente:

- Teacher;

- Student;

- Admin;

- Parent;

- Practice;

- Full Tests;

- Reports;

- Analytics;

- Ingesta.

Por ello, realizar el cambio y desplegar inmediatamente sin una ronda completa de regresión introduce un riesgo considerable de entregar una plataforma aparentemente funcional pero con errores de operación.

Además, durante el proyecto el alcance aumentó respecto de la estimación inicial debido a la aparición de nuevos documentos y requerimientos. Esto ya fue señalado durante la conversación de cierre: se indicó que la estimación inicial se había definido antes de modificar el alcance debido a la cantidad de documentos posteriormente incorporados, y se solicitó sustentar cualquier extensión indicando hasta cuándo y para qué se necesitaba.

La ampliación propuesta, por tanto, tiene dos fundamentos diferentes:

**1. Evolución del alcance funcional durante el proyecto.**

Se incorporaron y aclararon reglas posteriores sobre taxonomía, Practice/Mock, analytics, feedback, timers, reports y comportamiento de evaluaciones.

**2. Necesidad de cerrar requerimientos no funcionales.**

Una vez cubierto lo funcional, se requiere validar persistencia, seguridad, resiliencia, rendimiento, observabilidad y despliegue.

---

# 15. Propuesta de extensión

## Periodo propuesto

**1 al 8 de octubre de 2026.**

La fecha del **1 de octubre** debe utilizarse como **functional freeze**.

Desde ese momento no deberían incorporarse nuevas funcionalidades dentro del alcance de cierre, salvo correcciones de defectos.

El **8 de octubre** debe utilizarse como objetivo de cierre técnico y entrega de evidencias.

---

# 16. Plan de ejecución

## Día 1 — Baseline y congelamiento funcional

- Crear tag/commit de referencia.

- Inventariar endpoints y servicios.

- Ejecutar smoke test completo.

- Confirmar qué puntos del backlog están realmente implementados.

- Registrar cualquier observación residual.

- Congelar nuevos requerimientos funcionales.

**Entregable:** matriz de alcance con `Completado / Observación / Pendiente`.

---

## Día 2 — Persistencia e infraestructura

- Revisar arquitectura activa.

- Validar PostgreSQL/SQLite.

- Validar storage persistente.

- Validar migraciones.

- Validar configuración de producción.

- Eliminar dependencias innecesarias del filesystem local.

- Probar despliegue desde cero.

**Entregable:** ambiente reproducible y persistencia validada.

---

## Día 3 — Seguridad y resiliencia

- Revisar permisos.

- Revisar impersonation.

- Revisar acceso por ID.

- Validar secretos.

- Validar uploads.

- Probar restart.

- Probar refresh.

- Probar recovery.

- Probar submit duplicado.

**Entregable:** checklist de seguridad y resiliencia.

---

## Día 4 — QA automatizado y observabilidad

Implementar pruebas E2E de los flujos principales.

Agregar:

- correlation IDs;

- error logging;

- métricas mínimas;

- trazabilidad de jobs;

- logs de autosave/submit.

**Entregable:** suite de regresión crítica + trazabilidad operacional.

---

## Día 5 — Performance y escalabilidad

Ejecutar pruebas controladas de concurrencia.

Medir:

- latencia;

- errores;

- consultas DB;

- consumo de recursos;

- comportamiento de autosave;

- submit concurrente.

Corregir cuellos de botella críticos.

**Entregable:** reporte de performance y hallazgos.

---

## Día 6 — Regresión completa

Ejecutar nuevamente:

- Teacher;

- Student;

- Admin;

- Parent;

- Practice;

- Full Practice;

- History;

- Analytics;

- Reports;

- PDF;

- Ingesta.

No introducir cambios estructurales nuevos salvo defectos encontrados.

**Entregable:** matriz de regresión.

---

## Día 7 — UAT, documentación y handoff

- validación funcional final;

- documentación de arquitectura;

- procedimiento de despliegue;

- procedimiento de rollback;

- variables de entorno;

- backup/restore;

- operación básica;

- incidencias conocidas;

- backlog post-entrega.

**Entregable:** release candidate final.

---

## 8 de octubre — Cierre técnico

Realizar revisión final con stakeholders y clasificar cada elemento como:

**COMPLETADO**  
Implementado, probado y sin observaciones críticas.

**COMPLETADO CON OBSERVACIONES**  
Operativo, pero existe una mejora posterior que no impide producción.

**PENDIENTE POR DEPENDENCIA EXTERNA**  
Requiere definición, dato o aprobación funcional ajena al desarrollo.

**FUERA DE ALCANCE**  
Solicitud nueva que no forma parte del cierre actual.

No debe mantenerse ningún elemento simplemente como “pendiente” sin indicar:

- qué falta;

- impacto;

- responsable;

- condición de cierre.

---

# 17. Criterios para declarar el proyecto cerrado

El proyecto puede considerarse técnicamente cerrado cuando:

1. Los flujos funcionales principales pasan regresión.

2. No existen errores críticos conocidos.

3. Los datos sobreviven restart/redeploy.

4. Practice y Full Tests mantienen persistencia correcta.

5. Los permisos han sido validados.

6. Existe storage persistente.

7. Existe backup/restore probado.

8. Existe trazabilidad suficiente para diagnosticar errores.

9. Las pruebas críticas son repetibles.

10. Se ha realizado al menos una prueba de concurrencia.

11. El despliegue puede reproducirse.

12. Existe procedimiento de rollback.

13. Las observaciones restantes están documentadas.

14. Las dependencias de producto están diferenciadas de defectos técnicos.

15. El repositorio queda etiquetado con una versión de entrega.

---

# 18. Alcance que NO debería incluirse en esta semana

La semana de hardening no debería convertirse en una nueva fase de evolución del producto.

Por tanto, deben quedar fuera salvo que exista un defecto crítico:

- nuevas pantallas;

- nuevos módulos;

- nuevos reportes;

- cambios grandes de UX;

- nuevas capacidades de IA;

- nuevas integraciones;

- nueva taxonomía no solicitada;

- nuevas funcionalidades de negocio.

También existe una arquitectura objetivo mucho más extensa que contempla Design System completo, OpenFeature, WCAG 2.2 AA, OpenTelemetry transversal, PostgreSQL, políticas centralizadas, workflows durables y quality gates.

**No es razonable pretender completar toda esa transformación en una semana.**

La semana adicional debe enfocarse exclusivamente en los RNF críticos necesarios para poder entregar la plataforma con confianza operacional.

El resto debe convertirse en un **roadmap técnico posterior**.

---

# 19. Decisión solicitada

Se propone:

**1. Dar por finalizado el desarrollo funcional principal al 1 de octubre.**

**2. Congelar el alcance funcional.**

**3. Aprobar una extensión mínima hasta el 8 de octubre para hardening y cierre técnico.**

**4. Utilizar ese periodo exclusivamente para:**

- arquitectura productiva;

- persistencia;

- seguridad;

- resiliencia;

- observabilidad;

- pruebas;

- performance;

- documentación;

- regresión.

**5. Tratar cualquier nueva funcionalidad solicitada a partir del freeze como cambio de alcance.**

La ampliación de una semana no representa, por tanto, una extensión para “terminar funcionalidades”, sino la separación necesaria entre:

**producto funcional**

y

**producto robusto, seguro, escalable, mantenible y preparado para operación.**

Esta separación permite además que la toma de decisiones se base en evidencia: qué fue solicitado, qué fue implementado, qué está probado, qué presenta observaciones y qué pertenece a una evolución posterior del producto.
