# Inventario de procesamientos de ingesta (lo existente)

> **Estado (2026-08-11).** Catálogo de **todo el procesamiento de contenido** ya aplicado
> sobre los Full Practice Tests 1–10 (batch `batch_e877446f45e144eda0a1e4199465e3d2`) y de
> los arreglos de motor/UI relacionados. No sustituye los docs especializados: es el
> **índice operativo** de qué se hizo, con qué, y dónde está el detalle.
>
> Método general: [`ingest-agentic-recovery-strategies.md`](ingest-agentic-recovery-strategies.md)  
> Estructura de archivos/parsers: [`../estructura-documental.md`](../estructura-documental.md)  
> Clasificación de completitud: `lib/ingest-sets.ts` (`classifyQuestion`)

---

## 0. Snapshot actual (verificado en `dev.db`)

### Full Practice Tests — composición de módulos

Todos los `Imported Test 1…10` están en **DRAFT** con la misma forma canónica. Cada módulo
**empieza en Q1**.

| Test | RW M1 | RW M2 | Math M1 | Math M2 | Total |
|------|------:|------:|--------:|--------:|------:|
| 1–10 | 27 @Q1 | 27 @Q1 | 22 @Q1 | 22 @Q1 | **98/98** |

Conjuntos de staging (candidatos `FULL_PRACTICE_TEST`, no rechazados):

| Sección | Por test | Promovidos |
|---------|---------:|-----------:|
| R&W | 54 (27+27) | 54/54 |
| Math | 44 (22+22) | 44/44 |

> **Nota UI.** En la vista de conjuntos, `revisar` = solo críticos (`classifyQuestion`
> level `crit`: sin enunciado / sin respuesta / MC sin opciones). La lista de preguntas
> también marca `warn` (p. ej. opciones parciales 3/4, sin estímulo). Por eso un conjunto
> puede mostrar **2 revisiones** y la lista **3 alertas**.

### Archivos de trabajo (no versionar)

Los scripts one-shot viven en `scratchpad/_tmp/` (montado en el contenedor como
`/app/scratchpad/_tmp/…`). **No** hacer `git add` de scratchpad. Escrituras a `dev.db`
siempre **WAL-safe**: `docker compose stop web` → apply → `wal_checkpoint(TRUNCATE)` →
`integrity_check ok` → `start web` (dejar `ingest-service` arriba).

---

## 1. Índice de documentos de estado (por tema)

| Documento | Qué cubre |
|-----------|-----------|
| [`rw-stimulus-recovery.md`](rw-stimulus-recovery.md) | Recuperación de estímulo R&W T1–10 (split stem, short-stem OCR, Test 1 posicional) |
| [`tests-4-5-7-9-math-completion.md`](tests-4-5-7-9-math-completion.md) | Math T4/5/7/9: opciones, explicaciones, signos NUMERIC, type-fix |
| [`INGEST_PROMOCION_ESTADO.md`](INGEST_PROMOCION_ESTADO.md) | Estado histórico de promoción Practice Set / Full Test |
| [`broken-questions.md`](broken-questions.md) | Lista de pendientes contestables (snapshot; regenerar si se usa como backlog) |
| [`pending-review.md`](pending-review.md) / CSV | Cola de revisión humana |
| [`ingest-image-crop-assign.md`](ingest-image-crop-assign.md) | Crop-assign de imágenes (PDF/DOCX) → candidato |
| [`ingest-ocr-integration.md`](ingest-ocr-integration.md) | Integración OCR Mistral |
| [`review-21-promoted.md`](review-21-promoted.md) | Revisión de un lote promovido |
| Este archivo | **Inventario global de procesamientos** + campañas recientes T6–10 / motor |
| [`sat-digital-estructura-vs-plataforma.md`](sat-digital-estructura-vs-plataforma.md) | Spec Digital SAT (98 Q, tiempos) vs comportamiento del Full Test player |
| [`practice-sets-easy-recovery.md`](practice-sets-easy-recovery.md) | Auditoría Practice Sets EASY Math+R&W (planes agentes 2026-08-11) |

Contratos de agentes (scratchpad, no docs):

- `scratchpad/_tmp/AGENT_CONTEXT_RW_T1_5.md`
- `scratchpad/_tmp/AGENT_CONTEXT_RW_T6_10.md`
- `scratchpad/_tmp/AGENT_CONTEXT_T36_MATH.md`
- Planes JSON: `scratchpad/_tmp/rw-t{N}-plan.json`, `*-math-*-plan.json`, etc.

---

## 2. Procesamientos de contenido (campañas)

Orden aproximado cronológico / por dependencia. Cada fila = un procesamiento **ya
aplicado** (salvo columna Pendiente).

### 2.1 Infra de conjuntos y completitud (producto)

| ID | Qué | Resultado | Commits / artefactos |
|----|-----|-----------|----------------------|
| C-SETS | Conjuntos como grupos lógicos de archivos + rail en review | UI de completitud por conjunto (`revisar`/`atención`/`complete`) | `d982c53`, `ce9914c`, `0309f05`, `06d968b` |
| C-CLASS | `classifyQuestion` única fuente de verdad | Rail, lista y artefacto de review alineados | `lib/ingest-sets.ts` |

### 2.2 R&W — estímulo y opciones (T1–10, fase temprana)

| ID | Qué | Resultado | Detalle |
|----|-----|-----------|---------|
| RW-STIM-SPLIT | Split `stem`→`stimulus`+prompt (Tests 2–10) | Pasajes sacados del stem sin re-parse ciego | Audit `SPLIT_RW_STIMULUS_FROM_STEM` · [rw-stimulus-recovery](rw-stimulus-recovery.md) |
| RW-STIM-SHORT | Short-stem vía OCR anclado + validación por prompt | +107 estímulos | `RECOVER_RW_STIMULUS_SHORTSTEM` |
| RW-T1-POS | Test 1 promovido del docx de explicaciones → remap posicional | Estímulo + opciones desde docx de preguntas | `RECOVER_RW_STIMULUS_POSITIONAL` / `OPTIONS_POSITIONAL` |
| RW-T1-IMG | Imágenes de página del docx → preguntas image-only T1 | Galería + attach | `ddec300`, `d6fe138` |
| RW-T2-Q12 | Estímulos T2 Q1/Q2 desde OCR del PDF | Candidato/oficial | `c4b3037` |
| RW-OPTS-SYNC | Sync opciones recuperadas → oficiales | Opciones en `QuestionOption` | `a56b505`, `fca5ce8` |
| RW-TYPE | Corrección sistémica de tipo R&W mal etiquetado | Tipos alineados | `c04ab10` |

### 2.3 Math — completado por test

| ID | Qué | Resultado | Detalle |
|----|-----|-----------|---------|
| M-T6 | Math Test 6 desde answer-explanations | Test completo | `4dd1127` |
| M-T10 | Math Test 10 (OCR + materialización) | Contenido Math T10 | `b40c233`, scripts `apply-t10-math.mjs` / `run-t10-math-ocr.mjs` |
| M-T3-6 | Math Tests 3 & 6 + stem header-dump | Completados + limpieza stems | `090c43b` |
| M-T4-5-7-9 | Agentes Math en paralelo → apply WAL-safe | 120 explicaciones · 92 sets de opciones · 1 figura | [tests-4-5-7-9-math-completion](tests-4-5-7-9-math-completion.md) |
| M-ANS-FIX | Correcciones retenidas vs ANS KEY (signos, type-fix, tablas) | 11 correcciones aplicadas | mismo doc §2 |
| M-CROP-PROP | Propagación crop-assign → oficial | Imagen en `Question.imageUrl` / opciones | `e571fa6` |

### 2.4 Explicaciones (sistémico)

| ID | Qué | Resultado | Commits |
|----|-----|-----------|---------|
| EX-STRIP | Strip de header/preámbulo del dump de explicaciones | Explicaciones sin basura de portada | `7efff28` |
| EX-DIST | Redistribuir explicaciones R&W por-pregunta vacías tras el strip | Una explicación por ítem | `e958720` |

### 2.5 R&W Tests 6–10 — recuperación agéntica (2026-08-11)

Pipeline: diagnóstico `rwkit` → 5 agentes read-only (planes `rw-t6…t10-plan.json`) →
fills `SET_OPTIONS`/`SET_STIMULUS` → relleno candidatos `NEEDS_PROMOTION` → promoción vía
servicio → commit `dev.db`.

| ID | Qué | Resultado | Artefactos |
|----|-----|-----------|------------|
| RW610-FILL | Apply fills T6/T7/T9/T10 (+ par T8 promovido) | ~93 `SET_OPTIONS` + 32 `SET_STIMULUS` | `apply-rw.mjs`, `f616490` |
| RW610-CAND | Fill candidatos `NEEDS_PROMOTION` (T8×52 + T10 `2B:12`) | stem/stimulus/options en staging | `fill-candidates-needs-promotion.mjs` |
| RW610-PROMO | Promoción T8 + residual T10 | T8 FT **98/98**; T10 quedó parcial hasta Q1/Q2 | `f616490` |
| RW610-MISMATCH | Bug plan T9: `1:20` apuntaba a oficial de `2:10` | Corregido ambos slots | `fix-t9-1-20-2-10.mjs` |

**Diferido en esa campaña (ver §4):**

- `FIX_ANSWER` T8 `2B:1` (luego la clave en BD quedó B; revalidar si hace falta).
- `NEEDS_HUMAN` originales: T7 huecos / T10 `2B:27` parcial — varios se resolvieron en
  pasadas posteriores (T7 M2 Q1/Q2 creados; T10 Q1/Q2 recuperados 2026-08-11).

### 2.6 Defectos sistémicos de stem / opciones (post T6–10)

| ID | Qué | Resultado | Artefactos |
|----|-----|-----------|------------|
| STEM-OPTBLK | Bloque `☒/☐ A–D` embebido en `stem` (OCR) | 132 stems oficiales + 131 candidatos limpios; parser en motor | `fix-embedded-option-blocks.mjs`, `stripEmbeddedOptionBlock()` en `lib/ingest-promotion.ts`, `a115354` |
| T3-DIST | Distractores T3 truncados / con elipsis | 7 opciones restauradas desde OCR | `fix-t3-distractors.mjs`, `322f581` |

### 2.7 Imágenes candidato → oficial

| ID | Qué | Resultado | Artefactos |
|----|-----|-----------|------------|
| IMG-PROP-CROP | `crop-region` ya propagaba | Oficial recibe crop | ruta crop |
| IMG-PROP-LINK | `POST …/image-links` **no** propagaba | Fix: llama `propagateAssignedImageToOfficial`; también acepta `STIMULUS` → `Question.imageUrl` | `app/api/admin/ai-import/candidates/[candidateId]/image-links/route.ts`, `lib/ingest-promotion.ts` |
| IMG-BACKFILL | Backfill de links ya asignados | 15 links propagados (T8/T9/T10 entre ellos) | `propagate-image-links.ts` |
| T10-TEXT | T10 `2B:14` opción A + `2B:27` C/D desde candidato | Oficial alineado | `propagate-t10-latest.ts` |

### 2.8 Completitud de módulos / preguntas ausentes (2026-08-11)

| ID | Qué | Resultado | Artefactos |
|----|-----|-----------|------------|
| T4-ANS | T4 RW `2:12` y `2:24` sin `correctAnswer` | Cruzadas con ANS KEY → **C**; promovidas; cableadas a FT M2 | `fix-t4-rw-answers.ts` |
| T4-WIRE | FT T4 RW M2 tenía 25 (faltaban 12 y 24) | Reordenado `order = qn−1` → 27/27 | script + SQL WAL-safe |
| T10-Q12 | T10 RW `2B:1` y `2B:2` **ausentes** (página 19 = imagen embebida Im30/Im31) | Candidatos + links `OPTION_BLOCK` + promovidos + FT M2 rewire Q1…Q27 | `fix-t10-rw-2b-q1q2.ts` |
| T7-Q12 | T7 RW M2 Q1/Q2 (histórico NEEDS_HUMAN) | Ya presentes 27/27 en FT (creados en pasada previa) | `create-t7-m2-q1q2.mjs` |

Contenido recuperado T10 `2B:1` / `2B:2` (desde PNG del PDF, no OCR de texto):

| Q | Ans | Opciones |
|---|-----|----------|
| `2B:1` | B | A energizing · B inefficacious · C varied · D synthetic |
| `2B:2` | A | A incensed · B dispassionate · C delirious · D bemused |

Asociación a archivos del conjunto:

- `sourceFileId` = PDF `INNOVATORS TEST 10 RW 1, 2B.pdf`
- `pageArtifactId` = página 19
- `IngestCandidateImageLink` → Im30 / Im31 (`OPTION_BLOCK`)
- `IngestPromotionArtifact` `groupKey` = `T10|RW|2B|{n}`

---

## 3. Procesamientos de motor (código reutilizable)

Estos quedan en el runtime; no son one-shots.

| Componente | Función | Archivo |
|------------|---------|---------|
| `sanitizeStem` / `stripEmbeddedOptionBlock` | Quita bloque A–D embebido del stem en promoción | `lib/ingest-promotion.ts` |
| `sanitizeExplanation` | Limpia headers de dump de explicaciones | idem |
| `buildQuestionDraft` | Draft oficial desde candidato + image links | idem |
| `propagateAssignedImageToOfficial` | Copia imagen asignada (STEM/STIMULUS/OPTION…) al oficial | idem |
| `computeConjuntos` | Agrupa archivos → filas de completitud | `lib/ingest-sets.server.ts` |
| `classifyQuestion` | crit/warn/ok por campos | `lib/ingest-sets.ts` |
| Crop + OCR de región | Recorte unificado PDF/DOCX | rutas `crop-region`, docs crop-assign |
| Parser canónico A–D (crop OCR) | Opciones desde texto OCR de crop | commits `67d24a7`+ |
| Re-sync post-edición | Candidato editado tras promoción → oficial | `1618667` |

---

## 4. Residuales conocidos (aún pendientes)

No bloquean la **composición** 98/98 de módulos, pero sí la calidad contestable / publicación.

| Ítem | Severidad | Notas |
|------|-----------|-------|
| T4 RW `2:27` | warn · opciones **3/4** | Falta D; OCR de esa página corta en C. Requiere crop/OCR del PDF |
| T9 Math `2B:4` | opciones = gráficas | Ans `B` OK; falta enlazar 4 `QuestionOption.imageUrl` vía crop-assign |
| Estímulos R&W residuales (tabla/gráfico) | warn | Lista histórica en [rw-stimulus-recovery](rw-stimulus-recovery.md) §pendiente; muchos ya mitigados en T6–10 |
| Practice Sets parciales | variable | Ver [broken-questions](broken-questions.md) (p. ej. Equivalent Expressions EASY 18/21) |
| `broken-questions.md` | doc | Snapshot **2026-08-10**; regenerar antes de usarlo como backlog vivo |
| Fix image-links (código) | repo | Cambio local de propagación puede estar sin commit si no se pidió |

---

## 5. Catálogo de scripts one-shot (`scratchpad/_tmp/`)

### Aplicadores / recovery

| Script | Rol |
|--------|-----|
| `apply-rw.mjs` | Aplica planes R&W (`SET_OPTIONS` / `SET_STIMULUS`; respeta `NO_FIX_ANSWER`) |
| `apply-math-agentplan.mjs` / `apply-math-corrections.mjs` | Math desde plan de agente / correcciones ANS KEY |
| `apply-t10-math.mjs` / `apply-t36-math.mjs` / `apply-t10.mjs` | Math por test |
| `fill-candidates-needs-promotion.mjs` | Rellena staging antes de promover |
| `fix-embedded-option-blocks.mjs` | Limpia ☒/☐ del stem (oficial + candidato) |
| `fix-t3-distractors.mjs` | Restaura distractores T3 |
| `fix-t4-rw-answers.ts` | Cruza ANS KEY T4 `2:12`/`2:24` + promote |
| `fix-t10-rw-2b-q1q2.ts` | Crea/promueve/cablea T10 `2B:1`/`2B:2` |
| `fix-t9-1-20-2-10.mjs` | Corrige mismatch de IDs oficiales T9 |
| `propagate-image-links.ts` / `propagate-t10-latest.ts` | Backfill imágenes / texto T10 |
| `create-t7-m2-q1q2.mjs` | Alta T7 M2 Q1/Q2 |
| `clean-stem-headers.mjs` / `clean-expl-headers.mjs` | Limpieza sistémica |
| `distribute-rw-expl.mjs` | Reparte explicaciones R&W |

### Diagnóstico

| Script | Rol |
|--------|-----|
| `diag-needs-promotion.mjs` | Inventario `NOT_PROMOTED` |
| `report-doubtful.mjs` / `report-doubtful2.mjs` | Entradas dudosas de planes |
| `check-opt-parity.mjs` | Paridad opciones candidato vs plan |
| `rwopts.ts` / `rwstim.ts` / `t8diag.ts` / `t10-diag.ts` | Inspección ad hoc |

### Planes JSON (entrada de agentes)

`rw-t1-plan.json` … `rw-t10-plan.json`, `t3-math-plan.json`, `t4/t5-math-agentplan.json`,
`t6m1/m2b-math-plan.json`, `cand-plan.json`, `fig-plan.json`, etc.

---

## 6. Cómo añadir un procesamiento nuevo (checklist)

1. Diagnosticar con evidencia de fuente (PDF/docx/ANS KEY), nunca adivinar.
2. Dry-run del script (`MODE` distinto de `APPLY`).
3. Apply WAL-safe (parar solo `web`).
4. `PRAGMA integrity_check` → `ok`.
5. Verificar composición de módulo (empieza en Q1, tamaño 27/27/22/22) y conteo de conjunto.
6. Documentar aquí (§2 nueva fila) + detalle en el doc temático si aplica.
7. Commit/`dev.db` **solo si el usuario lo pide**.

---

## 7. Relación rápida “síntoma UI → causa ya vista”

| Síntoma | Causa típica | Procesamiento |
|---------|--------------|---------------|
| Conjunto 2 crit / lista 3 alertas | crit = sin respuesta; warn = opciones parciales | T4-ANS + residual `2:27` |
| Módulo empieza en Q3 | Preguntas ausentes del staging (página imagen) | T10-Q12 |
| Stem muestra A–D duplicados | OCR pegó bloque ☒/☐ en stem | STEM-OPTBLK |
| Imagen en review pero no en alumno | `image-links` sin propagar | IMG-PROP-LINK |
| MC sin botones / opciones vacías | Opciones solo en imagen | Math/RW fills + crop-assign |
| Respuesta NUMERIC con signo perdido | OCR ANS KEY | M-ANS-FIX |
