# Diseño: frontend en Firebase, Cloud Run con escala a cero, sesión por inactividad y carga progresiva

**Estado:** propuesta para aprobación · **Fecha:** 2026-10-02 · **Alcance:** SAT Platform (`satsol.org`)
**Decisiones tomadas:** base de destino **Cloud SQL for PostgreSQL**. Este documento solo diseña: la migración y los cambios de UX se implementan cuando se apruebe.

---

## 0. Resumen

### 0.1 Punto de partida (verificado en el código y en GCP el 02-10)

| Tema | Estado real hoy | Implicación |
|---|---|---|
| Cómputo | **No hay Cloud Run.** Producción es **una VM e2-medium** (`sat-vm`, us-east1-b) con Docker Compose: `web` (Next.js 16, `next start`), `ingest-service` (FastAPI) y Caddy | Montar el Cloud Run de cero, no reconfigurar uno existente |
| Base de datos | SQLite (`/data/db/dev.db`, WAL) **compartido en disco por la web y la ingesta** (`lib/prisma.ts`, `ingest_service/app/main.py` con `sqlite3`) | SQLite no aguanta instancias efímeras ni múltiples (ver §8) → **Cloud SQL Postgres** |
| Tiempo real | **No hay WebSocket ni SSE.** Todo es polling: progreso de ingesta cada 8 s (`ai-import-client.tsx`), campana cada 60 s (`notification-bell.tsx`), salud de sesión cada 45 s (`hooks/use-session-guards.ts`) | El WebSocket es una decisión nueva, no una restricción a mantener (ver §3) |
| Inactividad | Ya existe un cierre a los **10 min** (`IDLE_MS`, `use-session-guards.ts:6`), montado en toda la app (`components/session-provider.tsx`) | Hay que añadir **aviso al minuto 9**, coordinación entre pestañas, pausa del examen y tolerancia al arranque en frío (ver §4) |
| Fallos actuales | (1) No avisa antes de cerrar. (2) Cada pestaña cuenta por separado. (3) En un examen hace `signOut` **sin pausar el intento**. (4) El sondeo de salud **cierra la sesión ante un 502/503/504**, justo lo que devuelve un backend que está arrancando | Hay que corregirlos antes o durante la migración (fase F0) |
| Reintentos | `lib/transient-fetch.ts`: 3 intentos, ~1,2 s en total, solo ante 502/503/504, sin timeout | Es más corto que un arranque en frío (~3–8 s, ver §2) |
| Carga | **No hay `loading.tsx` ni `<Suspense>`**; solo `LoadingState` (spinner) en 3 lugares | Al navegar no se muestra nada hasta que el servidor responde (ver §7) |

### 0.2 Recomendación

1. **Firebase App Hosting** para la app Next.js, que es frontend y API a la vez. App Hosting despliega sobre **Cloud Run gestionado**, con `minInstances: 0`, CDN y builds automáticos. Un frontend estático separado no es viable: hay 95 route handlers y unas 56 páginas o layouts que leen datos en el servidor (ver §1).
2. **Cloud SQL for PostgreSQL** (db-f1-micro) como base, con Prisma y `@prisma/adapter-pg`.
3. **Ingesta** como servicio Cloud Run aparte, más **Cloud Run Jobs** para procesar lotes.
4. **GCS** para todos los archivos: medios, staging, avatares y uploads directos con URL firmada.
5. **Sin WebSocket.** Sondeo guiado por la actividad del usuario y un endpoint de calentamiento.
6. **Sesión:** 10 min de inactividad, coordinados entre pestañas; aviso accesible al minuto 9; cierre seguro en exámenes (autosave y pausa); refuerzo en el servidor.
7. **Carga progresiva:** `loading.tsx` con skeletons, `<Suspense>` por secciones, `next/dynamic` y streaming.

### 0.3 Costes (detalle en §12 y en `SAT platform/Administración/coste-mensual-sat.xlsx`)

| Escenario | US$/mes | Nota |
|---|---:|---|
| Actual (VM + backups + observabilidad) | **≈ 38,20** | La VM, sus discos y la IP suman 35,11 |
| Serverless (App Hosting + Cloud SQL) | **≈ 13,45** | Cloud SQL (~10,50) es el coste dominante y **no escala a cero** |

---

## 1. Arquitectura objetivo

```
                 ┌──────────────────────────── Firebase App Hosting ────────────────────────────┐
 navegador ──►   │  Cloud CDN (estáticos _next/static, fuentes)                                 │
 (satsol.org)    │        │                                                                     │
                 │        ▼                                                                     │
                 │  Cloud Run "web" (Next.js standalone, minInstances 0, cpu boost)             │
                 │   - SSR + route handlers (/api/*) + proxy.ts (CSP nonce, request id)         │
                 └───────┬──────────────────────┬───────────────────────┬──────────────────────┘
                         │ Direct VPC egress     │ OIDC (service-to-svc) │ Signed URLs
                         ▼                       ▼                       ▼
              Cloud SQL Postgres          Cloud Run "ingest"       Cloud Storage
              (db-f1-micro, PITR)         (FastAPI, min 0)         media/, staging/, avatars/
                         ▲                       │                       ▲
                         │                       ▼                       │
                         └──────────── Cloud Run Job "ingest-batch" ─────┘ (OCR Mistral, CPU durante todo el job)

  Cloud Scheduler ──OIDC──► /api/internal/* (recordatorios, estados de asignaciones, export de backup)
  Cloud Logging / Monitoring (igual que hoy: logs JSON, uptime checks, alertas por email)
```

### 1.1 ¿Por qué App Hosting y no un frontend estático + API?
- La app es **Next.js App Router con SSR**:
  - hay 95 `route.ts` en `app/api`;
  - unas 56 páginas o layouts usan Prisma directamente;
  - el layout raíz es `force-dynamic`;
  - `proxy.ts` genera la CSP con nonce en cada petición.
- No hay un "frontend" que se pueda exportar a estático sin reescribir la app como SPA más API.
- **App Hosting está diseñado para esto:**
  - construye con Cloud Build;
  - publica en Cloud Run;
  - sirve los estáticos por CDN;
  - se configura en `apphosting.yaml` (`runConfig`).

  Ref.: [Configure App Hosting](https://firebase.google.com/docs/app-hosting/configure), [Frameworks](https://firebase.blog/posts/2025/06/app-hosting-frameworks/).
- Así, "el frontend en Firebase" y "Cloud Run despertando con la petición del frontend" son **la misma pieza**: la primera petición HTML despierta la instancia.

### 1.2 Alternativa considerada: Firebase Hosting + rewrite a Cloud Run
- Hosting sirve los estáticos y reenvía el resto a un servicio Cloud Run propio.
- **Contra:** Hosting impone un **timeout de 60 s** a las peticiones reenviadas ([Hosting + Cloud Run](https://firebase.google.com/docs/hosting/cloud-run), [Hosting + Functions](https://firebase.google.com/docs/hosting/functions)), y hay que mantener a mano el build, la imagen y el despliegue.
- **A favor:** control total de Cloud Run (`--timeout`, `--cpu-boost`, sidecars).
- Vale como **plan B** si App Hosting no permite algo concreto, por ejemplo el timeout: App Hosting no documenta un campo de timeout en `runConfig` (ver §2.4).

### 1.3 `apphosting.yaml` propuesto
```yaml
# apphosting.yaml (raíz del repo)
runConfig:
  minInstances: 0          # escala a cero (§2)
  maxInstances: 3          # tope de coste y de conexiones a Cloud SQL
  concurrency: 40          # Next SSR + API; con 1 vCPU, 40 peticiones concurrentes de I/O es razonable
  cpu: 1
  memoryMiB: 1024          # @react-pdf y KaTeX SSR; 512 se queda corto en PDFs
  cpuAlwaysAllocated: false
  vpcAccess:
    egress: PRIVATE_RANGES_ONLY
    networkInterfaces:
      - network: default
        subnetwork: default
env:
  - variable: DATABASE_URL
    secret: sat-database-url          # Secret Manager
  - variable: AUTH_SECRET
    secret: sat-auth-secret
  - variable: SECRET_ENCRYPTION_KEY
    secret: sat-secret-encryption-key
  - variable: INTERNAL_INGEST_TOKEN
    secret: sat-internal-ingest-token
  - variable: GCS_BUCKET
    value: sat-sol-gsc-sat-data
  - variable: GCS_DUAL_WRITE_DISK
    value: "false"
  - variable: AI_INGEST_SERVICE_URL
    value: https://ingest-<hash>-uc.a.run.app
```

Los campos `cpu`, `memoryMiB`, `concurrency`, `minInstances`, `maxInstances`, `cpuAlwaysAllocated` y `vpcAccess` están documentados en [Configure App Hosting](https://firebase.google.com/docs/app-hosting/configure). Además hay que cambiar `next.config.ts` a `output: "standalone"`.

---

## 2. Escala a cero y arranque en frío

### 2.1 Cómo se comporta Cloud Run
- **Sin tráfico, la revisión baja a 0 instancias.** Tras atender peticiones, Cloud Run *puede* mantener la instancia ociosa **hasta 15 min** para evitar arranques en frío ([About instance autoscaling](https://docs.cloud.google.com/run/docs/about-instance-autoscaling)).
- **Ese tiempo no se configura.** No se puede fijar "apagar a los 10 min". El único control es `minInstances`: con 0 escala a cero; con 1 o más mantiene instancias calientes, y se pagan.
- **Consecuencia:** los "10 minutos" del requisito valen para la **sesión del usuario** (§4), no para el apagado del servidor.
  - Las dos cosas se pueden alinear: tras 10 min sin actividad el cliente cierra la sesión y deja de hacer peticiones.
  - Cloud Run apagará la instancia entre 0 y ~15 min después, sin coste mientras está ociosa con facturación por petición.

### 2.2 Línea de tiempo típica

| t | Usuario | Cliente | Cloud Run |
|---|---|---|---|
| 0:00 | Abre `satsol.org` | GET HTML | 0 instancias → **arranque en frío** (3–8 s) → responde |
| 0:00–0:30 | Escribe el email | `useBackendWarmup` (§5) ya calentó la base al primer `keydown` | Instancia caliente |
| … | Trabaja | Autosaves y sondeo ligero | Atiende peticiones |
| t₀ | Deja de interactuar | Arranca el contador de inactividad | Instancia ociosa (sin coste de CPU) |
| t₀+9:00 | — | **Diálogo de aviso** con cuenta atrás de 60 s (§4) | — |
| t₀+10:00 | — | Autosave forzado + pausa del intento + `signOut` | Últimas peticiones |
| t₀+10:00…+25:00 | — | Sin peticiones | Cloud Run apaga la instancia (≤ 15 min) |
| después | Vuelve | Login → arranque en frío otra vez | 0 → 1 |

### 2.3 Cómo reducir el arranque en frío (objetivo: TTFB < 5 s tras 20 min sin tráfico)

| Medida | Efecto | Ref. |
|---|---|---|
| `output: "standalone"` + imagen multi-stage sin dependencias de desarrollo | La imagen pasa de 1,8 GB a ~200–300 MB, con menos lectura y extracción | [Next.js standalone en Cloud Run](https://oneuptime.com/blog/post/2026-02-17-how-to-build-a-docker-image-for-a-nextjs-application-with-standalone-output-and-deploy-to-cloud-run/view) |
| **Startup CPU boost** | Dobla la CPU durante el arranque y los 10 s siguientes; ~30 % menos de arranque en Node | [Startup CPU boost](https://cloud.google.com/blog/products/serverless/announcing-startup-cpu-boost-for-cloud-run--cloud-functions), [CPU limits](https://docs.cloud.google.com/run/docs/configuring/services/cpu) |
| **Migraciones fuera del arranque** | Hoy `deploy/vm/web-entrypoint.sh` corre `prisma migrate deploy` y el backfill **en cada arranque**. Se pasa a un **Cloud Run Job** previo al despliegue | — |
| Carga perezosa de dependencias pesadas | `@react-pdf/renderer` con `await import()` dentro de las rutas de PDF; calculadora y gráficos con `next/dynamic` | [Prisma: arranque lento en Cloud Run](https://github.com/prisma/prisma/issues/12132) |
| Prisma con driver adapter (`@prisma/adapter-pg`) | Sin motor binario y arranque más ligero | — |
| Conexión a Cloud SQL perezosa con pool pequeño | Ver §8.3 | — |

Si las mediciones en F4 superan los 5 s en franjas de clase, se puede usar `minInstances: 1` solo en ese horario, con Cloud Scheduler y `gcloud run services update`. Una instancia mínima ociosa de 1 vCPU y 512 MiB cuesta ~10 US$/mes según [Cloud Run pricing](https://cloud.google.com/run/pricing) y [prácticas de coste](https://docs.cloud.google.com/run/docs/tips/services-cost-optimization). No se recomienda por defecto.

### 2.4 Límites de Cloud Run que afectan a esta app

| Límite | Valor | Afecta a | Solución |
|---|---|---|---|
| Tamaño de petición HTTP/1 | **32 MiB** ([Quotas](https://docs.cloud.google.com/run/quotas)) | Uploads de ingesta de hasta 256 MB (`proxyClientMaxBodySize: 256mb`, `app/api/admin/ai-import/upload*`) | **URL firmada V4 y subida directa a GCS** (§9) |
| Respuesta HTTP/1 | 32 MiB, salvo con streaming o chunked | PDFs de reporte (KB–pocos MB) | Sin problema |
| Timeout por petición | Máx. **60 min** en Cloud Run; App Hosting no expone el campo; Firebase Hosting, 60 s | Generación de PDF (segundos) | Sin problema; lo largo va a Jobs (§1, §10) |
| CPU tras responder | Con facturación por petición, la CPU **se recorta** al terminar la respuesta | `BackgroundTasks` de FastAPI en `/batches/{id}/process` (`main.py`) | **Cloud Run Job**, o Cloud Tasks hacia un endpoint que espera hasta terminar |

---

## 3. WebSocket: ¿encaja?

### 3.1 Qué dice Cloud Run ([Using WebSockets](https://docs.cloud.google.com/run/docs/triggering/websockets))
- Un WebSocket es una petición HTTP sujeta al **timeout del servicio, como máximo 60 min**. El cliente **debe reconectar**.
- **Mientras hay un WebSocket abierto, la instancia cuenta como activa: tiene CPU asignada y se factura como instancia.**
- La afinidad de sesión es *best effort*: tras reconectar se puede acabar en otra instancia. Para compartir estado hace falta algo externo, como Pub/Sub, Redis o Firestore.

### 3.2 Análisis para SAT Platform

| Criterio | WebSocket | Sondeo guiado por actividad (recomendado) |
|---|---|---|
| Escala a cero | **No funciona:** cada pestaña abierta mantiene la instancia facturando, aunque el alumno esté leyendo | Sin peticiones no hay coste; el sondeo para cuando la pestaña está oculta o inactiva |
| Sesión de 10 min | El cierre por inactividad tiene que cerrar también el socket; si no, la conexión mantiene viva la instancia | Natural: a los 10 min cesan las peticiones |
| Exámenes | La conexión se corta como mucho cada 60 min por el timeout, en mitad del módulo; hay que reconectar y resincronizar | El autosave HTTP ya es idempotente, con buffer offline y reintentos |
| Necesidad real | No hay chat ni colaboración en vivo. Lo "en vivo" es: progreso de ingesta (admin), campana (60 s) y salud de sesión | Basta con lo actual |
| Complejidad | Servidor WS dentro de Next (no lo soporta de forma nativa), afinidad y bus entre instancias | Ninguna nueva |

**Decisión: no introducir WebSocket.** Patrones a aplicar:
1. **Sondeo guiado por la actividad:**
   - `refetchInterval` solo con la pestaña visible (`refetchIntervalInBackground: false`, el valor por defecto de TanStack Query);
   - y solo mientras la sesión esté "activa" según el gestor de inactividad (§4).
2. **SSE opcional para el progreso de ingesta**, con fin explícito:
   - `GET /api/admin/ai-import/batches/[id]/progress/stream` emite eventos y **se cierra** al terminar el lote o a los 5 min;
   - el cliente reabre si sigue en la página;
   - con eso la instancia nunca queda retenida indefinidamente.

   Sustituye al sondeo cada 8 s y es solo para admin.
3. **Salud de sesión:** el sondeo de 45 s se convierte en latido ligado a la actividad (§4.3).

---

## 4. Inactividad de 10 min con aviso a 1 min, también en exámenes

### 4.1 Requisitos
- **R1.** Tras **10 min sin actividad** del usuario, en cualquier pestaña de la app, se cierra la sesión.
- **R2.** Al **minuto 9** aparece un **aviso** con cuenta atrás de 60 s y dos acciones: **"Seguir conectado"** y **"Cerrar sesión"**.
- **R3.** En **exámenes y prácticas en curso**, el cierre **no pierde nada**:
  1. se fuerza el autosave;
  2. se guarda el estado de los timers;
  3. se **pausa el intento**;
  4. se cierra la sesión.

  Al volver, el intento se reanuda donde estaba.
- **R4.** Las pestañas se coordinan: la actividad en una cuenta para todas, y el cierre se propaga a todas.
- **R5.** Un backend **arrancando en frío no cierra la sesión.** Solo se cierra por inactividad, por un 401/403 real o por revocación.
- **R6.** Accesible según **WCAG 2.2.1 Timing Adjustable**: aviso previo con opción de extender (≥ 20 s para responder, ampliable al menos 10 veces), foco gestionado y anuncio no intrusivo. Refs.: [WCAG 2.2.1 (DigitalA11Y)](https://www.digitala11y.com/understanding-sc-2-2-1-timing-adjustable/), [patrón DWP "manage a session timeout"](https://design-system.dwp.gov.uk/patterns/manage-a-session-timeout/accessibility).

### 4.2 Patrón: `IdleSessionManager` (cliente)

```
              actividad (pointerdown, keydown, input, wheel/scroll, touchstart, focus de pestaña)
                                   │ throttle 1 s
                                   ▼
   ┌──────────── lastActivityAt (compartido) ────────────┐
   │  localStorage["sat-idle:last"] + BroadcastChannel    │  ◄── las otras pestañas escriben aquí también
   └──────────────────────────┬───────────────────────────┘
                              │ tick cada 1 s (requestAnimationFrame/setTimeout, solo pestaña visible)
          idle = now - lastActivityAt
          ├─ idle <  9:00  → estado ACTIVE
          ├─ 9:00 ≤ idle < 10:00 → estado WARNING (abre diálogo en TODAS las pestañas)
          └─ idle ≥ 10:00 → estado EXPIRED → una pestaña líder ejecuta el cierre y emite "logout"
```

- **Estado compartido:**
  - `BroadcastChannel("sat-session")` transporta los mensajes `activity`, `extend` y `logout`;
  - `localStorage` hace de respaldo para navegadores sin BroadcastChannel y para pestañas que despiertan.

  La actividad de cualquier pestaña reinicia el contador global ([patrón multi-pestaña](https://github.com/Heliobond/frontend/issues/713)).
- **Pestaña líder del cierre:** la primera que detecta `EXPIRED` toma un "lock" con `navigator.locks.request("sat-logout")`, que está muy soportado, y ejecuta el cierre. Las demás reciben `logout` y redirigen sin repetir la pausa.
- **Qué cuenta como actividad:** `pointerdown`, `keydown`, `input`, `wheel`, `scroll`, `touchstart` y `visibilitychange → visible`.
  - El simple `pointermove` **no** cuenta durante el aviso, para que mover el ratón por accidente no lo descarte.
  - Fuera del aviso sí cuenta, con throttle, como hoy.
- **Actividad sintética en exámenes:** no se inventa actividad. Un alumno que lee un pasaje 9 min sin tocar nada **verá el aviso** y pulsará "Seguir conectado", como pide el requisito.
  - **Excepción:** durante el **descanso** entre módulos del FPT (`phase === "BREAK"`), el contador queda **en pausa**. El descanso es un tiempo oficial del examen y dura menos de 10 min.

### 4.3 Diálogo de aviso (componente `SessionTimeoutDialog`)
- Usa el `Dialog` de Radix (`components/ui/dialog.tsx`), con `role="alertdialog"` y `aria-describedby` apuntando al texto.
- **Foco inicial** en "Seguir conectado". `Esc` **no** descarta, por el patrón DWP: el usuario tiene que elegir.
- **Texto:** "Por inactividad cerraremos tu sesión en **0:59**." Si hay un examen en curso, se añade: "Tus respuestas están guardadas y el examen quedará en pausa."
- **Anuncio para lectores de pantalla:** una región `aria-live="polite"` anuncia **solo** al abrir y a los 30 s y 10 s, nunca cada segundo ([issue de referencia](https://github.com/TortoiseWolfe/RescueDogs/issues/385)).
- **"Seguir conectado":**
  1. difunde `extend` por el canal;
  2. llama a `POST /api/session/heartbeat`, que renueva `lastSeen` en el servidor (§4.5) y de paso **despierta el backend** si se durmió;
  3. cierra el diálogo en todas las pestañas.
- **"Cerrar sesión":** ejecuta el mismo cierre seguro de §4.4.

### 4.4 Cierre seguro (`endSession("idle")`)
```ts
// lib/session-exit.ts (nuevo; generaliza lib/player-session-exit.ts)
export async function endSession(reason: "idle" | "session" | "manual") {
  // 1. Players registrados (Practice / FPT) vuelcan su estado:
  await Promise.allSettled(activePlayers.map((p) => p.flush()));   // autosave + timers (keepalive)
  // 2. Pausa del intento abierto (idempotente en el servidor, routes /pause ya existen):
  await Promise.allSettled(activePlayers.map((p) => p.pause()));   // POST .../pause con keepalive
  // 3. Aviso al resto de pestañas y cierre:
  channel.postMessage({ type: "logout", reason });
  await signOut({ callbackUrl: `/login?reason=${reason}` });
}
```
- **Registro de players:** cada player llama a `useRegisterPlayer({ flush, pause })`, que expone sus funciones ya existentes: `saveProgress`/`postPayload`, el `timerState` del FPT y `sendKeepalive` (`lib/player-persistence.ts`).
- **Corrige el fallo actual:** hoy el `signOut` por inactividad no pausa el intento.
- **El tiempo del examen:** el timer de módulo es del cliente y se guarda en `moduleTimerState` en cada autosave. Al reanudar se restaura y queda congelado mientras está pausado.
- **Sondeo de salud (`/api/session/health`):**
  - **cierra solo ante 401/403**;
  - ante 5xx o error de red pasa a "reconectando" (banner, §6) y reintenta con backoff.

### 4.5 Refuerzo en el servidor
El cliente se puede manipular; el servidor también tiene que imponer el límite.
- En el JWT de NextAuth se añade el claim `lastSeen`, que se renueva en `/api/session/heartbeat` y en las peticiones autenticadas que **implican actividad**: autosave, check, submit y navegación de página. El sondeo de salud no lo renueva.
- `lib/auth.ts`, callback `jwt`: si `now - lastSeen > 10 min + 60 s de gracia`, se devuelve `null` y la sesión termina.
  - Hoy `maxAge` es de 7 días; se mantiene como tope absoluto.
  - `session.updateAge` baja a 60 s para que la cookie se reemita con el nuevo `lastSeen`.
- **En exámenes:** el autosave del player es actividad real y renueva `lastSeen`. Si el cliente cerró por inactividad, la pausa ya quedó registrada.
- **Refs.:** [NextAuth session options](https://authjs.dev/reference/core#session). Revocación ya existente: `sessionVersion` en `lib/session-state.ts`.

### 4.6 Archivos afectados

| Archivo | Cambio |
|---|---|
| `hooks/use-session-guards.ts` | Se sustituye por `hooks/use-idle-session.ts` (gestor, canal, lock) y `components/sat/session-timeout-dialog.tsx` |
| `lib/player-session-exit.ts` → `lib/session-exit.ts` | Cierre seguro con registro de players |
| Players (`practice/player-client.tsx`, `full-tests/[assignmentId]/player-client.tsx`) | `useRegisterPlayer({ flush, pause })`; pausa del contador durante `BREAK` |
| `app/api/session/health/route.ts` | Sin cambio funcional; el cliente deja de cerrar ante 5xx |
| `app/api/session/heartbeat/route.ts` (nuevo) | Renueva `lastSeen` y hace `SELECT 1` |
| `lib/auth.ts` | Claim `lastSeen`, `updateAge: 60` y regla de 10 min |
| `app/(auth)/login/page.tsx` | Mensaje `reason=idle`: "Cerramos tu sesión tras 10 minutos sin actividad. Tu examen quedó en pausa." |

---

## 5. Despertar el backend al detectar intención (`useBackendWarmup`)

**Objetivo:** que el arranque en frío ocurra **mientras el usuario todavía escribe**, no al pulsar "Sign in" o "Submit".

| Disparador | Detección | Dónde |
|---|---|---|
| Carga de la página o vuelta a la pestaña | `visibilitychange → visible`, `pageshow` | Global |
| Empieza a escribir | primer `keydown` o `input` en un `<form>` | Login, activación, reset, formularios de profesor |
| **Autocompletado del navegador o del gestor de contraseñas** | `input` con `event.inputType === "insertReplacementText"` o sin `inputType`; **`animationstart`** de una animación vacía aplicada en `:-webkit-autofill` / `:autofill` | Login sobre todo |
| Intención de enviar | `pointerenter` o `focus` en botones `type="submit"` | Global |
| Vuelve de inactividad o del aviso | "Seguir conectado" | §4.3 |

```css
/* globals.css — detector de autofill sin polling */
@keyframes sat-autofill { from { } to { } }
input:-webkit-autofill, input:autofill { animation-name: sat-autofill; animation-duration: 1ms; }
```

```ts
// hooks/use-backend-warmup.ts (patrón)
const WARM_EVERY_MS = 60_000;          // como mucho 1 ping por minuto y por pestaña
let lastWarm = 0;
export function warmBackend() {
  if (Date.now() - lastWarm < WARM_EVERY_MS) return;
  lastWarm = Date.now();
  // GET barato; 'keepalive' para que sobreviva a una navegación inmediata.
  fetch("/api/warm", { method: "GET", cache: "no-store", keepalive: true }).catch(() => {});
}
// listeners delegados en document: keydown/input/animationstart(sat-autofill)/pointerenter[type=submit]/visibilitychange
```

- **`/api/warm`:** ruta pública que hace `SELECT 1` (calienta el pool de Cloud SQL), responde `204` y no registra línea de acceso, igual que `/api/health*` hoy en `lib/api-error.ts`.
  - **Rate limit por IP** (60/min) para que no sirva de amplificador.
  - **No despierta la ingesta:** esa se despierta solo cuando un admin entra en `/admin/import`, con su propio ping a `/api/admin/ai-import/warm`, que llama a `GET /health` del servicio de ingesta.
- **Coste:** cada ping es una petición de ~5 ms. Con los free tiers de Cloud Run (2 M peticiones/mes) es despreciable.

---

## 6. Cliente tolerante al arranque en frío

- **`lib/transient-fetch.ts` v2:**
  - reintenta **502, 503, 504, 429 y errores de red** con **backoff exponencial y jitter completo**: base 500 ms, factor 2, techo de 4 s, **presupuesto total de 15 s**;
  - respeta `Retry-After`;
  - aborta cada intento a los 10 s con `AbortController.timeout`.

  Ref.: [AWS Architecture Blog, "Exponential backoff and jitter"](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/).
- **Banner "Conectando con el servidor…"** (`OfflineBanner` en modo `connecting`):
  - aparece si una petición tarda **más de 1,5 s** o entra en reintento;
  - se oculta al recibir respuesta;
  - no bloquea: el usuario puede seguir respondiendo, porque el buffer offline guarda todo.
- **Players:** sin cambios en la lógica; ya tienen cola, buffer local y `keepalive`. Solo cambia el reintento más largo y que un 5xx no se trate como pérdida de sesión.
- **Idempotencia:** el submit ya rechaza intentos que no están `IN_PROGRESS`. Con reintentos de 15 s, el **submit** pasa a llevar un `Idempotency-Key` (UUID por intento de envío), guardado en una tabla `IdempotencyKey(key, response, createdAt)` con 24 h de TTL. Así un reintento después de un timeout devuelve la misma respuesta.

---

## 7. Carga progresiva (UX)

### 7.1 Principios
1. **Mostrar la estructura de inmediato:** el layout, la navegación y un skeleton con la forma final, sin saltos de layout (CLS ≈ 0).
2. **Primero el contenido crítico; lo secundario, en streaming.**
3. **Nada de spinners de página completa,** salvo al arrancar el player.
4. **Respetar `prefers-reduced-motion`:** el skeleton queda estático, sin shimmer.

Refs.: [Next.js — Streaming](https://nextjs.org/learn/dashboard-app/streaming), [Loading UI y streaming en Next 16](https://thecodeforge.io/javascript/nextjs-loading-ui-streaming-suspense/), [patrones de skeleton](https://www.peal.dev/blog/nextjs-loading-states-suspense-skeleton-ui-patterns).

### 7.2 Piezas
- **`components/ui/skeleton.tsx`:** `<Skeleton className="h-4 w-40" />` con `bg-muted`, `aria-hidden`, más `motion-safe:animate-pulse`. Variantes compuestas en `components/sat/skeletons.tsx`: `CardSkeleton`, `TableSkeleton rows={n}`, `ChartSkeleton`, `PlayerSkeleton`.
- **`loading.tsx` por segmento:** Next envuelve la página en `<Suspense>` y envía el shell al instante ([loading.js](https://nextjs.org/docs/app/api-reference/file-conventions/loading)).

| Ruta | Skeleton |
|---|---|
| `app/(student)/student/loading.tsx` | 3 tarjetas KPI + lista de asignaciones |
| `app/(student)/student/content-map/loading.tsx` | Rejilla de áreas |
| `app/(student)/student/practice/assignment/[id]/loading.tsx` y `full-tests/[assignmentId]/loading.tsx` | `PlayerSkeleton`: cabecera con timer, panel de pasaje y opciones |
| `app/(teacher)/teacher/loading.tsx` | Tabla de alumnos (`TableSkeleton rows={8}`) |
| `app/(teacher)/teacher/students/[studentId]/loading.tsx` | Cabecera + pestañas + `ChartSkeleton` |
| `app/(teacher)/teacher/questions/loading.tsx` | Filtros + `TableSkeleton rows={10}` |
| `app/admin/loading.tsx`, `app/(parent)/loading.tsx` | Genéricos |

- **`<Suspense>` por sección** dentro de páginas con varias consultas:
  - el dashboard del profesor separa KPIs, "atención requerida" y gráficos;
  - la ficha del alumno separa tendencias y la tabla de intentos;
  - el admin separa los logs.

  Cada sección es un server component async con su propio `<Suspense fallback={<ChartSkeleton/>}>`, así la parte rápida no espera a la lenta.
- **`next/dynamic` con `ssr: false`** para lo pesado del cliente:
  - `MathToolPanel` (calculadora);
  - `generate-report-dialog`;
  - `progress-charts`;
  - `topic-difficulty-trend`;
  - el visor PDF del cropper de ingesta.

  Cada uno con su `loading` en forma de skeleton.
- **Transiciones:**
  - `useTransition` en filtros y paginación, para que la UI anterior siga visible con opacidad mientras llega la nueva;
  - `<Link prefetch>`, que es el valor por defecto, en la navegación principal.
- **UI optimista** con `useOptimistic` en acciones rápidas: marcar notificación como leída, Mark for review, toggles de profesor. Si falla, se revierte con `notify.error`.
- **Streaming en la plataforma:** Cloud Run soporta respuestas en streaming (el límite de 32 MiB no aplica con chunked, según [Quotas](https://docs.cloud.google.com/run/quotas)) y App Hosting sirve Next con streaming. Hay que verificar en F4 que el primer byte del shell llega antes que los datos.
- **La CSP con nonce es compatible:** Next añade el nonce a los scripts de streaming.

---

## 8. Datos: de SQLite a Cloud SQL for PostgreSQL

### 8.1 Por qué no SQLite en Cloud Run
- El disco de Cloud Run es efímero, y varias instancias no pueden compartir un archivo con locks.
- **Cloud Storage FUSE no da locks ni semántica POSIX completa.** SQLite sobre gcsfuse está desaconsejado para producción ([Cloud Storage volume mounts](https://docs.cloud.google.com/run/docs/configuring/services/cloud-storage-volume-mounts), [experimento sqlite-cloudrun](https://github.com/davidmuraya/sqlite-cloudrun/blob/main/README.md)).
- Litestream obligaría a `maxInstances: 1`, a restaurar en cada arranque en frío y a meter la ingesta en el mismo contenedor ([comparativa](https://tako.nakano.net/blog/2025/08/cloud-run-sqlite-performance-part-2/)). Se descartó por fragilidad.

### 8.2 Pasos
1. **Prisma:**
   - `provider = "postgresql"`;
   - revisar los tipos: `String` JSON → `Json`/`jsonb` en `testSnapshot`, `practiceSetSnapshot`, `questionSnapshot` y `metadata`; `DateTime` → `timestamptz`; índices;
   - `@prisma/adapter-pg` en `lib/prisma.ts`, que deja de usar pragmas.
2. **Nueva línea base de migraciones:** la cadena SQLite no se puede reejecutar desde una base vacía (memoria `migrations-not-replayable-from-empty`). Se genera `0_init` con `prisma migrate diff --from-empty --to-schema` y se marca como aplicada.
3. **Migración de datos:** script `scripts/migrate-sqlite-to-pg.mjs`, que lee con better-sqlite3 una copia `.backup` y escribe por lotes en Postgres respetando el orden de FKs. Alternativa: `pgloader`.
   - **Verificación:** conteo de filas por tabla, checksums de columnas clave y E2E completos.
4. **Ingesta Python:** de `sqlite3` a `psycopg` (pool de 2–3) y SQL portable (`?` → `%s`, `INSERT OR REPLACE` → `ON CONFLICT`). Se elimina el `init_db()` del arranque: las tablas de ingesta pasan al esquema Prisma.
5. **Contención:** `withSqliteRetry` deja de hacer falta (Postgres usa MVCC).

### 8.3 Conexiones desde Cloud Run
- **Cloud SQL con IP privada y Direct VPC egress** (`vpcAccess` en `apphosting.yaml`), o el **Cloud SQL Node.js Connector** con IAM.
- db-f1-micro admite ~25 conexiones. Por eso: `maxInstances` de web 3, pool de 5 y la ingesta con 3, lo que deja margen.
- Pool **perezoso**: la primera petición abre la conexión. `/api/warm` la abre por anticipado (§5).

### 8.4 Backups
- Backups automáticos diarios de Cloud SQL + **PITR** (7 días de logs).
- **Exportación mensual** con `gcloud sql export sql` al bucket off-site, que ya existe con 190 días de retención (RNF-14/15).
- `deploy/vm/sat-db-backup.sh` se retira junto con la VM.
- **Ensayo de restore** en un clon (`gcloud sql instances clone`) cada trimestre (runbook).

---

## 9. Archivos: todo a GCS

| Hoy | Destino |
|---|---|
| Imágenes de preguntas: GCS + disco (`GCS_DUAL_WRITE_DISK=true`) | Solo GCS (`GCS_DUAL_WRITE_DISK=false`); lectura por `/api/media/questions/*` con sesión, igual que hoy |
| **Avatares en disco** (`STORAGE_DRIVER` local por defecto) | `avatars/` en GCS (driver `gcs`) |
| **Staging de ingesta** en `/app/.private/uploads/ingest`, compartido entre web e ingesta | `staging/{batchId}/…` en GCS; la web lo lee por stream con su sesión de admin (`app/api/admin/ai-import/assets/...`) |
| Uploads de 256 MB a través de Next | **URL firmada V4** (`PUT`) emitida por `POST /api/admin/ai-import/upload-url` tras validar admin, tipo y tamaño; el navegador sube **directo a GCS** (subida reanudable para > 32 MiB); al terminar avisa con `POST .../upload-complete` |
| `backup-status.json` junto a la base | Se retira; el estado de backups lo da Cloud SQL (alerta en Monitoring) |

Refs.: [Signed URLs](https://cloud.google.com/storage/docs/access-control/signed-urls), [subidas reanudables](https://cloud.google.com/storage/docs/resumable-uploads), [patrón de URL firmada frente a los 32 MiB](https://dev.to/stack-labs/how-to-overcome-cloud-runs-32mb-request-limit-190j).

---

## 10. Estado en memoria y tareas programadas

| Pieza | Problema con instancias efímeras o múltiples | Solución |
|---|---|---|
| `lib/rate-limit.ts` (Map en proceso) | Cada instancia cuenta por su cuenta, y en un arranque en frío se pierde todo | Tabla `RateLimitBucket(key, count, windowStart)` con `INSERT … ON CONFLICT DO UPDATE` (atómico en Postgres). Memorystore se descarta: ~35 US$/mes |
| `lib/session-state.ts` (caché de 15 s) | La revocación tarda ≤ 15 s en otras instancias | Se acepta y se documenta (como mucho 3 instancias). Opcional: bajar a 5 s |
| `refreshAssignmentStates` (`lib/assignments.ts`, throttle de 30 s en proceso) | Con varias instancias se ejecuta más; escribe al leer | Se saca de la ruta de lectura: **Cloud Scheduler** cada 5 min → `/api/internal/assignments/refresh` |
| Cron de recordatorios (`docker exec` en la VM) | No hay VM | **Cloud Scheduler** cada hora → `/api/internal/notifications/generate` con **token OIDC**; la ruta valida la audiencia y la cuenta de servicio ([Scheduler + OIDC](https://cloud.google.com/scheduler/docs/http-target-auth)) |
| `BackgroundTasks` de la ingesta | La CPU se recorta tras responder | **Cloud Run Job** `ingest-batch --args=<batchId>`, lanzado desde la web con la API de Run (`jobs.run`); progreso en Postgres, como hoy |
| Caddy `@internal → 404` | Ya no está Caddy | `/api/internal/*` exige OIDC; App Hosting no los expone sin token válido |

---

## 11. Seguridad
- **Se mantiene:**
  - CSP con nonce por petición (`proxy.ts`, `lib/csp.ts`);
  - `x-request-id`;
  - cabeceras de `next.config.ts`.

  App Hosting termina TLS (certificado gestionado) y HSTS se emite desde `headers()`, porque Caddy desaparece.
- **Secretos:** se leen de Secret Manager desde `apphosting.yaml` (`env[].secret`), con acceso por la cuenta de servicio del backend.
- **Ingesta:** servicio Cloud Run **sin acceso público** (`--no-allow-unauthenticated`); la web la invoca con un ID token (service-to-service).
- **Dominio:** `satsol.org` como dominio personalizado de App Hosting. Hay que actualizar `AUTH_URL` y `CORS_ALLOWED_ORIGINS`.
- **Egress:** solo rangos privados por VPC. GCS y Mistral salen por Internet público con TLS.

---

## 12. Costes estimados (precios públicos al 02-10-2026)

### 12.1 Actual (hoja "GCP actual (oct-2026)")

| Partida | US$/mes |
|---|---:|
| e2-medium us-east1 | 24,46 |
| Discos (~70 GB balanced) | 7,00 |
| IPv4 externa en uso | 3,65 |
| Egress a Internet y entre regiones | 0,86 |
| Cloud Storage: principal (regla de 30 días) + off-site | 0,63 |
| Artifact Registry | 0,35 |
| Logging, Monitoring, uptime, alertas, Secret Manager | 0,00 |
| Dominio | 1,25 |
| **Total** | **≈ 38,20** |

### 12.2 Serverless (hoja "Escenario serverless")

| Partida | US$/mes | Supuesto |
|---|---:|---|
| Cloud SQL db-f1-micro + 10 GB SSD + backups/PITR | ~10,50 | Siempre encendida ([Cloud SQL pricing](https://cloud.google.com/sql/pricing)) |
| App Hosting / Cloud Run web | ~0 | Free tier: 180k vCPU-s, 360k GiB-s y 2 M peticiones al mes ([App Hosting costs](https://firebase.google.com/docs/app-hosting/costs), [Cloud Run pricing](https://cloud.google.com/run/pricing)). 10 alumnos × 40 h × ~60 vCPU-s/h ≈ 24k vCPU-s |
| Cloud Run ingesta + Jobs | ~0,50 | Solo cuando se ingiere |
| Egress de App Hosting | ~0 | 10 GiB/mes gratis |
| Cloud Build | 0 | 2500 min/mes gratis |
| Artifact Registry | ~0,50 | |
| Cloud Storage | ~0,70 | |
| Cloud Scheduler | 0 | 3 jobs gratis |
| Observabilidad | 0 | Las alertas pasan a ~1,05 desde no antes del 1-9-2027 ([Observability pricing](https://cloud.google.com/products/observability/pricing)) |
| Dominio | 1,25 | |
| **Total** | **≈ 13,45** | |

**Riesgos de coste:**
- Una sesión de clase intensa sigue dentro del free tier. Con 25 alumnos simultáneos (la prueba de carga del 02-10) se usarían ~2–3 instancias durante la clase, también dentro del free tier.
- Si se activa `minInstances: 1` en horario de clase, hay que sumar ~2–4 US$/mes.

---

## 13. Plan de migración por fases

| Fase | Contenido | Criterio de salida | Rollback |
|---|---|---|---|
| **F0** (sobre la VM actual; sirve en ambas arquitecturas) | §4 inactividad (aviso, pestañas, cierre seguro, servidor), §6 tolerancia al arranque en frío, §7 carga progresiva, §5 `useBackendWarmup` + `/api/warm` | E2E: aviso a 9:00, cierre a 10:00 con el intento pausado y reanudable, varias pestañas, 5xx sin logout; Lighthouse/CLS ≈ 0 en 6 vistas | TAG anterior con `deploy.sh` |
| **F1** Archivos a GCS | Avatares y staging en GCS, uploads con URL firmada, dual-write desactivado | Ingesta E2E con un PDF > 32 MiB; avatares e imágenes con sesión | Volver a activar el dual-write |
| **F2** Postgres | Esquema, nueva línea base, script de datos, ingesta con psycopg; ensayo en una base clonada | Conteos idénticos, `npm run quality`, E2E RF/RNF/UI y carga (`scripts/qa/load-test.mjs`) contra Postgres | Seguir en SQLite (la VM sigue viva) |
| **F3** Ingesta en Cloud Run + Job | Servicio privado, `ingest-batch` como Job, Scheduler + OIDC | Un lote completo procesado en el Job; recordatorios desde Scheduler | Volver a la ingesta en la VM |
| **F4** App Hosting | `output: "standalone"`, `apphosting.yaml`, backend conectado al repo, dominio de prueba (`*.hosted.app`), luego `satsol.org` | TTFB tras 20 min sin tráfico < 5 s (p95 de 10 pruebas), CSP sin violaciones, uptime checks verdes | Cambio de DNS de vuelta a la IP de la VM (TTL bajado a 300 s antes) |
| **F5** Retirar la VM | Ventana de mantenimiento; congelar escrituras, migración final de datos, cambio de DNS; la VM queda apagada 2 semanas | 2 semanas estables | Encender la VM y volver a cambiar el DNS |

**Orden recomendado:** F0 primero. Arregla fallos reales (cierre de sesión ante un 5xx, examen sin pausa) y mejora la experiencia aunque la migración se retrase.

---

## 14. Verificación

1. **Arranque en frío:** con un script, 10 veces tras ≥ 20 min sin tráfico, medir el TTFB de `/login` y de `/api/warm`. Objetivo: p95 < 5 s y `/api/warm` < 3 s tras el `keydown` simulado.
2. **Inactividad (Playwright, con reloj simulado `page.clock`):**
   - a 8:59 no hay diálogo; a 9:00 el diálogo tiene foco en "Seguir conectado";
   - "Seguir conectado" hace que el diálogo desaparezca en **las dos pestañas**;
   - a 10:00 se navega a `/login?reason=idle`;
   - en el FPT, el intento tiene una `FullPracticeTestPause` abierta y `currentModule`/`moduleTimerState` guardados; al volver a entrar el timer continúa;
   - durante `BREAK` no hay aviso.
3. **Tolerancia:** se simulan 503 durante 8 s con `page.route` en `/api/session/health` y en el autosave. Resultado esperado: banner "Conectando…", sin logout y sin pérdida de respuestas.
4. **Refuerzo en el servidor:** un JWT con `lastSeen` de hace 11 min recibe 401 en `/api/session/health`.
5. **Carga progresiva:** las capturas a los 200 ms muestran skeletons; CLS < 0,1 (Lighthouse) en el dashboard del profesor, la ficha del alumno y el banco.
6. **Carga:** `node scripts/qa/load-test.mjs run https://<preview>.hosted.app …` con 10 y 25 alumnos: 0 errores y autosave p95 < 300 ms.

---

## 15. Referencias

**Firebase App Hosting**
- Configurar backends y `apphosting.yaml` (`runConfig`, `vpcAccess`, secretos): https://firebase.google.com/docs/app-hosting/configure
- Costes y niveles gratuitos de App Hosting: https://firebase.google.com/docs/app-hosting/costs
- Frameworks soportados: https://firebase.blog/posts/2025/06/app-hosting-frameworks/
- Guía práctica: Next.js 16 en App Hosting: https://medium.com/@xflavioribeiro/deploying-a-next-js-16-nx-monorepo-on-firebase-app-hosting-20d964a5a6db

**Firebase Hosting + Cloud Run (alternativa)**
- https://firebase.google.com/docs/hosting/cloud-run
- Timeout de 60 s: https://firebase.google.com/docs/hosting/functions

**Cloud Run**
- Autoscaling, retención ociosa de hasta 15 min y `min-instances`: https://docs.cloud.google.com/run/docs/about-instance-autoscaling
- WebSockets (timeout, facturación, afinidad, reconexión): https://docs.cloud.google.com/run/docs/triggering/websockets
- Cuotas y límites (32 MiB en HTTP/1, 60 min): https://docs.cloud.google.com/run/quotas
- Startup CPU boost: https://cloud.google.com/blog/products/serverless/announcing-startup-cpu-boost-for-cloud-run--cloud-functions
- Límites de CPU: https://docs.cloud.google.com/run/docs/configuring/services/cpu
- Precios: https://cloud.google.com/run/pricing
- Optimización de costes: https://docs.cloud.google.com/run/docs/tips/services-cost-optimization
- Montaje de Cloud Storage (FUSE): https://docs.cloud.google.com/run/docs/configuring/services/cloud-storage-volume-mounts
- Next.js standalone en Cloud Run: https://oneuptime.com/blog/post/2026-02-17-how-to-build-a-docker-image-for-a-nextjs-application-with-standalone-output-and-deploy-to-cloud-run/view
- Prisma y arranques en frío en Cloud Run: https://github.com/prisma/prisma/issues/12132

**Datos y almacenamiento**
- Cloud SQL pricing: https://cloud.google.com/sql/pricing
- SQLite en Cloud Run (gcsfuse frente a Litestream): https://tako.nakano.net/blog/2025/08/cloud-run-sqlite-performance-part-2/ · https://github.com/davidmuraya/sqlite-cloudrun/blob/main/README.md
- URLs firmadas: https://cloud.google.com/storage/docs/access-control/signed-urls
- Subidas reanudables: https://cloud.google.com/storage/docs/resumable-uploads
- Patrón contra el límite de 32 MiB: https://dev.to/stack-labs/how-to-overcome-cloud-runs-32mb-request-limit-190j
- Cloud Scheduler con OIDC: https://cloud.google.com/scheduler/docs/http-target-auth

**Sesión, accesibilidad y resiliencia**
- WCAG 2.2.1 Timing Adjustable: https://www.digitala11y.com/understanding-sc-2-2-1-timing-adjustable/
- DWP Design System, "Manage a session timeout": https://design-system.dwp.gov.uk/patterns/manage-a-session-timeout/accessibility
- Inactividad entre pestañas (BroadcastChannel): https://github.com/Heliobond/frontend/issues/713
- Diálogo de timeout accesible (sin anunciar cada segundo): https://github.com/TortoiseWolfe/RescueDogs/issues/385
- Backoff exponencial con jitter: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
- Auth.js, opciones de sesión: https://authjs.dev/reference/core#session

**Carga progresiva (Next.js)**
- Streaming: https://nextjs.org/learn/dashboard-app/streaming
- `loading.js`: https://nextjs.org/docs/app/api-reference/file-conventions/loading
- Loading UI y Suspense en Next 16: https://thecodeforge.io/javascript/nextjs-loading-ui-streaming-suspense/
- Patrones de skeleton: https://www.peal.dev/blog/nextjs-loading-states-suspense-skeleton-ui-patterns

**Observabilidad y costes**
- Precios de Observability (Logging 50 GiB gratis, uptime, alertas desde ≥ 1-9-2027): https://cloud.google.com/products/observability/pricing
- Gestión de costes de alertas: https://docs.cloud.google.com/monitoring/alerts/cost-control
