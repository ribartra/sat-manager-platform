# Cuentas de demostración

Cuentas **ficticias** creadas para tomar las capturas de los manuales.

- **Solo existen en la copia local** de la base que usan las herramientas de `_tools/` (`$MANUAL_WORK/man.db`). **No existen en producción.**
- Las personas son inventadas y los correos usan el dominio reservado `example.com`, así que nunca llega un correo a nadie.

| Rol | Nombre | Email | Contraseña | Cómo se creó |
|---|---|---|---|---|
| Administrador | Sofía Navarro | sofia.navarro@example.com | `Sofia#Demo2026` | Insertado por `00-setup.cjs` (los admins reales de la copia conservan sus contraseñas; no se usan) |
| Profesor maestro | Mariana Torres | mariana.torres@example.com | `Mariana#Demo2026` | Insertado por `00-setup.cjs` (ninguna pantalla crea al primer profesor) |
| Profesor | Diego Ramírez | diego.ramirez@example.com | `Diego#Demo2026` | Invitado por Mariana y activado (flujo real) |
| Alumna | Lucía Fernández | lucia.fernandez@example.com | `Lucia#Demo2026` | Invitada por Diego, con padre; activada |
| Alumno | Mateo Castillo | mateo.castillo@example.com | `Mateo#Demo2026` | Invitado por Diego; activado |
| Alumna | Valentina Rojas | valentina.rojas@example.com | `Valentina#Demo2026` | Invitada por Diego; activada |
| Madre (padre/apoderado) | Ana Fernández | ana.fernandez@example.com | — (no inicia sesión; recibe enlaces de progreso) | Creada al activar Lucía |

**Actividad simulada:**

- **Lucía:** practica con **Check**, repite un set (intento 1 bajo, intento 2 ≈ 80 %) y entrega un módulo del TEST 1. Diego invalida su intento 1.
- **Mateo:** deja un set a medias (**Save & exit**) y tiene otro vencido.
- **Valentina:** solo tiene tareas pendientes.

**Contenido quitado de la copia** (para la guía de importación):

- El Practice Set *Advanced Math - Nonlinear Functions - HARD*.
- El **TEST 9** (fuente Innovator).

La fuente de verdad de estos datos es [`_tools/config.cjs`](_tools/config.cjs).
