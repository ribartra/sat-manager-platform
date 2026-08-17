# Guion comercial — Plataforma SAT

> **Propósito:** exposición comercial del funcionamiento del sistema, alineada al flujo validado con Playwright (`e2e/student.practice-set-easy.spec.ts` + journey Teacher → Student → Parent).  
> **Duración sugerida:** 12–15 minutos.  
> **Audiencia:** tutora / dueña de operación, decisor, familia interesada en seguimiento.  
> **Promesa de apertura:** “Una tutora invita, el alumno practica como en el SAT digital, y el progreso queda visible — sin PDFs sueltos ni Excel.”

---

## Mensaje central (30 segundos)

La plataforma no es un repositorio de exámenes: es el **escritorio operativo de la tutoría**.

1. La tutora controla quién entra (alumno y padre).
2. Asigna práctica real (contenido promovido desde material académico, no demos vacíos).
3. El alumno resuelve en un player tipo Digital SAT.
4. La tutora — y la familia — ven el avance con historial confiable.

---

## Preparación antes de la demo

| Rol | Credencial / entrada | Portal |
|---|---|---|
| Tutora | `teacher@sat.com` | `/teacher` |
| Alumno | se crea en vivo con la invitación | `/student` |
| Padre | se registra en la invitación del menor | `/parent` o enlace de reporte |

**Checklist técnico**

- [ ] App levantada (local o `satsol.org`).
- [ ] SMTP activo **o** link de activación visible tras “Invite created”.
- [ ] Al menos un Practice Set **EASY publicado** proveniente de ingesta (ej. *Circles - EASY*).
- [ ] Navegador listo; idealmente segunda ventana / incógnito para alumno.

**Atajo de ensayo automatizado (opcional, off-stage)**

```bash
npx playwright test e2e/student.practice-set-easy.spec.ts --headed --slow-mo=700
```

Ese spec es el mismo arco comercial: invita + padre → activa → ve alumno → asigna EASY → resuelve → progreso tutor.

---

## Acto 1 — La tutora toma el control (2 min)

**Pantalla:** `/login` → `/teacher`

**Qué hacer**

- Entrar como tutora.
- Mostrar la lista de alumnos / espacio de trabajo.

**Qué decir**

> “Esto no es una plataforma pública masiva. Es el panel de la tutora: sus alumnos, sus programas, su seguimiento. Ella decide quién entra.”

**Cierre del acto**

- Botón o acceso a **Invite Student**.

---

## Acto 2 — Alta del alumno y del padre (3 min)

**Pantalla:** `/teacher/students/invite`

**Qué hacer**

1. Elegir programa (si hay uno, ya viene seleccionado).
2. Nombre y email del alumno.
3. Marcar **Student is a minor**.
4. Completar nombre y email del padre/tutor.
5. **Create Invite** → mostrar “Invite created” y el link de activación.

**Qué decir**

> “En un solo paso la tutora incorpora al alumno y deja lista a la familia. No hay registro abierto: es por invitación. El padre queda en la historia desde el día uno.”

**Prueba de valor**

- Acceso controlado.
- Vínculo familiar sin fricción operativa.

---

## Acto 3 — El alumno entra y se hace dueño de su cuenta (2 min)

**Pantalla:** link `/auth/activate?token=…` → `/login` → `/student`

**Qué hacer**

1. Abrir el link (otra ventana / incógnito).
2. Crear contraseña y confirmar.
3. **Activate Account**.
4. Login del alumno → home estudiante.

**Qué decir**

> “El alumno no descarga nada. Activa, entra, y ya está en un entorno listo para practicar. Su progreso se guarda; no depende de un PDF en el chat.”

---

## Acto 4 — La tutora confirma que el alumno ya es “suyo” (1 min)

**Pantalla:** `/teacher` (buscar por nombre) → `/teacher/students/[id]`

**Qué hacer**

- Buscar al alumno recién activado.
- Abrir ficha: email, programa, estado.
- Señalar acciones: Assign, Report, Analytics.

**Qué decir**

> “La tutora no pregunta ‘¿ya entraste?’. Lo ve en su lista. Desde aquí asigna, revisa e informa.”

---

## Acto 5 — Asignación con intención (2 min)

**Pantalla:** `/teacher/students/[id]/assign`

**Qué hacer**

1. Buscar un Practice Set **EASY** real (contenido de ingesta, p. ej. Geometry — Circles — EASY).
2. Seleccionarlo.
3. **Assign**.
4. Confirmar “Assigned successfully”.

**Qué decir**

> “No es ‘aquí tienes un PDF’. Es práctica dirigida: este skill, esta dificultad, este alumno. El contenido viene del material académico cargado y revisado — listo para usar.”

**Nota comercial (si preguntan por origen)**

> “Detrás hay un pipeline de digitalización e ingesta: el banco se construye desde los PDFs de la tutora, se revisa y se publica. Lo que asignamos hoy es contenido real de operación, no un mock.”

---

## Acto 6 — Practicar como en el SAT (3 min)

**Pantalla:** alumno → `/student/practice-sets` → player

**Qué hacer**

1. **Start** en la asignación.
2. Mostrar layout: estímulo / enunciado, opciones A–D, Mark, timer.
3. Responder, pulsar **Next** (barra inferior siempre visible).
4. En la última: **Submit**.
5. Llegar a resultados.

**Qué decir**

> “Una pregunta a la vez, autosave, marcar para revisar, enviar. La barra de navegación queda a la vista: el alumno no se pierde buscando el botón. Al terminar, el intento queda en el historial — inmutable.”

**Detalles que venden**

- Sensación Digital SAT (foco, no formulario eterno).
- Fórmulas e imágenes cuando el ítem lo requiere.
- Resultado inmediato para el alumno.

---

## Acto 7 — La tutora lee el progreso (2 min)

**Pantalla:** `/teacher/students/[id]` → opcional `/report`

**Qué hacer**

1. Volver a la ficha del alumno.
2. Mostrar intentos completados (ya no “No completed attempts”).
3. Abrir **Report** o detalle del intento.
4. (Opcional) Mencionar share a padre / PDF por áreas.

**Qué decir**

> “Aquí se cierra el ciclo: la tutora ve qué se resolvió, cómo fue el desempeño y qué sigue. La familia puede recibir un reporte claro sin meterse al banco completo de preguntas.”

---

## Cierre comercial (1 min)

**Pantalla sugerida:** ficha del alumno con intento + (si hay tiempo) card de padre o mención del portal familia.

**Pitch final**

> “Tres roles, una sola operación: la tutora invita y asigna, el alumno practica como en el SAT, el progreso queda visible. Menos caos de archivos. Más control pedagógico. Listo para un piloto con alumnos reales.”

**Pregunta de cierre**

> “¿Esto se parece a cómo trabaja hoy su tutoría — o a cómo le gustaría trabajarla el próximo ciclo?”

---

## Mapa de beneficios por actor

| Actor | Lo que “compra” en la demo |
|---|---|
| **Tutora** | Control de altas, asignación dirigida, seguimiento sin Excel |
| **Alumno** | Experiencia de práctica seria, progreso que no se pierde |
| **Padre** | Visibilidad del avance sin operar la plataforma completa |
| **Negocio** | Operación privada, contenido real, ciclo demostrable en 15 min |

---

## Versión corta (8 minutos)

| Min | Acto | Acción en pantalla |
|---|---|---|
| 0–1 | Apertura + login tutora | Promesa |
| 1–3 | Invite alumno + padre | Link creado |
| 3–4 | Activate alumno | Portal student |
| 4–5 | Ver alumno + Assign EASY | Asignación OK |
| 5–7 | Player + Submit | Resultados |
| 7–8 | Ficha / reporte tutora | Cierre pitch |

---

## Qué no abrir en la demo comercial (salvo que pregunten)

- Admin SMTP / secretos.
- Wizard de ingesta IA completo (mencionar, no recorrer).
- Full Practice Test módulo a módulo (opcional como “siguiente nivel”).
- Taxonomía interna Topic vs Skill (detalle técnico).

---

## Trazabilidad con pruebas automatizadas

Este guion refleja el comportamiento cubierto por Playwright:

| Paso comercial | Spec / evidencia |
|---|---|
| Login tutora | `e2e/auth.login.spec.ts` |
| Invite + padre → activate → ver alumno → assign EASY → resolver → progreso | `e2e/student.practice-set-easy.spec.ts` |
| Compartir reporte / portal padre (extensión) | `e2e/journey.teacher-student-parent.spec.ts` |

Documentación de ejecución: `e2e/README.md`.  
Guion de validación de usuario (más detallado): `docs/GUION_DEMO_USUARIO_TEACHER_STUDENT_PARENT.md`.

---

*NordAI · Plataforma SAT — guion comercial basado en flujo productivo validado.*
