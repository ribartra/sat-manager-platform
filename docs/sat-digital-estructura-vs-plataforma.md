# Digital SAT — estructura oficial vs comportamiento de la plataforma

> **Estado (2026-08-11).** Especificación del **Digital SAT** (College Board) contrastada con
> cómo esta plataforma modela y ejecuta los Full Practice Tests. Fuentes oficiales:
> [How the SAT Is Structured](https://satsuite.collegeboard.org/sat/whats-on-the-test/structure) ·
> [Digital SAT Suite Specifications Overview (PDF)](https://satsuite.collegeboard.org/media/pdf/digital-sat-test-spec-overview.pdf).
>
> En código: plantilla de módulos en `app/api/full-practice-tests/route.ts` y
> `promote-full-test/route.ts`; player en
> `app/(student)/student/full-tests/[assignmentId]/player-client.tsx`; scoring en
> `lib/full-test-scoring.ts`.

---

## 1. Estructura oficial (Digital SAT)

### 1.1 Totales

| Magnitud | Valor oficial |
|----------|---------------|
| Preguntas visibles al estudiante | **98** |
| Tiempo de examen (sin break) | **2 h 14 min** (134 min) |
| Descanso entre secciones | **10 min** (entre R&W y Math) |
| Puntuación total | **400–1600** |
| Puntuación por sección | **200–800** (R&W y Math) |

### 1.2 Distribución por sección y módulo

| Sección | Módulo | Preguntas | Tiempo | Desglose oficial (specs) |
|---------|--------|----------:|-------:|--------------------------|
| **Reading & Writing** | Module 1 | **27** | **32 min** | 25 operativas + **2 pretest** (no puntúan) |
| | Module 2 | **27** | **32 min** | 25 operativas + 2 pretest |
| | **Subtotal** | **54** | **64 min** | |
| *(break)* | — | — | **10 min** | No cuenta en los 134 min de test |
| **Math** | Module 1 | **22** | **35 min** | 20 operativas + 2 pretest |
| | Module 2 | **22** | **35 min** | 20 operativas + 2 pretest |
| | **Subtotal** | **44** | **70 min** | |

**Ritmo aproximado:** ~1,2 min/pregunta en R&W · ~1,6 min/pregunta en Math.

### 1.3 Formato de ítems

| Sección | Formato |
|---------|---------|
| R&W | Solo **MC** de 4 opciones (A–D). Pasajes cortos (≈25–150 palabras) por ítem o par. |
| Math | ~**75% MC** + ~**25% SPR** (student-produced response / numérico). Calculadora permitida en **todo** Math (incl. Desmos en Bluebook). |

### 1.4 Adaptatividad y navegación (oficial)

1. **Multistage adaptive por sección.** El Módulo 1 mezcla dificultades. Según el rendimiento en M1, el Módulo 2 es de **mayor o menor** dificultad.
2. Cada módulo tiene **reloj propio**. Al agotarse el tiempo, la plataforma oficial **pasa automáticamente** al siguiente módulo.
3. Dentro de un módulo: libre adelante/atrás y marcar para revisar.
4. **No** se puede volver a un módulo anterior ni arrastrar tiempo sobrante al siguiente.
5. No hay descanso entre M1 y M2 de la misma sección; el único break estándar es el de **10 min** entre R&W y Math.
6. Las **pretest** son indistinguibles para el alumno; no puntúan y sirven al desarrollo del test.

### 1.5 Dominios de contenido (resumen)

- **R&W:** Craft and Structure · Information and Ideas · Standard English Conventions · Expression of Ideas (taxonomía College Board; en producto a menudo se mapea a Section → Domain → Skill).
- **Math:** Algebra · Advanced Math · Problem-Solving and Data Analysis · Geometry and Trigonometry (aprox. 35% / 35% / 15% / 15%).

---

## 2. Qué modela esta plataforma (alineado)

Los Full Practice Tests importados (`Imported Test 1…10`) y la plantilla al crear/promover un full test usan la **misma geometría** que el Digital SAT:

| Dimensión | Oficial | Plataforma | ¿Match? |
|-----------|---------|------------|:-------:|
| Nº módulos | 4 (RW×2 + Math×2) | 4 `FullPracticeTestModule` en ese orden | ✅ |
| Preguntas R&W | 27 + 27 | 27 + 27 en FT cableados | ✅ |
| Preguntas Math | 22 + 22 | 22 + 22 | ✅ |
| Total | 98 | 98 | ✅ |
| Tiempo R&W / módulo | 32 min | `timeLimit = 32 * 60` (1920 s) | ✅ |
| Tiempo Math / módulo | 35 min | `timeLimit = 35 * 60` (2100 s) | ✅ |
| Orden de secciones | R&W → Math | `order` 0..3: RW M1, RW M2, Math M1, Math M2 | ✅ |
| Tipos | MC + SPR Math | `Question.type` `MC` \| `NUMERIC` | ✅ |
| Calculadora en Math | Todo el Math | `MathToolPanel` habilitado si `section === "MATH"` | ✅ |
| Score sección | 200–800 | `FullPracticeTestScoreConversion` + fallback lineal | ✅* |
| Score total | suma de secciones | `rwScore + mathScore` | ✅ |
| Skill / difficulty por módulo | (oficial: adaptativo) | Topic `M1`/`M2` · M1=EASY · M2=HARD | ⚠️ (fijo) |

\* La conversión raw→scaled es **configurable** por admin/teacher (`FullPracticeTestScoreConversion`). Si no hay filas, hay fallback aproximado lineal 200–800 — no es la tabla secreta de College Board.

**Metadata de ítems (mocks Innovators, 2026-08-12):** cada pregunta de FT lleva skill Topic
`M1` o `M2` (Domain `Full Practice Test`, por sección) y difficulty **EASY** (Module 1) /
**HARD** (Module 2 / etiqueta fuente `2B`). Es clasificación de **contenido fijo**, no
adaptatividad en runtime. Helpers: `lib/full-test-modules.ts`; seed de topics:
`scripts/ensure-fulltest-topics.mjs`; backfill: `scripts/backfill-fulltest-module-skills.ts`.

Constantes de plantilla (código):

```ts
// lib/full-test-modules.ts (usado por create + promote-full-test)
{ name: "Reading & Writing Module 1", section: "RW",   moduleKey: "M1", timeLimit: 32 * 60 },
{ name: "Reading & Writing Module 2", section: "RW",   moduleKey: "M2", timeLimit: 32 * 60 },
{ name: "Math Module 1",             section: "MATH", moduleKey: "M1", timeLimit: 35 * 60 },
{ name: "Math Module 2",             section: "MATH", moduleKey: "M2", timeLimit: 35 * 60 },
```

Los mocks Innovators en `dev.db` respetan esta plantilla (verificado 2026-08-11: todos los tests 1–10 en **98/98**, módulos desde Q1).

---

## 3. Comportamiento: oficial vs plataforma

Leyenda: ✅ alineado · ⚠️ parcial / distinto a propósito · ❌ no implementado (gap consciente o pendiente).

### 3.1 Estructura y contenido

| Comportamiento | Oficial (Bluebook) | Plataforma | Estado |
|----------------|--------------------|------------|:------:|
| 4 módulos, 98 ítems, tiempos 32/32/35/35 | Sí | Sí | ✅ |
| Etiqueta de módulo “2B” en materiales mock | En forms oficiales el alumno ve Module 1/2; “2B” es etiqueta de **ruta más difícil** del M2 adaptativo | En staging/ingesta a menudo `moduleLabel=2B` = “Module 2 del PDF”; el FT lo nombra “Reading & Writing Module 2” | ⚠️ |
| Ítems pretest (2 por módulo, no puntúan) | Sí, mezclados | **Sí**: primeras 2 por módulo (`isPretest`); alumno no ve marca; raw RW≤50 / Math≤40 | ✅ |
| Banco adaptativo (dos versiones de M2) | Sí | Un solo set fijo de preguntas por módulo | ❌ |
| Routing M1 → M2 fácil/difícil | Sí | No: siempre el mismo Module 2 | ❌ |

> Implicación pedagógica: un mock “Innovators Test N” con módulo etiquetado `2B` en el PDF es **contenido de dificultad alta** fijo, no un routing adaptativo en runtime. La plataforma lo trata como el Module 2 único del full test.

### 3.2 Timing y control del reloj

| Comportamiento | Oficial | Plataforma | Estado |
|----------------|---------|------------|:------:|
| Reloj por módulo | Sí | Sí (`remaining` + progress state) | ✅ |
| Al llegar a 0: avance forzado al siguiente módulo | Sí (Bluebook mueve solo) | **Sí**: autosave + auto-advance (o break / submit) | ✅ |
| No arrastrar tiempo entre módulos | Sí | Sí (cada módulo tiene su slot) | ✅ |
| Break de 10 min entre R&W y Math | Sí | **Sí**: pantalla break con `breakMinutes` (default 10; no suma a sección) | ✅ |
| Pausar y salir a mitad | En centro: controlado por proctor / Bluebook | **Pause & Exit** con `FullPracticeTestPause` + resume | ⚠️ (útil en práctica; no es paridad de centro) |

### 3.3 Navegación dentro del módulo

| Comportamiento | Oficial | Plataforma | Estado |
|----------------|---------|------------|:------:|
| Ir a cualquier pregunta del módulo | Sí (grid / review) | Solo **Next** secuencial; no hay “Previous” ni mapa de ítems | ⚠️ |
| Volver a módulo anterior | No | No (solo avanza `moduleIndex`) | ✅ |
| Marcar para revisar | Sí | No | ❌ |
| Eliminar opción (strikeout) | Sí (UI Bluebook) | No en el player de full test | ❌ |

### 3.4 Presentación de la pregunta

| Comportamiento | Oficial | Plataforma | Estado |
|----------------|---------|------------|:------:|
| R&W: pasaje + pregunta | Dos columnas típicas | Panel izq. `stimulus` / der. stem+opciones | ✅ (patrón similar) |
| Math: calculadora siempre | Desmos integrado | `MathToolPanel` + config Desmos/env | ✅ (si está habilitado en settings) |
| SPR / NUMERIC | Entrada numérica con reglas de formato | `Input` libre; grading vía `lib/answer-grading.ts` | ⚠️ (reglas de formato SAT no 1:1) |

### 3.5 Puntuación

| Comportamiento | Oficial | Plataforma | Estado |
|----------------|---------|------------|:------:|
| Raw = aciertos en ítems **operativos** | Pretest excluidos | Pretest (`order` 0–1) excluidos del raw/scaled | ✅ |
| Escala 200–800 por sección | Equating / forms | Tabla `FullPracticeTestScoreConversion` o fallback lineal | ⚠️ |
| Total = RW + Math | Sí | Sí | ✅ |
| Penalización por incorrecta | No (desde el SAT moderno) | No | ✅ |

### 3.6 Ciclo de vida del intento

| Comportamiento | Oficial | Plataforma | Estado |
|----------------|---------|------------|:------:|
| Autosave de respuestas | Sí | POST `…/autosave` | ✅ |
| Snapshot inmutable al submit | N/A (form fijo del día) | Answers + scores en `FullPracticeTestAttempt`; preguntas viven en CMS (edits posteriores no re-escriben el intento ya scoreado vía answers guardadas) | ⚠️* |
| Resultados con soluciones | No en el test real | Portal alumno/teacher según `reviewEnabled` / políticas | ⚠️ (modo práctica) |

\* Los practice sets usan snapshots explícitos de enunciado; el full test guarda respuestas por `questionId` y lee el enunciado actual al mostrar resultados — conviene no editar preguntas de un test ya asignado/publicado sin versionar.

---

## 4. Resumen ejecutivo

**Lo que ya está “SAT-shaped” (estructura + pacing):**

- 98 preguntas · 4 módulos · tiempos 32/32/35/35 · orden R&W→Math · MC+NUMERIC · calculadora en Math · scores 200–800 + total.
- Pretest 2/módulo (silencioso) · break 10 min configurable · auto-advance al timeout · timer rojo ≤1 min.

**Lo que es práctica / LMS, no Bluebook:**

- Sin adaptatividad (un solo Module 2 fijo).
- Navegación lineal (Next), con Pause & Exit.
- Conversión de score editable (no equating oficial).

**Uso recomendado del producto:**  
tratar los Full Practice Tests como **mocks de contenido y pacing por módulo** alineados al Digital SAT, no como réplica forense de Bluebook. Para reportes a padres/alumnos, comunicar scores como **estimaciones** según la tabla cargada en la plataforma.

---

## 5. Checklist de paridad

1. ~~**Avance automático** al agotar el tiempo del módulo~~ ✅ (2026-08-12)
2. ~~**Break de 10 min** entre RW M2 y Math M1~~ ✅ (`breakMinutes`)
3. **Navegación intra-módulo** (previous + grid de preguntas + flag) — pendiente
4. (Mayor) **Routing adaptativo** o al menos dos bancos de M2 — pendiente
5. ~~Marca **pretest** excluida del raw score~~ ✅ (`isPretest`, raw 50/40)

Flujo ingest → FPT: [`fpt-ingest-to-standardized.md`](fpt-ingest-to-standardized.md).

---

## 6. Referencias cruzadas en el repo

| Doc / código | Rol |
|--------------|-----|
| Este archivo | Spec oficial ↔ comportamiento plataforma |
| [`procesamientos-ingest.md`](procesamientos-ingest.md) | Cómo se llenó el contenido de los 10 mocks |
| [`fpt-ingest-to-standardized.md`](fpt-ingest-to-standardized.md) | Flujo staging → FPT + estados + pretest/break |
| [`../estructura-documental.md`](../estructura-documental.md) | Estructura de **archivos** de ingesta (no del examen en vivo) |
| `prisma/schema.prisma` → `FullPracticeTest*` | Modelo de datos (`breakMinutes`, `isPretest`) |
| `prisma/seed.demo.ts` | Seed con `32*60` / `35*60` y 27/22 |
| `lib/full-test-modules.ts` | Plantilla 4 módulos + M1/M2 difficulty/topic helpers |
| `lib/full-test-scoring.ts` | Conversión raw operativo → scaled (RW≤50 / Math≤40) |
| `lib/full-test-progress.ts` | Timers + fase BREAK |
| `lib/attempt-progress.ts` | % / posición PS y FPT |
| `scripts/ensure-fulltest-topics.mjs` | Topics placeholder M1/M2 (+ legacy) |
| `scripts/backfill-fulltest-module-skills.ts` | Reasigna skill/difficulty por módulo en Imported Tests |
| `scripts/backfill-fulltest-pretest.ts` | Marca isPretest order&lt;2 |
