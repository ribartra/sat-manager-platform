# Arquitectura objetivo para una plataforma SAT integral, paramétrica y estandarizada

> **Navegación de documentos**
>
> | Doc | Rol |
> |-----|-----|
> | Este archivo | **TO-BE** — arquitectura objetivo completa (decisiones) |
> | [`docs/UI_SYSTEM_DESIGN.md`](docs/UI_SYSTEM_DESIGN.md) | **AS-IS** — inventario factual de 63 pantallas / stacks / nav |
> | [`docs/CONSIDERACIONES_UI.md`](docs/CONSIDERACIONES_UI.md) | **Backlog UI ordenado** — prioridades por capa (propuesta × inventario) |
> | [`docs/CONSIDERACIONES_PRODUCTO.md`](docs/CONSIDERACIONES_PRODUCTO.md) | **Backlog de producto** — acuerdos funcionales (scoring, Materials, import dual, …) |
>
> No reescribe el producto: formaliza capas sobre el stack actual. Para trabajo UI, empezar por CONSIDERACIONES_UI; para requisitos de negocio acordados, ver CONSIDERACIONES_PRODUCTO.


La plataforma ya tiene una base moderna y aprovechable: **Next.js 16 App Router, React 19, Tailwind CSS v4, Radix a través de `components/ui/*`, Prisma + `better-sqlite3`, NextAuth v5, KaTeX y múltiples Client Components que mutan mediante `/api/*`**. El problema principal no es de elección de framework, sino de **formalización arquitectónica**: hay 63 pantallas, varios portales por rol, seis feature flags, numerosos formularios controlados manualmente, muchas tablas HTML, dos players con lógica paralela y un flujo de AI Import suficientemente complejo como para requerir una arquitectura durable.

La recomendación central de esta investigación es **no reescribir la plataforma ni reemplazar indiscriminadamente las tecnologías actuales**. El camino de menor riesgo y mayor retorno es convertir el stack existente en una arquitectura explícita con seis capas bien gobernadas:

```text
SAT Platform
│
├── Experience Layer
│   ├── Next.js App Router / RSC
│   ├── Portal Shells
│   ├── Responsive Layout System
│   └── Assessment Shell
│
├── SAT Design System
│   ├── Design Tokens
│   ├── Tailwind v4
│   ├── Radix-based primitives
│   ├── Components
│   └── Patterns
│
├── Application Layer
│   ├── Forms
│   ├── Tables
│   ├── Feature policies
│   ├── Assessment state machines
│   └── AI workflows
│
├── Domain / Security Layer
│   ├── DAL
│   ├── Authorization Policies
│   ├── Zod contracts
│   ├── Services
│   └── Audit
│
├── Data / Async Layer
│   ├── PostgreSQL
│   ├── Prisma
│   ├── IndexedDB
│   └── Durable background jobs
│
└── Platform Engineering
    ├── Testing
    ├── Accessibility
    ├── OpenTelemetry
    ├── Security
    └── CI quality gates
```

## Arquitectura técnica objetivo

La primera decisión debe ser **RSC-first**, no “Client Component por defecto”. Next.js establece que páginas y layouts del App Router son Server Components por defecto y recomienda reservar Client Components para estado interactivo, eventos, efectos y APIs del navegador. Además, Server Components pueden acceder directamente al origen de datos sin crear un endpoint HTTP intermedio.

Esto encaja especialmente bien con SAT, porque una gran proporción de las pantallas actuales ya son RSC con Prisma SSR, mientras que editores, acciones y players están encapsulados como hijos cliente.

**Arquitectura propuesta:**

```text
page.tsx / layout.tsx
        │
        ▼
React Server Component
        │
        ▼
Application Query / DAL
        │
        ├────────► Authorization Policy
        │
        ▼
     Prisma
        │
        ▼
  PostgreSQL
```

Para mutaciones:

```text
Client Component
      │
      ├── Server Action
      │      └── UI-owned mutation
      │
      └── Route Handler
             ├── API / polling
             ├── upload
             ├── offline sync
             ├── webhook
             └── background-job control
```

**Qué hacer con Server Actions.** Deben utilizarse principalmente para mutaciones originadas por la propia UI: crear/editar preguntas, assignments, settings, grupos, programas, etc. Next.js declara expresamente que el propósito principal de Server Actions son las mutaciones y que son operaciones encoladas; usarlas como mecanismo general de lectura puede serializar solicitudes. TanStack Query también desaconseja utilizar Server Actions como `queryFn` por esa razón.

**Qué mantener como Route Handler.** Uploads, endpoints que deben ser consumibles por más de un cliente, sincronización offline, polling/realtime, webhooks, integraciones, AI jobs y cualquier contrato HTTP que deba existir independientemente de una página concreta deben permanecer como Route Handlers. Next.js define Route Handlers como la superficie HTTP del App Router.

No conviene, por tanto, migrar mecánicamente todos los `/api/*` actuales a Server Actions. Se debe clasificarlos.

| Tipo de operación SAT | Arquitectura objetivo |
|---|---|
| Carga inicial de Students, Questions, Programs | RSC → DAL → Prisma |
| Crear/editar una pregunta | Server Action → service → Prisma |
| Publicar/archivar pregunta | Server Action |
| Avatar/media upload | Route Handler |
| Autosave assessment | Route Handler |
| Offline synchronization | Route Handler |
| AI Import start/process/recover | Event/job command |
| AI job status | Route Handler + TanStack Query |
| Webhook externo | Route Handler |
| Parent token access | RSC/DAL + policy específica |
| API futura para aplicación móvil | Route Handlers + OpenAPI |

La siguiente pieza necesaria es un **Data Access Layer explícito**. Next.js recomienda centralizar accesos y autorización en un DAL y construir DTOs específicos en lugar de dispersar checks entre layouts, páginas y componentes. También advierte que ocultar UI en un layout no constituye autorización y que cada Server Action o Route Handler debe aplicar sus propios controles.

La arquitectura del repositorio debería converger hacia algo equivalente a:

```text
src/
├── app/
├── features/
│   ├── questions/
│   ├── students/
│   ├── programs/
│   ├── assessments/
│   └── ai-import/
│
├── domain/
│   ├── assessment/
│   ├── question/
│   ├── program/
│   └── permissions/
│
├── server/
│   ├── dal/
│   ├── services/
│   ├── policies/
│   ├── jobs/
│   └── db/
│
├── contracts/
│   ├── questions/
│   ├── assessments/
│   └── imports/
│
├── design-system/
│   ├── tokens/
│   ├── primitives/
│   ├── components/
│   ├── patterns/
│   └── layouts/
│
└── config/
    ├── navigation/
    ├── features/
    └── assessment/
```

**No se recomienda una arquitectura genérica basada en repositorios para absolutamente todo.** Prisma ya entrega acceso tipado y su documentación recomienda evitar problemas como N+1, sobre-fetching y múltiples instancias de `PrismaClient`; la capa DAL debe existir donde aporta seguridad, encapsulación o reglas de negocio, no simplemente para envolver cada llamada Prisma con otro método idéntico.

En caching, Next.js 16 dispone de `use cache`, Cache Components e invalidación explícita. La recomendación para SAT es cachear **datos de referencia relativamente estables** —taxonomía publicada, ciertas configuraciones globales, catálogo de calculator providers— y no introducir caching agresivo en assessment attempts, permisos o información personal. Para mutaciones que requieren consistencia inmediata, Next.js ofrece `updateTag`; para stale-while-revalidate puede utilizarse `revalidateTag`.

### Server state: RSC primero, TanStack Query sólo donde aporta valor

No se recomienda convertir SAT completo a TanStack Query.

Para la mayoría de las 63 vistas:

```text
RSC
 ↓
DAL
 ↓
DB
```

es más simple que:

```text
RSC
 ↓
Hydrate QueryClient
 ↓
Client Query
 ↓
API
 ↓
DB
```

Next.js señala que Server Components cubren la mayoría de las necesidades de lectura y que librerías como React Query tienen sentido especialmente cuando la información depende de APIs del navegador o necesita polling frecuente.

**TanStack Query sí debe introducirse de forma selectiva en:**

- AI Import para progreso y polling;
- NotificationBell si necesita actualización continua;
- listas infinitas o tablas altamente interactivas;
- superficies que requieren background refetch;
- posiblemente sincronización del player, aunque el journal offline debe ser independiente de Query.

TanStack Query es compatible con RSC, streaming, prefetch y hydration en App Router, pero su documentación advierte que hay que diseñar explícitamente ownership, hydration y `staleTime`; por defecto una query se considera stale y puede refetchear al montar, recuperar foco o reconectar.

**Decisión:** no instalarlo como “nuevo estándar para todas las lecturas”. Usarlo como **client server-state layer especializada**.

### Autenticación, autorización y RBAC

NextAuth/Auth.js debe seguir siendo el mecanismo de **authentication/session**, pero dejar de ser la ubicación conceptual de toda autorización. Auth.js continúa proporcionando la integración con Next.js, mientras que Next.js recomienda aplicar autorización cerca de los datos y volver a comprobarla en cada superficie servidor.

La plataforma necesita evolucionar de RBAC simple:

```text
ADMIN
TEACHER
STUDENT
PARENT
```

a:

```text
Authentication
      +
RBAC
      +
Resource policy / ABAC
```

Ejemplos:

```ts
can(user, "question:update", question)

can(teacher, "student:view", student)

can(parent, "student:report:view", student)

can(student, "attempt:update", attempt)

can(admin, "aiImport:promote", candidate)
```

De esta forma, `TEACHER` no significa automáticamente “puede ver cualquier Student”; además deben verificarse programa, enrollment, ownership o relación correspondiente. Esto reduce el riesgo de IDOR, que OWASP define precisamente como acceder a recursos identificables sin comprobar autorización sobre ese objeto concreto.

El **Teacher → Student impersonation** merece una policy independiente con auditoría obligatoria, expiración, actor original y usuario efectivo. No debe implementarse simplemente reemplazando el rol.

### Feature flags

Los seis flags actuales ya son suficientes para justificar una interfaz estándar.

Se recomienda:

```ts
featureFlags.isEnabled(
  "teacher.groups",
  context
)
```

y no:

```ts
if (settings.teacherGroupManagement)...
```

disperso por el código.

**OpenFeature** ofrece una especificación vendor-neutral para desacoplar la aplicación del backend que almacena/evalúa flags, pudiendo utilizar inicialmente el sistema actual de AppSettings como provider y cambiar de servicio más adelante sin cambiar las llamadas del producto.

Cada flag debería tener metadata:

```ts
{
  key,
  description,
  owner,
  type,
  defaultValue,
  environments,
  createdAt,
  expiresAt,
  removalIssue
}
```

Una regla importante: **feature flag ≠ authorization**. Que un flag oculte “Groups” no debe conceder ni retirar permisos de seguridad; la policy del servidor sigue siendo la autoridad.

## Design System, responsive y parametrización

La transformación más importante para conseguir una plataforma verdaderamente paramétrica es dejar de utilizar Tailwind como un conjunto de valores visuales locales y convertirlo en la **capa de ejecución de un Design System**.

Tailwind CSS v4 está particularmente preparado para ello: sus `@theme` variables actúan como design tokens y generan tanto variables CSS como utilities, y dispone de container queries de primera clase.

Además, desde octubre de 2025 existe una primera versión estable de la especificación del **Design Tokens Community Group, 2025.10**, orientada precisamente a interoperabilidad, theming, aliases, tokens semánticos y múltiples plataformas.

La arquitectura debe tener tres niveles:

```text
Reference / primitive tokens
             │
             ▼
      Semantic tokens
             │
             ▼
       Component tokens
```

Ejemplo:

```text
Primitive
blue.600

      ↓

Semantic
color.action.primary
color.status.info
color.text.default
color.surface.default

      ↓

Component
button.primary.background
badge.info.background
navigation.active.background
```

El feature code no debería conocer:

```tsx
bg-blue-600
text-slate-700
border-gray-200
```

como decisiones de producto.

Debería consumir:

```tsx
bg-primary
text-foreground
border-border
```

o variantes del componente:

```tsx
<Button intent="primary" />
<Badge status="success" />
```

### Arquitectura propuesta para tokens

```text
design-system/
└── tokens/
    ├── reference.tokens.json
    ├── semantic.tokens.json
    ├── component.tokens.json
    └── themes/
        ├── default.tokens.json
        ├── dark.tokens.json
        └── high-contrast.tokens.json
```

Y posteriormente generar/mapear:

```text
DTCG tokens
    ↓
CSS custom properties
    ↓
Tailwind @theme / @theme inline
    ↓
SAT UI components
```

No es obligatorio introducir inmediatamente un pipeline complejo como Style Dictionary. Lo importante primero es que los **nombres y relaciones sean estables**.

### Componentes: qué hacer con Radix, shadcn, Base UI y React Aria

Aquí hay una conclusión importante de la investigación actual.

En julio de 2026, shadcn convirtió **Base UI en el default para proyectos nuevos** y añadió React Aria como base de primera clase. Sin embargo, la propia documentación de shadcn señala explícitamente que **Radix sigue soportado y que los proyectos existentes que funcionan no tienen por qué migrar**.

Por tanto, para SAT:

**No hacer una migración masiva Radix → Base UI.**

El proyecto ya utiliza Radix y sus wrappers, y Radix continúa siguiendo patrones WAI-ARIA, gestionando keyboard navigation y focus para primitives complejos.

La arquitectura correcta es colocar una frontera propia:

```text
SAT application
      │
      ▼
SAT Design System API
      │
      ├── Button
      ├── Dialog
      ├── Select
      ├── Tabs
      ├── Tooltip
      └──...
      │
      ▼
Primitive implementation
      │
      └── Radix hoy
```

Así, la aplicación **no depende conceptualmente de Radix**. Depende de `SAT Dialog`, `SAT Select`, etc.

Base UI se puede probar posteriormente detrás de esa frontera. Base UI es también headless, accesible y composable, y su equipo declara conformidad con patrones APG y comportamiento relevante de WCAG 2.2.

React Aria debe reservarse inicialmente para componentes donde su sofisticación aporte una ventaja real —collections complejas, tablas interactivas, tree, drag/drop o necesidades avanzadas de accesibilidad— y no introducirse junto a Radix indiscriminadamente. shadcn ya puede generar componentes basados en Aria, Base UI o Radix, por lo que en el futuro el SAT Design System podrá comparar implementaciones sin cambiar la API de producto.

**shadcn debe entenderse como fuente/registry de código controlado por SAT**, no como sustituto del Design System. La plataforma debe ser propietaria de los wrappers, variantes, tokens y comportamiento.

### Capas del Design System

```text
design-system/
│
├── tokens/
│
├── primitives/
│   ├── Button
│   ├── Input
│   ├── Select
│   ├── Checkbox
│   ├── Dialog
│   ├── Tabs
│   └── Tooltip
│
├── components/
│   ├── StatusBadge
│   ├── SearchField
│   ├── MetricCard
│   ├── EmptyState
│   ├── DataTable
│   └── FormField
│
├── patterns/
│   ├── FilterBar
│   ├── EntityHeader
│   ├── FormSection
│   ├── DataView
│   └── EditorShell
│
└── layouts/
    ├── AppShell
    ├── PageShell
    ├── PageHeader
    ├── PageContent
    ├── SplitView
    └── AssessmentShell
```

Eso evita que las 63 pantallas implementen de forma diferente spacing, max-width, filters, tables, loading, empty states y acciones.

### Responsive: pasar de breakpoints por página a responsive por componente

El modelo debe ser **mobile first**, utilizando viewport breakpoints para cambios del shell y **container queries para componentes reutilizables**. Tailwind permite ambos modelos de forma nativa.

Ejemplo:

```tsx
<PageContent>
  <div className="@container">
    <MetricGrid />
  </div>
</PageContent>
```

`MetricGrid` decide su presentación en función del espacio que realmente recibe, no suponiendo que `lg` siempre significa que está en una página ancha.

Los componentes deben recibir contratos como:

```tsx
<PageShell width="wide">
<PageHeader density="comfortable">
<DataTable density="compact">
<FilterBar collapse="auto">
<EditorShell preview="aside">
```

en vez de configurar cada pantalla con combinaciones arbitrarias de `max-w-*`, `px-*`, `grid-cols-*`.

Los players merecen una normalización inmediata: el inventario registra `100dvh - 3.5rem` en Practice y `h-screen` en Full Test.  El contrato común debería usar viewport units modernas y administrar explícitamente header, keyboard móvil y safe areas.

### Responsive Tables

No debe establecerse una regla universal “todas las tablas se convierten en cards en mobile”.

TanStack Table es headless y permite controlar completamente markup, sorting, pagination, filtering y visibility. Su documentación recomienda server-side pagination cuando el dataset completo resulta demasiado costoso de transportar al navegador y virtualization sólo cuando existen cantidades realmente grandes de filas/columnas.

La plataforma debería tener:

```tsx
<DataTable
  columns={studentColumns}
  data={data}
  pagination="server"
  responsiveStrategy="priority"
/>
```

y varias estrategias explícitas:

```text
scroll
priority-columns
stack
card
detail-drawer
```

Una tabla de comparación —por ejemplo `/teacher/compare`— debe mantener estructura tabular porque la relación entre columnas importa. Un listado de Accounts podría transformarse en cards en espacios estrechos. Esto debe declararse en metadata del componente y no decidirse ad hoc dentro de cada página.

### Formularios: RHF + Zod como estándar

La plataforma ya tiene **React Hook Form y Zod instalados, pero casi sin uso**, mientras los editores y formularios utilizan predominantemente controlled state manual.

La decisión recomendada es:

**Estandarizar React Hook Form + Zod y no introducir TanStack Form como segunda solución general.**

Zod 4 es una librería TypeScript-first estable y permite metadata/registries útiles para documentación y generación controlada de formularios; React Hook Form dispone de integración con Zod mediante resolvers.

TanStack Form es una opción moderna muy potente, con subscriptions granulares, validación sync/async y composición tipada, pero introducirla ahora crearía dos paradigmas de forms para resolver un problema que RHF + Zod ya puede cubrir.

El contrato debe ser:

```text
Zod Schema
    │
    ├── Server validation
    │
    ├── Client validation
    │
    └── TypeScript inference
    │
    ▼
React Hook Form
    │
    ▼
SAT Form Components
```

Por ejemplo:

```ts
const QuestionSchema = z.discriminatedUnion("type", [
  MultipleChoiceQuestionSchema,
  NumericQuestionSchema,
]);
```

Eso elimina estados imposibles y permite que cliente y servidor utilicen el mismo contrato.

No se recomienda construir un “form renderer universal” que genere todos los formularios desde JSON. La parametrización debe utilizar metadata en patrones repetitivos —labels, enum selects, filters—, pero un `QuestionEditor` complejo debe continuar siendo un componente específico de dominio.

## Assessment Engine, offline y resiliencia

Este es probablemente el subsistema donde la estandarización tendrá mayor impacto operativo.

Actualmente existen `PracticeSetPlayer` y `FullTestPlayer` con muchas capacidades conceptualmente relacionadas pero implementadas de forma distinta: timers diferentes, navegación distinta, mark/eliminate/note sólo en Practice, módulos y break sólo en Full Test y soporte explícito de `"Saved offline"` únicamente en Practice.

La recomendación es **no intentar fusionar ambas pantallas en un componente gigante lleno de `if`**. Se debe extraer un **Assessment Engine** y parametrizar capacidades.

```text
Assessment Engine
│
├── attempt lifecycle
├── question navigation
├── answer state
├── timer
├── persistence
├── offline journal
├── submission
├── module/break control
└── recovery
       │
       ├──────── Practice configuration
       │
       └──────── Full SAT configuration
```

La configuración podría adoptar una forma parecida a:

```ts
const practicePolicy = {
  navigation: {
    allowBack: true,
    allowJump: true,
  },
  tools: {
    markForReview: true,
    eliminateChoices: true,
    notes: true,
  },
  timing: {
    mode: "elapsed",
  },
};

const fullTestPolicy = {
  navigation: {
    allowBack: false,
    allowJump: false,
  },
  tools: {
    markForReview: false,
    eliminateChoices: false,
    notes: false,
  },
  timing: {
    mode: "module-countdown",
  },
};
```

### XState como motor de lifecycle, no como store global

XState v5 está diseñado para modelar lógica compleja mediante state machines/actors y permite persistir snapshots para recuperar workflows.

Esto encaja de manera natural con estados como:

```text
loading
   ↓
ready
   ↓
answering
   ↓
saving
   ├── saved
   └── local_only
          ↓
        syncing

module_complete
   ↓
break
   ↓
next_module

submitting
   ↓
submitted
```

El beneficio principal no es “tener otro state manager”. Es convertir reglas que hoy están implícitas en handlers y booleanos en **transiciones formalmente válidas**.

XState debería utilizarse para:

- Assessment Engine;
- module/break lifecycle;
- autosave orchestration;
- AI Import UI workflow cuando el estado local sea complejo.

No debería sustituir React state para un modal sencillo ni TanStack Query para datos remotos.

### Offline: IndexedDB como journal, no `localStorage`

IndexedDB fue diseñado para almacenar cantidades significativas de objetos y satisfacer necesidades de almacenamiento offline mediante una base transaccional en navegador. Service Workers permiten además interceptar requests y crear aplicaciones offline-enabled.

Para SAT, el patrón robusto es:

```text
Student answers question
        │
        ▼
Update UI immediately
        │
        ▼
Write event to IndexedDB
        │
        ▼
Sync Queue
    │       │
 online   offline
    │       │
    ▼       └── keep locally
Server API
    │
    ▼
ACK revision
    │
    ▼
Mark local event synced
```

Cada operación de autosave debería tener como mínimo:

```ts
{
  attemptId,
  questionId,
  mutationId,
  sequence,
  answer,
  clientTimestamp
}
```

El servidor debe ser idempotente:

```text
same mutationId
       ↓
same logical result
```

Esto evita respuestas duplicadas si el navegador reintenta después de no recibir un ACK.

La UI de ambos players debería tener los mismos estados de persistencia:

```text
Saving…
Saved
Saved locally
Syncing…
Sync problem
```

El estado actual de Full Test, que no ofrece la misma señal offline que Practice, debería corregirse.

**El Service Worker no debe convertirse en la única garantía de guardado.** El journal en IndexedDB debe ser la fuente local de recuperación; sincronizar desde `online`, `visibilitychange`, reanudación del player y otros eventos es una capa adicional.

Para el timer de un examen real, el navegador tampoco debe ser la autoridad final. Debe guardar una referencia de tiempo/deadline emitida por servidor y el servidor debe validar los transitions de módulos y submit. El reloj cliente es una representación visual y no un mecanismo de seguridad.

### Separar UI state, server state y durable state

La plataforma debe imponer esta distinción:

| Tipo | Tecnología objetivo |
|---|---|
| Abrir/cerrar dialog | React state |
| Form values | React Hook Form |
| URL filters | `searchParams` |
| Datos de página | RSC |
| Live/polling server state | TanStack Query |
| Assessment lifecycle | XState |
| Offline attempt journal | IndexedDB |
| Persistencia de negocio | PostgreSQL |
| AI workflow | Durable job engine |

Esto evita introducir Redux/Zustand globalmente sin una necesidad real.

## Data, contratos, AI Import y procesamiento asíncrono

El inventario actual indica **Prisma + `better-sqlite3`**.  Esa combinación es excelente para desarrollo local, prototipos o una instancia de baja concurrencia, pero no debería ser la arquitectura objetivo de una plataforma SAT multiusuario.

SQLite documenta que sólo un writer puede escribir simultáneamente por database file y recomienda motores client/server cuando existen muchos concurrent writers.

**Decisión: PostgreSQL para producción; SQLite puede permanecer para desarrollo/testing donde resulte útil.**

Prisma debe mantenerse. No hay una razón arquitectónica suficiente para migrar ahora a Drizzle u otro ORM. Prisma ofrece acceso tipado, migrations y transacciones; su documentación también recomienda una única instancia de PrismaClient, pooling adecuado y evitar N+1/over-fetching.

A agosto de 2026, Prisma ORM 7 es la versión GA documentada, mientras Prisma 8 continúa como siguiente versión/RC; antes de migrar hay que verificar qué versión utiliza realmente el repositorio y actualizar sólo a una versión GA soportada.

### PostgreSQL target

```text
Next.js
   │
   ▼
DAL / Services
   │
   ▼
Prisma Client
   │
   ▼
Connection Pool
   │
   ▼
PostgreSQL
```

Para entornos de alta concurrencia/serverless, Prisma documenta pooling y recomienda reutilizar conexiones; Prisma Postgres incluye PgBouncer gestionado, aunque un PostgreSQL administrado de otro proveedor con pooling adecuado también es una opción válida.

Las migraciones deben utilizar conexión directa cuando el pooler transaccional no sea apropiado, mientras el tráfico normal usa conexiones pooled.

Las operaciones que deban ser atómicas —por ejemplo submit del attempt + cálculo de estado + cierre del assignment— deben utilizar transacciones breves. Prisma advierte que mantener interactive transactions abiertas durante operaciones de red o procesos lentos puede perjudicar performance y provocar deadlocks.

### Contratos: Zod dentro; OpenAPI en las fronteras HTTP

No se debe utilizar directamente un model Prisma como “contrato del frontend”.

La arquitectura debería ser:

```text
DB Model
  ↓
DAL
  ↓
Domain / DTO
  ↓
Zod contract
  ↓
RSC | Action | Route Handler
```

Zod permite utilizar un schema como validación runtime y fuente de inferencia TypeScript.

Para APIs HTTP de larga vida, integraciones, webhooks o futuros consumidores externos, adoptar **OpenAPI**. OpenAPI es una especificación estándar e independiente del lenguaje para describir HTTP APIs y puede alimentar documentación, generación de clientes y testing. La versión publicada más reciente de la especificación es OpenAPI 3.2.0.

No hace falta generar OpenAPI para cada función interna del RSC. Debe reservarse para las **fronteras HTTP reales**.

Un modelo estándar de errores evita que cada `/api` invente su propio formato:

```ts
type ApiError = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  requestId: string;
};
```

### AI Import debe salir del request/response

El workflow actual tiene:

```text
Load → Process → Recover → Review → Promote
```

junto con estados de archivos, candidatos, OCR, crop, merge y revisión humana.

Ese proceso **no debe depender de un Route Handler largo**. Next.js advierte que, dependiendo del deployment, Route Handlers pueden ejecutarse como funciones con timeout y que handlers de larga duración pueden terminar prematuramente.

La arquitectura objetivo debe ser:

```text
Browser
   │
   │ Start import
   ▼
Route Handler
   │
   │ emit event
   ▼
Durable Job Engine
   │
   ├── Validate file
   ├── Extract
   ├── OCR
   ├── Classify
   ├── Parse questions
   ├── Validate schemas
   ├── Stage candidates
   └── Await human review
            │
            ▼
         Promote
            │
            ▼
        PostgreSQL
```

Para el stack actual, **Inngest es una opción razonable como default de investigación/implantación** porque dispone de integración Next.js, durable functions, checkpoints por step, retries, persistencia de estado, concurrency y rate limiting sin obligar a construir la infraestructura de queue desde cero.

Cada step debe ser pequeño e idempotente:

```text
file.validate
file.extract
page.render
page.ocr
candidate.extract
candidate.validate
candidate.stage
candidate.review
candidate.promote
```

y no:

```text
processEntireSATPdf()
```

como una operación monolítica.

Cada step durable puede ser reintentado independientemente sin repetir los anteriores que ya concluyeron.

Para procesos especialmente pesados —PDF rendering, OCR o procesamiento de imágenes— conviene mantener el orchestration en el durable workflow y ejecutar el compute en workers apropiados, no dentro del proceso web de Next.js.

El frontend puede comenzar con **TanStack Query polling** del status del batch. No es obligatorio introducir WebSockets desde el primer día.

### AI outputs siempre son datos no confiables

El flujo de AI no debe permitir:

```text
LLM output
    ↓
production Question Bank
```

Debe ser:

```text
Model output
     ↓
Zod validation
     ↓
staging
     ↓
quality checks
     ↓
human review
     ↓
explicit promotion
```

Esto ya coincide en parte con el workflow humano que muestra la UI actual y debe convertirse en una propiedad arquitectónica del backend.

OWASP publicó AISVS 1.0 en junio de 2026 como catálogo verificable de requisitos de seguridad para sistemas habilitados por AI; SAT debería incorporarlo a su threat model del importador, además de ASVS para la aplicación web.

Los uploads también necesitan allowlist real de formatos/MIME, límite de tamaño, nombres generados por servidor, almacenamiento aislado y validación del contenido. OWASP recomienda no confiar en extensión/header y, para imágenes, verificar y reescribir el contenido cuando corresponda.

## Accesibilidad, calidad, observabilidad y seguridad

El Design System debe definir **WCAG 2.2 AA como requisito**, no como mejora posterior.

WCAG 2.2 es una recomendación W3C y añadió, entre otros criterios, requisitos sobre foco no oculto, dragging alternatives, tamaño mínimo de targets y autenticación accesible. W3C recomienda 2.2 como objetivo para trabajos nuevos o actualizados.

Para SAT esto afecta especialmente:

- players;
- timer;
- question navigation;
- dialogs;
- tablas;
- filtros;
- math content;
- calculator panel;
- review screens;
- drag/reorder en editores;
- mensajes Saving/Saved;
- authentication.

Los patrones interactivos deben seguir WAI-ARIA APG para focus, keyboard, names/descriptions, dialogs, tabs, grids y similares.

No basta con que Radix sea accesible: la propia documentación de Radix señala que la aplicación sigue siendo responsable de proporcionar labels y contexto correctos.

Un componente SAT no debería considerarse “Done” sin:

```text
Keyboard
Focus
Accessible name
Screen reader semantics
Contrast
Zoom
Touch
Reduced motion
Error state
Loading state
Empty state
Responsive state
```

El Parent portal sin empty state cuando no existen children es un ejemplo concreto de una inconsistencia que la capa de patrones debería eliminar.

### Testing target

La arquitectura recomendada es complementaria:

```text
Type checks
   ↓
Unit tests
   ↓
Component tests
   ↓
Accessibility tests
   ↓
Visual regression
   ↓
Integration tests
   ↓
Playwright E2E
```

**Storybook** debe convertirse en el catálogo ejecutable del Design System. Su addon oficial de accesibilidad utiliza axe-core y puede integrarse con las pruebas de componentes; sus visual tests comparan stories con snapshots de referencia.

Debe cubrir como mínimo:

```text
Button
Input
Select
Dialog
Tabs
Badge
DataTable
FilterBar
EmptyState
PageHeader
Question rendering
Question answer
Assessment navigation
Timer
SaveIndicator
```

cada uno en:

```text
default
hover
focus
disabled
loading
error
empty
mobile
tablet/narrow
desktop/wide
```

**Playwright** debe cubrir workflows completos. Su soporte de screenshots permite visual comparisons, y puede ejecutar axe para accesibilidad dentro de escenarios reales; Playwright enfatiza que los scanners automáticos no detectan todos los problemas, por lo que deben complementarse con pruebas manuales.

Los E2E P0 deberían ser:

```text
Student login → start practice → answer → reconnect → submit
Student exam → module → break → next module → submit
Teacher → create question → publish → assign
Admin → import file → process → review → promote
Parent → access report
Teacher → impersonate student → exit
```

### Observabilidad

Next.js soporta OpenTelemetry de forma nativa y recomienda OTel para instrumentación.

Debe crearse `instrumentation.ts` y propagar correlation/trace IDs:

```text
Browser interaction
      │
      ▼
Next.js request
      │
      ▼
Server Action / Route Handler
      │
      ▼
Service / DAL
      │
      ▼
Prisma
      │
      ▼
PostgreSQL
```

y, para AI:

```text
request
  ↓
job
  ↓
file
  ↓
step
  ↓
model/OCR
  ↓
DB
```

OpenTelemetry es vendor-neutral, por lo que la plataforma puede cambiar posteriormente de backend de observabilidad sin cambiar la instrumentación conceptual.

Métricas específicas de SAT:

| Área | Métrica |
|---|---|
| Web | request latency p50/p95/p99 |
| RSC | render/data latency |
| Prisma | DB query duration |
| Assessment | autosave ACK latency |
| Assessment | local-only events |
| Assessment | sync retry rate |
| Assessment | submit failures |
| AI Import | duration por step |
| AI Import | retries |
| AI Import | candidates requiring manual review |
| Security | auth failures / denied policies |
| Frontend | JS errors / Web Vitals |
| Quality | a11y violations / visual diffs |

El `Audit Log` existente debe seguir siendo un registro de acciones de negocio/seguridad; no debería sustituir tracing ni logging operacional.

### Seguridad

**OWASP ASVS 5.0**, publicado en mayo de 2025, debe convertirse en baseline verificable del programa AppSec.

Las prioridades particulares para SAT son:

```text
Authentication/session
Authorization / IDOR
Student data isolation
Parent tokens
Impersonation
CSRF
XSS
CSP
Uploads
AI input/output
Secrets
Audit integrity
Rate limits
Dependency security
Assessment tampering
```

Server Actions y Route Handlers deben volver a validar tanto input como autorización. Next.js recomienda exactamente ese modelo y no considerar una restricción en UI/layout como suficiente.

El proyecto también debería configurar explícitamente los controles de Server Actions, incluido `allowedOrigins` cuando sea necesario y límites de request adecuados; Next.js documenta estas opciones como parte de la superficie de seguridad/configuración.

Para Desmos/GeoGebra y otros providers del `MathToolPanel`, el hecho de que actualmente existan siete providers justifica una capa de adapters y una CSP explícita en lugar de ir agregando excepciones globales.

## Decisiones definitivas por los temas investigados

La siguiente matriz resume qué debe quedar establecido como **Target Architecture**.

| Tema | Decisión objetivo | Acción sobre SAT |
|---|---|---|
| **Next.js 16 / RSC / Actions / APIs** | RSC-first; Actions para mutación UI; Route Handlers para fronteras HTTP | Reducir Client Components, introducir DAL y clasificar `/api/*`. Next.js recomienda RSC para datos y Actions para mutaciones.  |
| **Tailwind v4 / Design Tokens** | Mantener Tailwind; convertirlo en consumidor de tokens semánticos | Crear reference → semantic → component tokens con `@theme`; considerar formato DTCG.  |
| **Responsive architecture** | Mobile-first + container queries + layouts propios | `PageShell`, `PageContent`, `FilterBar`, `DataView`, `EditorShell`, `AssessmentShell`; dejar responsive ad hoc.  |
| **Radix / shadcn / Base UI / React Aria** | Mantener Radix detrás de wrappers SAT | No migración masiva; shadcn como registry/source; pilotar alternativas sólo detrás de API propia. shadcn mantiene Radix soportado aunque Base UI sea el default nuevo.  |
| **RHF / Zod / TanStack Form** | RHF + Zod como estándar | Migrar forms controlados progresivamente; TanStack Form no se incorpora como segundo estándar. Zod aporta schemas tipados/metadata.  |
| **TanStack Table** | Adoptar para tablas de producto | DataTable común; server pagination/filter/sort en datasets grandes; Virtual sólo cuando haga falta.  |
| **Server state** | RSC primero; TanStack Query selectivo | Query sólo en polling/live/infinite/client-heavy surfaces; configurar `staleTime`.  |
| **RBAC + NextAuth v5** | Authentication + RBAC + resource policies | Crear `server/policies`; autorización en DAL/Action/Route, nunca sólo nav/layout.  |
| **Feature flags** | OpenFeature abstraction | Envolver los seis flags existentes en provider propio; metadata/expiry; no usar flags como autorización.  |
| **Assessment Engine / State Machines** | Engine común + XState v5 | Practice/Full Test se convierten en configuraciones/capabilities del mismo lifecycle. XState permite state machines y persistencia de snapshots.  |
| **Offline / autosave** | IndexedDB write-ahead journal + idempotent sync | Igualar Practice y Full Test; mutation IDs, sequence/revision, recovery y local-only states. IndexedDB está orientado a almacenamiento transaccional offline.  |
| **Prisma / DB production** | Prisma + PostgreSQL | Retirar `better-sqlite3` como DB objetivo de producción; pooling, indexes, short transactions. SQLite limita writers concurrentes.  |
| **API contracts** | Zod internamente + OpenAPI en HTTP estable | DTOs; schemas de request/response; error envelope común; no exponer Prisma models. OpenAPI estandariza contratos HTTP.  |
| **Accessibility** | WCAG 2.2 AA | Integrarla al Design System y Definition of Done; APG para widgets.  |
| **Testing / Storybook / visual** | Storybook + component tests + Playwright | Stories obligatorias para DS; axe CI; visual regression; E2E P0.  |
| **Observability** | OpenTelemetry-first | Instrumentación transversal RSC/API/DAL/DB/jobs; backend intercambiable.  |
| **Security** | ASVS 5 + secure-by-design | Authorization por recurso, CSP, uploads, rate limiting, dependency security, security CI.  |
| **AI Import/jobs** | Durable workflow fuera de request-response | Inngest como default de implementación inicial; steps idempotentes, retries, checkpoints, human review.  |

La arquitectura resultante queda entonces definida alrededor de este stack:

```text
┌────────────────────────────────────────────────────────────┐
│                       SAT PLATFORM                         │
├────────────────────────────────────────────────────────────┤
│ Next.js 16 App Router + React 19                           │
│ RSC by default · Client islands                            │
├────────────────────────────────────────────────────────────┤
│ SAT Design System                                          │
│ Tailwind v4 · DTCG-style tokens · Radix wrappers           │
│ Storybook                                                  │
├────────────────────────────────────────────────────────────┤
│ UI Patterns                                                │
│ Layouts · Forms · DataTable · Filters · Empty/Loading      │
├────────────────────────────────────────────────────────────┤
│ React Hook Form + Zod                                      │
│ TanStack Table                                             │
│ TanStack Query — selective                                 │
├────────────────────────────────────────────────────────────┤
│ Assessment Engine                                          │
│ XState v5 · IndexedDB journal · Sync protocol              │
├────────────────────────────────────────────────────────────┤
│ Application / Domain                                       │
│ Services · Policies · DAL · Zod DTOs                       │
├────────────────────────────────────────────────────────────┤
│ NextAuth/Auth.js                                           │
│ RBAC + resource authorization                              │
│ OpenFeature abstraction                                    │
├────────────────────────────────────────────────────────────┤
│ Server Actions           │ Route Handlers                  │
│ UI mutations             │ HTTP / upload / sync / jobs     │
├────────────────────────────────────────────────────────────┤
│ Prisma                                                     │
│ PostgreSQL + connection pooling                            │
├────────────────────────────────────────────────────────────┤
│ Durable AI workflows                                       │
│ Inngest · OCR/AI workers · human review                    │
├────────────────────────────────────────────────────────────┤
│ WCAG 2.2 AA · Storybook · Playwright · axe                 │
│ OpenTelemetry · ASVS 5 · AISVS                             │
└────────────────────────────────────────────────────────────┘
```

## Plan de transformación y criterios de aceptación

La transformación debería ejecutarse por **capas**, no pantalla por pantalla. Hacer primero “responsive las 63 páginas” y después intentar introducir Design System obligaría a rehacer trabajo.

**Foundation.** Primero deben quedar aprobados ADRs para RSC/Actions/API, data access, PostgreSQL, authorization, Design System, forms, tables, state management, offline y background jobs. En paralelo se crean `design-system/`, `server/dal`, `server/policies`, `contracts/` y `features/`. Esto fija fronteras arquitectónicas antes de migrar UI.

**Design System foundation.** Crear tokens, primitives, estados y layouts. El objetivo inicial es que ninguna nueva pantalla introduzca directamente una nueva convención visual sin pasar por el Design System. Tailwind v4 facilita que los tokens sean utilities formales mediante theme variables.

Los primeros componentes/patrones deberían ser:

```text
Button
IconButton
Input
Textarea
Select
Checkbox
Radio
Badge
Dialog
Tabs
Tooltip

PageShell
PageHeader
PageContent
FormField
FormSection
FilterBar
DataTable
EmptyState
ErrorState
LoadingState
SaveIndicator
```

**Parametrización del dominio.** Después se eliminan colecciones repetidas de labels/enums/config. El inventario demuestra múltiples repeticiones de Difficulty, Question Type, status, explanation visibility, AI statuses, calculator providers y módulos.

La meta es:

```ts
questionDifficultyMeta.EASY = {
  label: "Easy",
  badge: "success",
  order: 10,
};
```

en lugar de replicar:

```tsx
<option value="EASY">Easy</option>
```

por numerosas páginas.

Navegación debe quedar totalmente data-driven:

```ts
{
  id: "teacher.questions",
  label: "Questions",
  href: "/teacher/questions",
  icon:...,
  roles: ["TEACHER", "ADMIN"],
  feature: null,
  group: "content"
}
```

Teacher desktop nav, mobile drawer y breadcrumbs pueden consumir la misma metadata, mientras la autorización real continúa en servidor.

**Forms.** Migrar primero los formularios repetitivos de auth/admin y después `QuestionEditor`, `PracticeSetEditor` y `FullTestEditor`. Cada migración debe incluir Zod schema compartido, SAT Form components, server validation y mapping consistente de errores.

**Tables.** Crear `DataTable` y migrar primero `/admin/users`, `/admin/teachers`, `/teacher`, Question Bank y Practice Sets. Dejar las tablas triviales como HTML semántico cuando TanStack no aporte nada; su propia documentación señala que el rendering convencional suele ser preferible para tablas pequeñas.

**Assessment.** Extraer la persistencia antes de rehacer visualmente los players. La secuencia correcta es:

```text
Attempt contract
      ↓
Sync protocol
      ↓
IndexedDB journal
      ↓
Assessment machine
      ↓
Shared AssessmentShell
      ↓
Practice configuration
      ↓
Full Test configuration
```

Esto reduce el riesgo de que una refactorización visual afecte respuestas o submissions.

**AI Import.** Extraer `Load/Process/Recover` de requests largos y convertirlos en durable jobs; mantener `Review/Promote` como human-in-the-loop. Inngest proporciona retries por step y recuperación desde checkpoints, que corresponden bien con este flujo.

**Quality gates.** Ningún nuevo primitive/pattern entra al Design System sin story, interacción keyboard, a11y y responsive cases. Ningún flujo crítico entra a producción sin Playwright. Storybook y Playwright permiten automatizar una parte importante de accesibilidad, aunque sus propias documentaciones advierten que la validación automática debe complementarse con pruebas manuales.

Los criterios de aceptación finales para considerar conseguida la **versión integral paramétrica y estandarizada** deberían ser:

| Dimensión | Criterio |
|---|---|
| **UI** | Las páginas consumen primitives/patterns; no reinventan componentes base |
| **Tokens** | No existen colores/spacing de producto arbitrarios fuera de excepciones documentadas |
| **Responsive** | Cada pattern tiene contrato narrow/wide, no media queries improvisadas por pantalla |
| **Forms** | RHF + Zod es el único patrón estándar |
| **Tables** | DataTable común donde existe interacción compleja |
| **Navigation** | Config-driven por portal/rol/feature |
| **Authorization** | Toda operación sensible tiene policy server-side |
| **Feature flags** | Una API OpenFeature, un provider, owner y lifecycle |
| **RSC** | `"use client"` sólo en boundaries interactivas |
| **API** | Server Actions y Route Handlers tienen responsabilidades definidas |
| **Contracts** | Toda entrada server no confiable se valida runtime |
| **Assessment** | Practice y Full Test comparten engine/persistence |
| **Offline** | Ambas modalidades sobreviven refresh/reconnect sin perder respuestas |
| **DB** | PostgreSQL + pooling + migrations + índices |
| **AI** | Ningún procesamiento largo depende de la vida de un request Next.js |
| **AI safety** | Output pasa schema → staging → review → promotion |
| **A11y** | Target WCAG 2.2 AA y pruebas automáticas + manuales |
| **Testing** | Storybook + component tests + E2E critical paths |
| **Observability** | Request/job/DB pueden correlacionarse mediante trace/request ID |
| **Security** | ASVS 5 incorporado a CI/review y autorización por recurso |

El cambio conceptual final es importante: **“paramétrico” no debe significar construir un motor genérico que renderice cualquier pantalla desde JSON**. Debe significar que **las decisiones repetibles** —tokens, navegación, roles, feature flags, statuses, capabilities, layouts, filters, columns, validation contracts y assessment behavior— son datos/configuración; mientras que **la lógica específica de dominio** permanece en componentes y servicios expresivos.

En otras palabras:

```text
ANTES

63 pages
  × local Tailwind decisions
  × local forms
  × local tables
  × local permissions
  × local responsive rules
  × local state
```

debe evolucionar hacia:

```text
DESPUÉS

                    SAT Platform Config
                    /       |        \
                roles     flags    metadata
                   \        |        /
                    \       |       /
                     SAT Domain
                         │
                    SAT Patterns
                         │
                  SAT Design System
                         │
             Tailwind + accessible primitives
                         │
              Next.js / React platform
```

Ese modelo conserva las tecnologías que ya funcionan, elimina duplicación, reduce el costo de las 63 pantallas existentes y deja una arquitectura capaz de crecer hacia más contenido, más workflows de AI, nuevos assessment modes, temas visuales, dispositivos y eventualmente otros clientes sin volver a rediseñar la base del sistema. 