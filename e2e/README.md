# Pruebas E2E (Playwright)

Automatizan el guion de área usuario **Teacher → Student → Parent** alineado a `docs/GUION_DEMO_USUARIO_TEACHER_STUDENT_PARENT.md`.

## Qué cubre

| Spec | Alcance |
|---|---|
| `e2e/auth.login.spec.ts` | Login teacher/admin + error de credenciales |
| `e2e/student.practice-set-easy.spec.ts` | Flujo incremental: tutor invita alumno+padre → alumno crea password → tutor ve alumno → asigna PS **EASY de ingesta** → alumno resuelve → tutor ve progreso |
| `e2e/journey.teacher-student-parent.spec.ts` | Invitar → activar → asignar PS → practicar/submit → vincular padre → portal padre + enlace `/parent/access` |

Los usuarios de prueba usan emails `e2e.*@example.com` y se limpian al inicio/fin del journey (`e2e/helpers/db.ts`).

## Requisitos

1. Dependencias: `npm install` (incluye `@playwright/test`).
2. Navegador: `npx playwright install chromium` (una vez).
3. Base local con al menos:
   - `teacher@sat.com` / `teacher123`
   - `admin@sat.com` / `admin123`
   - Practice Set publicado *Statistical Claims - EASY* (o override `E2E_PRACTICE_SET_NAME`)
4. `DATABASE_URL` apuntando al mismo `dev.db` que usa Next (default `file:./dev.db`).

SMTP **no** es obligatorio: el share de reporte acepta `SMTP_NOT_CONFIGURED`. El enlace temporal de padre se valida creando el token de forma equivalente en helper (el raw token no vuelve en la API a propósito).

## Cómo correr

```bash
# Levanta Next en :3100 automáticamente y corre todo
npm run test:e2e

# Solo auth
npx playwright test e2e/auth.login.spec.ts

# Solo journey
npx playwright test e2e/journey.teacher-student-parent.spec.ts

# UI mode / headed
npm run test:e2e:ui
npm run test:e2e:headed
```

Apuntar a un server ya levantado:

```bash
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

## Variables opcionales

| Variable | Default |
|---|---|
| `E2E_PORT` | `3100` |
| `E2E_BASE_URL` | `http://127.0.0.1:$E2E_PORT` (si se setea, no arranca webServer) |
| `E2E_TEACHER_EMAIL` / `E2E_TEACHER_PASSWORD` | `teacher@sat.com` / `teacher123` |
| `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` | `admin@sat.com` / `admin123` |
| `E2E_STUDENT_PASSWORD` / `E2E_PARENT_PASSWORD` | `student123` / `parent123` |
| `E2E_PRACTICE_SET_NAME` | Statistical Claims EASY |

## Notas

- `workers: 1` y `fullyParallel: false`: el journey es serial y comparte estado en memoria.
- No forma parte de `npm run quality` (gates estáticos). Añadir a CI cuando el job tenga Chromium + DB seed mínima.
- Tras fallos: `npm run test:e2e:report` abre el HTML en `playwright-report/`.
