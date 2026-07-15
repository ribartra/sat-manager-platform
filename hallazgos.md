## Pendientes consolidados

Revisé ambas transcripciones y eliminé duplicados. La segunda reunión redefine varios puntos de la pre-revisión, especialmente el enfoque individual, el acceso de padres y la eliminación de solicitudes hechas por alumnos.  

### 1. Pendientes críticos del producto

| # | Pendiente                                                                                                                                                     | Responsable                                    | Deadline                                                                          |
| - | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------- |
| 1 | **Completar el 50 % restante del sistema**, principalmente el motor que conecta la IA, procesa el contenido importado y carga resultados en la plataforma.    | Ricardo / desarrollo                           | **Antes de iniciar medición y validación; semana 10 / quincena de julio de 2026** |
| 2 | Integrar el **flujo de importación de preguntas**: actualmente planteado por Excel y posteriormente por ZIP para procesamiento con IA.                        | Desarrollo                                     | Antes de validación                                                               |
| 3 | Cargar el **contenido real del banco SAT**, reemplazando las preguntas y datos simulados de la demo.                                                          | Desarrollo + cliente, proporcionando contenido | Antes de pruebas funcionales                                                      |
| 4 | Corregir el flujo de inscripción para que **la profesora cree o inscriba directamente al alumno**.                                                            | Desarrollo                                     | Próxima versión                                                                   |
| 5 | Eliminar la solicitud inicial del alumno para ingresar o ser aceptado en un programa.                                                                         | Desarrollo                                     | Próxima versión                                                                   |
| 6 | Eliminar la opción en la que el alumno solicita que una práctica o evaluación bloqueada sea desbloqueada. La profesora controla las asignaciones y aperturas. | Desarrollo                                     | Próxima versión                                                                   |
| 7 | Mantener el funcionamiento principal **por alumno individual**, sin depender de salones o grupos.                                                             | Desarrollo                                     | Aplicable desde la siguiente iteración                                            |
| 8 | Configurar el desbloqueo automático del siguiente nivel cuando el alumno alcance **75 %**: Easy → Medium y aplicar la misma lógica de progresión hacia Hard.  | Desarrollo                                     | Antes de validación                                                               |
| 9 | Ordenar la progresión de contenido como: **todos los Easy de un tema → todos los Medium → todos los Hard**, sin alternar dificultades.                        | Desarrollo                                     | Antes de cargar el contenido final                                                |

### 2. Player de prácticas y exámenes

| #  | Pendiente                                                                                                                                                                    | Responsable | Deadline                             |
| -- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------ |
| 10 | Cambiar el botón según estado: **Start** cuando no se ha iniciado y **Resume** cuando existe progreso guardado.                                                              | Desarrollo  | Próxima revisión                     |
| 11 | Permitir pausar y reanudar tanto prácticas como exámenes.                                                                                                                    | Desarrollo  | Antes de validación                  |
| 12 | Mostrar en estadísticas si el alumno pausó una evaluación.                                                                                                                   | Desarrollo  | Antes de validación                  |
| 13 | Registrar y mostrar información de pausa: momento de pausa, duración de la interrupción y cuánto tiempo pasó antes de retomarla.                                             | Desarrollo  | Antes de validación                  |
| 14 | Mostrar el **número de intento** en los resultados recientes.                                                                                                                | Desarrollo  | Próxima versión                      |
| 15 | Mostrar el historial de intentos del alumno cuando sea sencillo implementarlo. Como mínimo, conservar los distintos resultados y no mostrar únicamente un resultado ambiguo. | Desarrollo  | Antes de validación; prioridad media |
| 16 | Verificar el tratamiento de preguntas sin respuesta y su representación como **Unanswered** en el resultado final.                                                           | Desarrollo  | Antes de pruebas                     |
| 17 | Implementar correctamente el selector de visibilidad de explicaciones con las tres opciones: **Show immediately, Show after finish y Hidden**.                               | Desarrollo  | **Para la siguiente revisión**       |
| 18 | Mantener **Show after finish** como comportamiento recomendado o predeterminado, pero permitir que la profesora elija cualquiera de las tres opciones.                       | Desarrollo  | Próxima revisión                     |

### 3. Preguntas, fórmulas e imágenes

| #  | Pendiente                                                                                                                              | Responsable          | Deadline                               |
| -- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------------- |
| 19 | Permitir imágenes estáticas en el enunciado de las preguntas.                                                                          | Desarrollo           | Antes de importar el banco completo    |
| 20 | Permitir imágenes estáticas también en las alternativas de respuesta.                                                                  | Desarrollo           | Antes de importar el banco completo    |
| 21 | Conservar soporte para texto y fórmulas matemáticas junto con imágenes.                                                                | Desarrollo           | Antes de validación                    |
| 22 | Recibir o seleccionar ejemplos reales de preguntas cuyas alternativas sean gráficos o imágenes, para probar el diseño.                 | Cliente              | Antes de cerrar el módulo de preguntas |
| 23 | Mejorar visualmente el selector de preguntas de un practice set, mostrando de forma más clara el enunciado y sus alternativas.         | Desarrollo           | Sin fecha explícita; mejora de UX      |
| 24 | Probar el editor con preguntas reales y corregir fórmulas, alternativas y respuesta correcta cuando la extracción de IA tenga errores. | Desarrollo + cliente | Durante medición y validación          |

**Fuera de alcance:** no se requiere construir una calculadora gráfica ni un clon de Desmos. Solo deben mostrarse gráficos como imágenes estáticas.

### 4. Content Map e historial académico

| #  | Pendiente                                                                                        | Responsable | Deadline                                          |
| -- | ------------------------------------------------------------------------------------------------ | ----------- | ------------------------------------------------- |
| 25 | Reorganizar **Content Map** en tres pestañas independientes: **Mathematics, Reading y Writing**. | Desarrollo  | Antes de la siguiente demo funcional              |
| 26 | Dentro de cada pestaña, mostrar sus temas, subtopics, prácticas y niveles correspondientes.      | Desarrollo  | Antes de cargar el contenido completo             |
| 27 | Separar **Practice History** en Mathematics, Reading y Writing.                                  | Desarrollo  | Antes de validación                               |
| 28 | Mostrar dentro de cada historial los subtopics trabajados y el avance alcanzado.                 | Desarrollo  | Antes de validación                               |
| 29 | Permitir generar o descargar un reporte por cada área.                                           | Desarrollo  | Antes de validación                               |
| 30 | Añadir el botón para **generar y descargar reportes en PDF**.                                    | Desarrollo  | Antes de la revisión con padres o pruebas finales |

### 5. Acceso y reportes para padres

| #  | Pendiente                                                                                                                              | Responsable | Deadline                          |
| -- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------- |
| 31 | Crear una invitación temporal o de un solo uso para que el padre pueda revisar el progreso únicamente cuando la profesora lo autorice. | Desarrollo  | Antes de pruebas del perfil padre |
| 32 | Evitar que el padre tenga acceso permanente a la cuenta del alumno.                                                                    | Desarrollo  | Antes de pruebas del perfil padre |
| 33 | Permitir que la profesora genere un PDF y lo envíe manualmente al padre como alternativa al acceso temporal.                           | Desarrollo  | Antes de pruebas del perfil padre |
| 34 | Mantener ambas posibilidades disponibles: enlace temporal y reporte PDF.                                                               | Desarrollo  | Antes de validación               |

**No debe implementarse:** envío automático periódico de correos o reportes a padres.

### 6. Dashboard y analítica

| #  | Pendiente                                                                                                                         | Responsable           | Deadline                              |
| -- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------- |
| 35 | Completar los gráficos del módulo Analytics.                                                                                      | Desarrollo            | Antes de medición y validación        |
| 36 | Cambiar el análisis de “most missed questions” por un análisis de **subtopics con más errores**.                                  | Desarrollo            | Antes de validación                   |
| 37 | No mostrar el enunciado completo de cada pregunta en esta vista; mostrar algo resumido como subtopic, dificultad e identificador. | Desarrollo            | Antes de validación                   |
| 38 | Hacer que la analítica sea principalmente **por alumno**, usando un selector o filtro de alumno.                                  | Desarrollo            | Antes de validación                   |
| 39 | Mostrar para cada alumno su tema o subtopic más débil.                                                                            | Desarrollo            | Antes de validación                   |
| 40 | Añadir una indicación de **qué debe reforzar** o dónde debe concentrarse la profesora con ese alumno.                             | Desarrollo            | Antes de validación                   |
| 41 | Unificar o conectar las vistas **Compare** y **Analytics** para obtener un reporte completo del alumno seleccionado.              | Desarrollo            | Antes del dashboard final             |
| 42 | Conservar el indicador de alumnos que no han practicado durante **cinco o más días**.                                             | Desarrollo            | Ya aceptado; verificar en pruebas     |
| 43 | Evaluar un dashboard general comparativo para administración como funcionalidad final, sin reemplazar la vista individual.        | Desarrollo / producto | Fase final; pendiente de confirmación |

### 7. Bugs y verificaciones técnicas

| #  | Pendiente                                                                                                                                       | Responsable      | Deadline                                    |
| -- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------- |
| 44 | Corregir el bug por el cual un alumno agregado después a un grupo no hereda las prácticas previamente asignadas al grupo.                       | Desarrollo       | Solo si se mantiene funcionalidad de grupos |
| 45 | Verificar la asignación individual para que un alumno nuevo reciba correctamente una práctica.                                                  | Desarrollo       | Antes de pruebas                            |
| 46 | Revisar las notificaciones generadas al aceptar e inscribir al alumno y al asignarle Easy y Medium, evitando mensajes redundantes.              | Desarrollo       | Sin fecha explícita                         |
| 47 | Levantar la aplicación en un entorno accesible por internet para probarla fuera del equipo local y eliminar problemas propios de la demo local. | Desarrollo       | Antes de validación con usuarios            |
| 48 | Definir criterios de medición: exactitud de la IA, errores de importación, funcionamiento del player, reportes y experiencia del usuario.       | Equipo           | Inicio de medición y validación             |
| 49 | Ejecutar pruebas con al menos otro usuario, además de la profesora.                                                                             | Equipo + cliente | Durante semana 10                           |
| 50 | La cliente debe participar revisando las pruebas y reportando correcciones sobre preguntas y resultados.                                        | Cliente          | Durante medición y validación               |

## Fechas e hitos encontrados

* **Semana 7:** el proyecto se encontraba aproximadamente al 50 % de construcción, con 6 de 12 hitos completados.
* **Dos semanas después:** se esperaba cerrar la etapa de ejecución y pasar a medición y validación.
* **Semana 10 / quincena de julio de 2026:** inicio previsto de la etapa de medición y validación.
* **Martes 14 de julio de 2026, de 12:00 a 13:00:** siguiente reunión de revisión acordada. Esta fecha corresponde a **hoy**.
* La cliente quedó encargada de enviar el enlace de Zoom antes de la reunión y resolver la limitación de sesiones de 40 minutos.

Las fechas **26/06/2026 y 30/06/2026** mencionadas durante las demostraciones correspondían a fechas de desbloqueo y vencimiento usadas como ejemplos; no eran deadlines del proyecto.

