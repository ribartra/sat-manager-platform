# Guion de demo — Teacher · Student · Parent

> **Para quién es:** área de usuario / producto.  
> **Qué demuestra:** el ciclo real de la tutoría SAT en la plataforma: la profesora invita, el alumno entra, practica con experiencia tipo Digital SAT, y el padre ve progreso con claridad.  
> **Tono:** guion de demostración (escenas). Cada escena tiene *qué mostrar* y *qué decir*.

---

## Antes de empezar (2 minutos)

| Rol | Entrada típica | Notas |
|---|---|---|
| Profesora | `teacher@sat.com` | Portal `/teacher` |
| Alumno | email de la invitación | Activa cuenta y entra a `/student` |
| Padre / apoderado | email vinculado o enlace de reporte | Portal `/parent` o enlace temporal |

**Preparación recomendada**

1. Tener SMTP configurado (o aceptar que el enlace de activación salga en logs de desarrollo).
2. Contar con al menos un **Practice Set publicado** listo para asignar (Math o Reading & Writing).
3. Opcional: un padre de prueba con correo real para el cierre emocional de la demo.

**Promesa de la demo (frase de apertura)**

> “En menos de quince minutos vamos a ver cómo una tutora incorpora a un alumno, le asigna práctica y cómo la familia ve el avance — sin PDFs sueltos, sin Excel, con la sensación del SAT digital.”

---

## Escena 1 — La tutora entra a su sala

**Actor:** Teacher  
**Ruta:** `/login` → `/teacher`

**Qué mostrar**

- Login limpio, acceso inmediato al portal docente.
- Vista de alumnos / programas: el espacio de trabajo de la tutora, no un panel genérico.

**Qué decir**

> “Esta no es una plataforma masiva. Es el escritorio de la tutora: sus alumnos, sus sets, su seguimiento. Todo lo que pasa aquí queda con historial confiable.”

**Checkpoint usuario**

- [ ] Entra como teacher sin fricción.
- [ ] Reconoce su portal (alumnos, practice sets, padres).

---

## Escena 2 — “Hoy llega un alumno nuevo”

**Actor:** Teacher  
**Ruta:** `/teacher/students/invite` (o flujo de invitación de alumnos)

**Qué hacer en vivo**

1. Invitar a un alumno con nombre + email reales de prueba.
2. Si aplica, registrar datos de padre/tutor (nombre y correo).
3. Enviar la invitación.

**Qué mostrar**

- El alta no es “regístrate solo”: es **invitación controlada**.
- El correo (o el enlace de activación) queda listo para el alumno.

**Qué decir**

> “La tutora decide quién entra. El alumno recibe un enlace, activa su cuenta y queda vinculado al programa. Si es menor, el padre también entra en la historia desde el primer día.”

**Checkpoint usuario**

- [ ] La invitación se crea sin error.
- [ ] Llega el correo **o** se obtiene el link de activación de forma clara.
- [ ] Si se incluyó padre, queda preparado el vínculo / consentimiento según el flujo.

---

## Escena 3 — El alumno acepta y entra

**Actor:** Student  
**Ruta:** enlace del correo → `/auth/activate` → `/login` → `/student`

**Qué hacer en vivo**

1. Abrir el enlace de activación (idealmente en otra ventana o modo incógnito).
2. Definir contraseña.
3. Si el flujo pide consentimiento parental, completar esa pieza con el padre de prueba.
4. Iniciar sesión como alumno.
5. Mostrar el home del estudiante: asignaciones, práctica, mapa de contenido.

**Qué decir**

> “El alumno no descarga nada. Entra, activa y ya está en un entorno listo para practicar — cercano al SAT digital: una pregunta a la vez, foco, progreso guardado.”

**Checkpoint usuario**

- [ ] Activación con token válido funciona a la primera.
- [ ] Tras activar (y validación si aplica), el alumno entra a `/student`.
- [ ] Ve un espacio claro: qué tiene pendiente, qué puede practicar.

---

## Escena 4 — La tutora asigna con intención

**Actor:** Teacher  
**Ruta:** `/teacher/students/[alumno]/assign` (o asignación desde el detalle del alumno)

**Qué hacer en vivo**

1. Volver al portal teacher.
2. Elegir el alumno recién activado.
3. Asignar un Practice Set publicado (ideal: un skill concreto + dificultad Easy/Medium/Hard).
4. Opcional: fecha límite para mostrar seguimiento real.
5. Confirmar que el alumno queda con la asignación visible.

**Qué decir**

> “No es ‘aquí tienes un PDF’. Es práctica dirigida: este tema, esta dificultad, este alumno, con fecha y estado. La tutora controla el ritmo.”

**Checkpoint usuario**

- [ ] La asignación queda creada.
- [ ] El alumno la ve en su portal (refrescar / re-login si hace falta).
- [ ] El set asignado es el esperado (nombre, dificultad, área).

---

## Escena 5 — Practicar como en el SAT

**Actor:** Student  
**Ruta:** `/student` → Practice Set asignado → player

**Qué hacer en vivo**

1. Abrir la asignación.
2. Responder 2–4 preguntas en voz alta (MC y, si hay, numérica en Math).
3. Mostrar **mark for review**, navegación y que el progreso **se guarda solo**.
4. Cerrar la pestaña unos segundos y volver: el intento sigue ahí.
5. Enviar (submit) y abrir el resultado.

**Qué decir**

> “Autosave, pausa, retomar, marcar para revisar. La experiencia se siente de examen, no de formulario. Al terminar, el puntaje queda guardado — y el historial no se reescribe si mañana editamos una pregunta.”

**Detalles que venden (si el set lo permite)**

- Fórmulas con KaTeX legibles.
- Pasajes de Reading & Writing con **subrayado** visible cuando la pregunta lo pide.
- Resultado con porcentaje y, cuando aplique, lectura tipo score SAT de sección.

**Checkpoint usuario**

- [ ] Player usable: responder, marcar, continuar.
- [ ] Autosave / reanudación evidentes.
- [ ] Submit genera resultado visible para el alumno.
- [ ] La tutora puede ver el intento desde el detalle del alumno.

---

## Escena 6 — La tutora lee el progreso (no adivina)

**Actor:** Teacher  
**Rutas:** detalle del alumno → intento / reporte (`/teacher/students/[id]`, reporte, analytics si aplica)

**Qué mostrar**

- Intento enviado: correctas, incorrectas, omitidas, tiempos.
- Comentario docente (si se quiere cerrar el loop humano).
- Reporte del alumno y, si hay tiempo, descarga PDF por áreas (Math / Reading & Writing).

**Qué decir**

> “Aquí se nota la diferencia: la tutora no pregunta ‘¿cómo te fue?’. Abre el intento, ve el detalle y decide el siguiente set. El reporte sale listo para conversar con la familia.”

**Checkpoint usuario**

- [ ] El intento del alumno aparece en el portal teacher.
- [ ] El detalle es comprensible para una tutora no técnica.
- [ ] PDF o vista de reporte abre sin error.

---

## Escena 7 — El padre entra en la historia

**Actor:** Teacher → Parent  
**Rutas:** `/teacher/parents` → compartir reporte · `/parent` o `/parent/access?token=…`

### Variante A — Padre con cuenta (relación de largo plazo)

1. Crear / editar padre y **asociarlo al alumno**.
2. El padre inicia sesión en `/parent`.
3. Mostrar la card del hijo: intentos recientes, promedio, lectura SAT R&W / Math si hay datos.

### Variante B — Enlace de reporte (momento “wow” para marketing)

1. Desde el maestro de padres, **compartir enlace de reporte** (Math, R&W o ambos).
2. Abrir el correo del padre (o el link) en `/parent/access`.
3. Mostrar: primer acceso activa el enlace; el reporte queda disponible por una ventana limitada (7 días tras abrirlo).
4. Destacar que solo ve las áreas que la tutora eligió compartir.

**Qué decir**

> “La familia no necesita pelear con la plataforma. La tutora comparte un reporte claro, con el alcance que ella decide. El padre ve progreso — no el banco completo de preguntas.”

**Checkpoint usuario**

- [ ] Padre vinculado al alumno correcto.
- [ ] Portal padre muestra solo hijos asociados.
- [ ] Enlace compartido abre el reporte filtrado por áreas.
- [ ] Correo de reporte enviado (o SKIPPED documentado si SMTP no está activo).

---

## Escena 8 — Cierre en una frase (pitch final)

**Pantalla sugerida:** lado a lado — portal teacher con el alumno · resultado del student · card/reporte del parent.

**Texto de cierre**

> “Tres portales, una sola historia: la tutora invita y asigna, el alumno practica como en el SAT, el padre ve avance con confianza. Eso es SAT Practice — operación privada, contenido serio, seguimiento que se puede demostrar.”

**Pregunta de cierre al área usuario**

> “¿Este recorrido se siente listo para mostrárselo a una tutora real en una llamada de 15 minutos?”

---

## Guion corto (si solo hay 8–10 minutos)

| Min | Escena | Acción |
|---|---|---|
| 0–1 | Apertura | Login teacher + promesa |
| 1–3 | Invitar | Crear alumno (+ padre si hay tiempo) |
| 3–5 | Activar | Alumno acepta y entra |
| 5–7 | Asignar + practicar | Un set, 2–3 ítems, submit |
| 7–9 | Seguir | Teacher ve intento / reporte |
| 9–10 | Familia | Card padre o enlace de reporte + frase de cierre |

---

## Mapa de roles (qué “compra” cada uno)

| Rol | Lo que debe sentir al terminar |
|---|---|
| **Teacher** | “Puedo operar mi tutoría aquí: invito, asigno, reviso, comparto.” |
| **Student** | “Practicar se siente a examen; no se pierde mi progreso.” |
| **Parent** | “Entiendo cómo va mi hijo sin meterme al contenido completo.” |

---

## Evidencias mínimas para el área usuario

Al cerrar la sesión de prueba, dejar capturas o notas de:

1. Invitación enviada / alumno activado.
2. Asignación visible en teacher y student.
3. Resultado de un intento enviado.
4. Vista padre **o** reporte por enlace con áreas elegidas.

---

## Fuera de este guion (a propósito)

- Ingesta IA / promoción de PDFs (demo técnica aparte).
- Administración de taxonomía, SMTP y secretos (`/admin`).
- Full Practice Test completo módulo a módulo (se puede mencionar como “siguiente nivel”, no es obligatorio en este guion).

---

## Credenciales de apoyo (ambiente local / demo)

Usar las cuentas seed del ambiente cuando existan. En una BD limpia con solo teacher/admin, **este guion crea el alumno en vivo** — esa es la prueba de valor.

| Cuenta | Uso en el guion |
|---|---|
| `teacher@sat.com` | Protagonista de las escenas 1, 2, 4, 6, 7 |
| Alumno invitado | Escenas 3 y 5 |
| Padre invitado o enlace | Escena 7 |
| `admin@sat.com` | Solo si hace falta aprobar usuarios PENDING |

---

*Documento orientado a validación de experiencia de usuario y demo comercial. Para el inventario exhaustivo de casos de prueba, ver `Documento de pruebas funcionales SAT.docx`. Para ejecución automatizada del mismo arco Teacher → Student → Parent, ver `e2e/README.md` (`npm run test:e2e`).*
