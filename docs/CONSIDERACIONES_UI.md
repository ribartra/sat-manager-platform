# Consideraciones UI — backlog ordenado (propuesta × inventario)

Índice operativo para trabajo de UI. No sustituye la arquitectura completa ni el inventario de pantallas.

| Doc | Rol |
|-----|-----|
| [`propuesta-reformulacion-sat.md`](../propuesta-reformulacion-sat.md) | **TO-BE** — decisiones de arquitectura |
| [`UI_SYSTEM_DESIGN.md`](UI_SYSTEM_DESIGN.md) | **AS-IS** — 63 pantallas, stacks, nav, editores/players |
| [`CONSIDERACIONES_PRODUCTO.md`](CONSIDERACIONES_PRODUCTO.md) | **Backlog de producto** — scoring Practice/Exam, Materials flag, import dual, etc. |
| Este archivo | **Backlog UI** — qué hacer primero en design system / forms / tables / nav |

**Regla de lectura:** cada ítem cita evidencia del inventario (ruta o §) y una decisión de la propuesta. Implementar por **capas**, no pantalla a pantalla.

---

## 0. Principios

1. **No reescribir** la plataforma ni migrar masivamente Radix → Base UI / React Aria.
2. **Paramétrico ≠ form renderer JSON.** Tokens, nav, enums, flags, layouts, columns y assessment capabilities son configuración; la lógica de dominio sigue en componentes/servicios expresivos.
3. **RSC-first.** `"use client"` solo en boundaries interactivas; lecturas de página vía RSC → datos; mutaciones UI → Server Actions; HTTP estable (upload, autosave, jobs, polling) → Route Handlers.
4. **Feature flag ≠ autorización.** Ocultar nav no concede ni retira permisos.
5. Orden de transformación: Foundation DS → layouts → metadata → forms → tables → assessment → superficies selectivas.

---

## 1. Foundation Design System — P0

**Decisión (propuesta):** Tailwind como ejecución de tokens (reference → semantic → component); frontera `SAT *` sobre primitives; shadcn como registry, no como producto.

**Evidencia (inventario §1.4, §5):** utilidades Tailwind locales; `components/ui/*` = wrappers Radix sueltos (button, card, input, select, badge, dialog, …).

**Hacer:**

- Definir tokens estables y mapearlos a `@theme` (sin exigir Style Dictionary el día 1).
- Tratar `components/ui/*` como implementación detrás de la API SAT (Button, Dialog, Select, Tabs, Tooltip, …).
- Primer catálogo obligatorio:

```text
Primitives: Button, IconButton, Input, Textarea, Select, Checkbox, Radio,
            Badge, Dialog, Tabs, Tooltip

Layouts:    PageShell, PageHeader, PageContent

Patterns:   FormField, FormSection, FilterBar, EmptyState, ErrorState,
            LoadingState, SaveIndicator
```

**No hacer:** migración masiva a Base UI; inventar convenciones visuales nuevas fuera del DS.

---

## 2. Layouts, shells y responsive — P0

**Decisión:** mobile-first; breakpoints de viewport para el shell; container queries para patterns; contratos `width` / `density` / `collapse` en shells.

**Evidencia:**

- Portales distintos con chrome distinto (§1.1): Auth, Teacher/Admin (`NavTeacher`), Student, Parent.
- Players (§4.4): Practice usa `100dvh - 3.5rem`; Full Test usa `h-screen`.
- Filtros/tablas con `max-w-*` / grids ad hoc por página (§3).

**Hacer:**

- Unificar chrome vía `AppShell` / `PageShell` consumiendo la misma metadata de nav (ver §3).
- Patterns reutilizables con `@container` (p.ej. MetricGrid, FilterBar).
- Contrato común de viewport para assessment (safe areas, header, teclado móvil) antes de rediseñar pixels del player.

**Estado (layouts de página):** listados y formularios de portal usan `PageShell` (`narrow` / `default` / `wide` / `full` + `comfortable`/`compact`). Excepciones documentadas (wrappers `max-w-*` ad hoc a propósito, ≤5):

1. `/login` y auth centradas (`activate`, `forgot-password`, `reset-password`, `parent-consent`, `pending-validation`)
2. `/parent/access` (one-off de acceso)
3. Players Practice / Full Test (viewport propio; sin PageShell de listado)

Nota: review de archivo AI Import usa `PageShell width="full"` + `className` con `max-w-[100rem]` y grid (ancho excepcional, no wrapper legacy).

---

## 3. Metadata de dominio y navegación — P1 / P2

**Decisión:** enums/labels/config data-driven; nav config-driven por rol/feature; autorización real en servidor.

**Evidencia:**

- Nav hardcodeada en `NavTeacher` / `NavStudent` (§2.1–2.2).
- Seis feature flags que ocultan ítems (§1.2).
- Conteos fijos repetidos (§6): Difficulty, Question Type, statuses, explanation visibility, AI statuses, calculator providers (7), módulos FPT, etc.

**Hacer:**

```ts
// Ejemplo de meta (no contrato final)
questionDifficultyMeta.EASY = { label: "Easy", badge: "success", order: 10 }
navItem = { id, label, href, icon, roles, feature, group }
```

- Teacher desktop, mobile drawer y breadcrumbs consumen la misma metadata.
- Flags vía API única (`featureFlags.isEnabled(key, context)`); metadata owner/expiry; nunca como auth.

**Prioridad:** metadata de enums en P1 (desbloquea forms/tables); nav config-driven en P2.

---

## 4. Forms (RHF + Zod) — P1

**Decisión:** RHF + Zod como único estándar; no TanStack Form; sin form-renderer universal.

**Evidencia (§1.4, §3.1, §4.1–4.3):** deps instaladas casi sin uso; formularios = controlled state + `fetch` a `/api/*`.

**Orden de migración:**

1. Auth (§3.1): login, forgot/reset, activate, change-password, parent-consent. ← **hecho** (`contracts/auth.ts`)
2. Admin: settings, programs, taxonomy ← **hecho** (`contracts/admin.ts`).
3. Dominio: Question / PracticeSet / FullTest ← **hecho** (`contracts/question.ts`, `practice-set.ts`, `full-test.ts`).

**Contrato:** mismo Zod schema en cliente y servidor; `FormField` / `FormSection` del DS; mapping consistente de errores. Editores complejos siguen siendo componentes de dominio.

---

## 5. Tables (DataTable) — P1

**Decisión:** TanStack Table vía `DataTable` común; estrategias responsive explícitas; no “todas las tablas → cards”.

**Evidencia:** HTML `<table>` + Tailwind en admin/teacher (users, teachers, programs, students, QB, practice sets, …); Compare necesita relación columnar (§3).

**Estrategias:** `scroll` | `priority-columns` | `stack` | `card` | `detail-drawer`.

**Migrar primero:**

| Ruta | Notas |
|------|--------|
| `/admin/users` | Account Validation |
| `/admin/teachers` | Toggle enable |
| `/teacher` | Students dashboard |
| `/teacher/questions` | Question Bank |
| `/teacher/practice-sets` | Listado sets |

**Dejar:** tablas triviales como HTML semántico; `/teacher/compare` con estrategia tabular (`scroll` / `priority`), no card.

---

## 6. Assessment Engine y players — P0 (persistencia) / P1 (shell)

**Decisión:** no fusionar players en un monolito de `if`; extraer Assessment Engine + policies; XState para lifecycle; IndexedDB journal; mismos estados de persistencia.

**Evidencia (§4.4):**

| Capacidad | Practice | Full Test |
|-----------|----------|-----------|
| Viewport | `100dvh - 3.5rem` | `h-screen` |
| Mark / eliminate / note / back / map | Sí | No |
| Timer | count-up | countdown módulo |
| Save UI | `SaveIndicator` (Saving… / Saved / Saved locally) | mismo `SaveIndicator` + localStorage offline |

**Secuencia correcta (propuesta):**

```text
Attempt contract → Sync protocol → IndexedDB journal → Assessment machine
  → Shared AssessmentShell → Practice config → Full Test config
```

**Hacer antes de rediseño visual:**

1. Contrato de attempt + sync idempotente (`mutationId`).
2. Journal IndexedDB en **ambas** modalidades.
3. Igualar `SaveIndicator`: Saving… / Saved / Saved locally / Syncing… / Sync problem.
4. Luego `AssessmentShell` + `practicePolicy` / `fullTestPolicy`.

---

## 7. Superficies selectivas (Query, AI Import UI) — P2

**Decisión:** TanStack Query solo donde aporta (polling/live/infinite); no como estándar de lectura.

**Evidencia:** AI Import client-heavy (§3.2 `/admin/import/ai*`); `NotificationBell` con fetch; resto mayormente RSC + Prisma SSR.

**Hecho:**

- Provider: `AppQueryProvider` en root layout (`@tanstack/react-query`).
- Keys: `lib/query-keys.ts`.
- `NotificationBell`: `useQuery` (staleTime 30s, refetchInterval 60s) + `useMutation` mark-read.
- AI Import: `IngestAutoRefresh` polléa `GET /api/admin/ai-import/batches/[batchId]/progress` y hace `router.refresh()` solo cuando cambia el fingerprint.
- UI de AI Import sigue human-in-the-loop (Review/Promote); el procesamiento largo es concern de jobs (fuera de este backlog UI, ver propuesta).
- Resto de vistas: mantener RSC.

---

## 8. Definition of Done (UI)

Ningún primitive/pattern nuevo entra sin:

```text
Keyboard · Focus · Accessible name · SR semantics · Contrast · Zoom
Touch · Reduced motion · Error · Loading · Empty · Responsive (narrow/wide)
```

Target: **WCAG 2.2 AA**. Stories (Storybook) para el catálogo del §1. E2E P0 de players/auth/import viven en el plan de calidad de la propuesta; este doc solo exige no romper smoke UI existente.

---

## 9. Matriz pantalla → patrón (P0 / P1)

Muestra priorizada — no las 63 filas. Detalle AS-IS en el inventario.

| Ruta | Patrón objetivo | Gap inventariado | Fase |
|------|-----------------|------------------|------|
| *(global)* | Tokens + SAT primitives | Tailwind ad hoc; `ui/*` sueltos | Foundation P0 — **tokens + `@theme` en `globals.css`; patterns en `components/sat/*`** |
| *(global)* | `PageShell` / `PageHeader` / `PageContent` | Layout/spacing por página | Layouts P0/P1 — **aplicado en listados/portales**; excepciones auth/players/parent-access (§2) |
| *(global)* | Metadata enums | Labels/options hardcodeados (§6) | Metadata P1 — **`lib/domain-meta.ts` aplicado en filtros/editores/badges** |
| `/parent` | `EmptyState` | Grid vacío sin mensaje (§3.3) | Patterns P1 — **hecho** |
| `/login` + auth | RHF + Zod + FormField | Controlled + fetch (§3.1) | Forms P1 — **hecho** (`contracts/auth.ts`) |
| `/admin/settings` | FormSection + RHF/Zod SMTP+Mistral | Toggles locales; flags≠auth | Forms P1 — **SMTP/Mistral hecho**; flags API P2 — **hecho** |
| `/admin/programs` | RHF + Zod create/edit | Controlled create/edit (§3.2) | Forms P1 — **hecho** (`contracts/admin.ts`) |
| `/admin/taxonomy` | RHF + Zod add node | Controlled create (§3.2) | Forms P1 — **hecho** |
| `/admin/users` | `DataTable` | HTML table (§3.2) | Tables P1 — **hecho** (`AdminUsersTable` + priority) |
| `/admin/teachers` | `DataTable` | HTML table | Tables P1 — **hecho** |
| `/teacher` | `FilterBar` + `DataTable` | Filtros GET + HTML table (§3.4) | Tables P1 — **DataTable hecho** (FilterBar pendiente en form GET) |
| `/teacher/questions` | `DataTable` / FilterBar | HTML table + filters | Tables P1 — **hecho** |
| `/teacher/practice-sets` | `DataTable` | HTML table | Tables P1 — **hecho** |
| `/teacher/full-tests` | Lista aligerada (View/Edit/Delete; 2 indicadores) | Acciones/métricas densas en filas | UX refine — **hecho** (secundarias en detalle) |
| `/teacher/full-tests/[testId]` | Acciones secundarias + métricas | Assign/status solo parcial | UX refine — **hecho** (`FullTestActions` variant=detail) |
| `/teacher/practice-sets` | Edit/Delete en lista; secundarias en editor | Misma densidad de botones que exams | UX refine — **hecho** |
| `/teacher/questions/new` · edit | `FormattedTextField` (toolbar + preview) | Marcadores crudos sin preview live | UX refine — **hecho** |
| Players + `QuestionPlayerPreview` | Ocultar passage vacío | Placeholder “No passage…” | UX refine — **hecho** |
| Parents / Groups / Assign / Analytics | `StudentPicker` unificado | Pickers locales duplicados | UX refine — **hecho** (`components/student-picker.tsx`) |
| `/teacher/questions/new` · edit | RHF + Zod + FormSection | QuestionEditor controlled (§4.1) | Forms P1 — **hecho** (`contracts/question.ts`) |
| `/teacher/practice-sets/new` · edit | RHF + Zod | PracticeSetEditor (§4.2) | Forms P1 — **hecho** (`contracts/practice-set.ts`) |
| `/teacher/full-tests/new` · edit | RHF + Zod | FullTestEditor (§4.3) | Forms P1 — **hecho** (`contracts/full-test.ts`) |
| `/student/practice/assignment/[id]` | AssessmentShell + journal + SaveIndicator | Offline save OK; viewport propio (§4.4) | Assessment P0 — **SaveIndicator unificado (“Saved locally”)** (IndexedDB pendiente) |
| `/student/full-tests/[assignmentId]` | Misma shell/policy distinta | Sin offline UI; `h-screen` (§4.4) | Assessment P0 — **SaveIndicator + localStorage offline** (IndexedDB pendiente) |
| `/admin/import/ai*` | Query polling + patterns DS | Client-heavy ad hoc (§3.2) | Selectivo P2 — **hecho** (`IngestAutoRefresh` + progress API) |
| `NavTeacher` / `NavStudent` | Nav config-driven | Links/flags hardcodeados (§2) | Metadata P2 — **hecho** (`lib/nav-config.ts`) |
| Admin chrome | Un Programs / Taxonomy | Programs ×2 + Subskills vs Taxonomy | Dedup — **hecho** (`hideForAdmin` Programs/Subskills; Admin ▾ **Program master**; redirect `/teacher/programs` → `/admin/programs`) |

---

## Orden de ejecución sugerido

```text
1. Tokens + primitives SAT + PageShell/Empty/Loading/Error/SaveIndicator  ← hecho (components/sat + globals @theme)
2. Assessment persistence parity (SaveIndicator + offline local en ambos players) ← hecho parcial; IndexedDB journal pendiente
3. Metadata enums (Difficulty, types, statuses, …) ← hecho (`lib/domain-meta.ts`)
4. DataTable en 5 listados P1 ← hecho (`components/sat/data-table` + wrappers)
5. Forms auth → admin → editores de dominio ← **Forms P1 cerrado**
6. Nav config-driven + flags API ← **hecho** (`lib/nav-config.ts`, `lib/feature-flags.ts`)
7. AI Import / NotificationBell con Query selectivo ← **hecho**
8. PageShell en pantallas de portal (márgenes/ancho) ← **hecho** (excepciones §2)
9. UX refine: exams lista/detalle, FormattedTextField, empty passage, StudentPicker ← **hecho**
10. Admin nav dedup (Program master; hide teacher Programs/Subskills; redirect) ← **hecho**
```

Cuando una capa se complete, actualizar el inventario (§ stack de la vista) y tachar filas de la matriz §9 aquí.
