> **Estado (2026-08-12).** Documento histórico (2026-08-07) + **actualización de realidad**.
> Los 10 Imported Tests ya están promovidos (98/98 DRAFT). Flujo canónico actual:
> [`fpt-ingest-to-standardized.md`](fpt-ingest-to-standardized.md).
> El texto original debajo se conserva como auditoría; **no** usar la afirmación
> “promoción en STANDBY / contenido oficial en 0” como estado vigente.

# Ingesta → Promoción: estado, viabilidad y trabajo pendiente

> Evaluación al **2026-08-07** sobre el batch `batch_e877446f45e144eda0a1e4199465e3d2`
> (`SAT files_to_load ingest`, 2 549 candidatos). ~~La **promoción sigue en STANDBY**:
> el contenido oficial (`Question`, `PracticeSet`, `FullPracticeTest`) está en 0~~
> **Actualizado 2026-08-12:** Full Practice Tests 1–10 ensamblados; Practice Sets
> también promovidos en campañas posteriores. Ver `procesamientos-ingest.md`.

## Modelo de Extracted Test (archivo de pregunta + archivo ANS/explanation)

Un **Extracted Test** no es una entidad explícita en BD: se **infiere por carpeta + nombre de archivo**
(`ingest_service/app/main.py::infer_metadata`). Verificado a nivel de archivo:

| Tipo | Archivo de preguntas | Archivo de respuestas | Pareo |
|------|----------------------|-----------------------|-------|
| **Practice** | 91 `PRACTICE_EXERCISE` | 91 `ANSWER_KEY` (1:1) | por `questionExternalId` (Question ID) |
| **Mock/Full test** | 20 `MOCK_EXAM` | 20 `ANSWER_EXPLANATION` + 9 `ANSWER_KEY` | por `(testNumber, sección, questionNumber, moduleLabel)` |

- El archivo de preguntas genera los `IngestQuestionCandidate`; el archivo de respuestas
  **no genera candidatos** (`isAnswerFile`) pero **enriquece** `correctAnswer`/`explanation`
  (`enrich_candidates_from_answers`). Práctica: 1 596/1 607 con `answerSource=ANS_PDF`.
- **Unidad de promoción**:
  - Practice Set → **1 `sourceFileId`** (el archivo de preguntas), ordenado por `questionNumber`.
  - Full Test → **1 `testNumber`** (4 módulos: RW1, RW2, Math1, Math2).
- **Cómo importar un Extracted Test**: subir ambos archivos al mismo batch/carpeta
  (`/batches/upload-sources` o `/batches/upload-zip`). La misma carpeta hace que Q y ANS
  compartan Section/Domain/Skill/Difficulty; el enriquecimiento los enlaza.
- **Punto débil**: todo depende del layout de rutas (`PRACTICE EXERCISES/…`,
  `MOCK EXAMS/TEST N/…`) y de que el ANS comparta Question ID (práctica). Un Extracted Test fuera de
  ese layout, o un ANS sin Question ID, cae a heurística de *fallback* y hay que revisar la
  taxonomía/pareo a mano.

## Viabilidad de la promoción (validación en seco, sin promover)

Simulando `lib/ingest-promotion.ts::resolveTopicFromCandidate` + los *gates* de las rutas
`promote-questions`/`promote-practice-set`/`promote-full-test` contra la BD:

### Practice Sets — VERDE (con 1 salvedad)

| Chequeo | Resultado |
|---|---|
| `contentType=PRACTICE_SET` | 1 607/1 607 |
| READY/REVIEWED | 1 596 (11 NEEDS_REVIEW = fragmentos) |
| stem + correctAnswer | 1 596/1 596 |
| **Topic resuelve** (Section→Domain→Skill) | **1 607/1 607 → sin crash de FK** |
| respuesta MC ∈ A–D | 1 596/1 596 |
| **1 solo topic por archivo** | **91/91** |
| orden del set | por `questionNumber` (numeración reparada) |

**Salvedad:** ~**290 preguntas MC image-backed** (opciones = tablas/gráficos, sin texto) y
**0 tienen las 4 imágenes de opción vinculadas**. Como la promoción crea en `DRAFT` y
`validateQuestionPayload` solo exige opciones al **publicar**, se promoverían como MC **sin
opciones** (inservibles hasta completarse). Ver §"Trabajo pendiente".

### Full Practice Tests (mock exams) — AMARILLO (7/10 completos)

Agrupados por `testNumber`, esperado 27/27/22/22 por módulo:

- **Completos:** TEST 2, 3, 4, 5, 6, 8, 9.
- **TEST 1:** faltan **ambos módulos R&W** (RW1=0, RW2=0).
- **TEST 7 y 10:** RW2 = 25/27.
- **TEST 6 y 8:** sobra 1–2 en Math (23/24 vs 22) → posibles duplicados / mala asignación de módulo.

Promocionables con `allowPartial`, pero conviene revisar TEST 1 y los sobre-conteos antes.

## Smoke-test de promoción (ejecutado y revertido)

Prueba end-to-end **real** vía HTTP (sesión ADMIN) sobre un Extracted Test limpio:
`PRACTICE EXERCISES/EXERCISES MATH/PROBLEM SOLVING DATA ANALYSIS/ONE VARIABLE DATA/One Var. Data HARD.pdf`
(4 preguntas: 3 NUMERIC + 1 MC).

1. `POST …/promote-questions {candidateIds:[4]}` → `promoted:4, skipped:0, errors:[]`.
2. `POST …/promote-practice-set {sourceFileId}` → PracticeSet `"Problem Solving and Data Analysis - One-Variable Data - HARD"`, DRAFT, 4 preguntas, `partial:false`.

**Verificación:** 4 `Question` (topic `top-one-var-data`, difficulty `HARD`), el MC con 4
`QuestionOption` A–D y `correctAnswer=B`, los NUMERIC sin opciones con respuestas 0/2/41,
orden del set 0–3 = `questionNumber` 1–4, candidatos marcados `PROMOTED`, `IngestPromotionArtifact`
(PRACTICE_SET=1, QUESTION=4). **La promoción construye preguntas bien formadas.**

**Rollback:** restaurado `dev.db` desde snapshot pre-test + purga de WAL. Estado final:
`Question=0, PracticeSet=0, PromotionArtifact=0, PROMOTED=0`, staging intacto (2 549).
Punto de commit-restauración: **`440c657`** (dev.db limpio vs HEAD tras revertir).

## Trabajo pendiente (STANDBY — NO ejecutar sin decisión)

### (2) Opciones image-backed (~290 MC de práctica)

De las 290 preguntas MC cuyas opciones son imágenes (sin texto):

- **116** tienen **≥4 imágenes en su propia página** → asignables como opción con el endpoint
  del wizard `POST /candidates/{id}/parse-option-image` (semi-automatizable).
- **173** tienen **0 imágenes en su página** (existen a nivel de archivo — 281/290 tienen ≥4 en
  el archivo — pero el *linking pass* las asoció a otra página) → requieren **re-enlace** de
  imagen↔página o **transcripción manual**.
- **1** con imágenes parciales (<4).

**Opciones de solución:**
- Mejorar el *assisted image-linking pass* para asociar imágenes a la página/candidato correcto
  (hoy produce enlaces STEM/PAGE_CONTEXT pero casi ningún OPTION para estos casos).
- Flujo de wizard para asignar las 4 imágenes de opción por candidato (usa `parse-option-image`).
- Guardrail: reclasificar los image-backed a `NEEDS_REVIEW` para que no promuevan como MC vacío
  (hoy están READY porque tienen stem+answer; conviene bloquearlos hasta tener opciones).

### (3) Estado y decisión de promoción

- **Practice:** ~1 300 preguntas listas para promover limpias; ~290 esperan trabajo de imágenes.
  El flujo funciona (topic 100%, orden correcto, estímulo separado) — ver smoke-test.
- **Full tests:** promover con `allowPartial`; corregir TEST 1 (R&W) y sobre-conteos de Math 6/8.
- **Se mantiene en STANDBY** hasta decidir. La lógica de promoción (`lib/ingest-promotion.ts`,
  rutas `promote-*`) queda intacta y **no invocable desde el seed**.

## Cómo re-ejecutar el smoke-test (reversible)

```bash
# 1) backup
cp dev.db /tmp/dev.db.bak
# 2) login ADMIN (cookie jar) → promote-questions → promote-practice-set
#    (ver comandos en el historial; batch=batch_e877446f45e144eda0a1e4199465e3d2)
# 3) verificar Question/PracticeSet/PromotionArtifact
# 4) ROLLBACK
cp -f /tmp/dev.db.bak dev.db && rm -f dev.db-wal dev.db-shm
```

---

# Auditoría de la lista "Review" (caso por caso) — 2026-08-07

## Cobertura y completitud del staging (2549 candidatos, 1 batch)

**Practice Sets — 91 Extracted Tests, 30 skills, agrupación limpia** (0 archivos con topic o
dificultad mezclados):

- **29/30 skills tienen Easy + Medium + Hard completos.**
- **1 incompleto:** `Math · Problem Solving · One-Variable Data: Distributions and Measures`
  → solo HARD (20), sin Easy/Medium. Parece nombre de skill duplicado/partido de
  "One-Variable Data" (que sí tiene E/M/H). Revisar taxonomía.

**Calidad de las 1607 preguntas de práctica** (parse preciso del `optionsJson`):

| Estado | # | Nota |
|---|---|---|
| MC con 4 opciones de texto (OK) | 1114 | bien formadas |
| NUMERIC (sin opciones, correcto) | 178 | bien formadas |
| **MC image-backed (opciones vacías)** | **290** | ⚠️ todo MATH: las opciones son tablas/gráficos no transcritos |
| MC con <4 opciones de texto | 20 | parciales |
| MC con menos de 4 opciones | 5 | revisar |

**Full Practice Tests — 5/10 exactos** (esperado RW1=27 RW2=27 M1=22 M2=22):
TEST 2, 3, 4, 5, 9 OK · TEST 1 sin R&W (0/0) · TEST 6 sobra Math (23/23) ·
TEST 7 RW2=25 · TEST 8 Math1=24 · TEST 10 RW2=25.

## De dónde sale la lista al pulsar "Review"

No hay endpoint REST dedicado. La lista la arma el server component
`app/admin/import/ai/page.tsx`:

```ts
prisma.ingestQuestionCandidate.findMany({
  where: { batchId }, orderBy: [{ status: "asc" }, { confidence: "desc" }], take: 300,
})
```

El diálogo "Review Staging Content" (`ai-import-client.tsx`) filtra esa prop en cliente.
`GET /api/admin/ai-import/batches` solo devuelve conteos por batch, **no** candidatos.

⚠️ **Limitación de diseño: `take: 300` sobre 2549.** Como ordena `status asc`, la lista =
**148 NEEDS_REVIEW + 152 READY de mayor confianza**. El diálogo **nunca alcanza** la mayor
parte del contenido READY de práctica; solo se ve lo problemático + un puñado de READY.

## Veredicto de los 300 casos de la lista

(Clasificación completa fila-a-fila en `docs/ingest-review-list-analysis.csv`.)

| Veredicto | # | Significado |
|---|---|---|
| OK | 20 | promovible sin tocar |
| MINOR | 105 | promovible con warning/ajuste menor |
| BLOCKED | 156 | no promovible: sin respuesta u opciones-imagen vacías |
| BROKEN | 19 | fragmento sin Question ID / stem roto |

### Los 148 NEEDS_REVIEW

**A) Full tests sin respuesta detectada (121)** — problema dominante; el answer key no cruzó:

| Test | Sin respuesta | Nota |
|---|---|---|
| **TEST 8** (Math+R&W) | **94 / 100** | test casi entero sin respuestas |
| TEST 10 | 22 / 96 | Math 21 + R&W 1 |
| TEST 6 | 3 / 100 | |
| TEST 4 | 2 / 98 | |
| TEST 1,2,3,5,7,9 | 0 | ✅ respuestas cruzaron |

Muchos con `Answer field image detected; treated as numeric response visual` → la respuesta
del ANS es **imagen**, el OCR no la resolvió (mismo patrón image-backed, del lado respuesta).

**B) Fragmentos/otros de práctica (27):**
- **Equivalent Expressions: 7** → `NO_QUESTION_ID` + sin respuesta = basura de segmentación → fusionar/rechazar.
- One-Variable Data: Distributions and Measures 2, Linear Functions 2 → sin respuesta.
- Resto (Command of Evidence 3, Area and Volume 1, Ratios 2, …) **sí tienen respuesta**;
  están en NEEDS_REVIEW por flag de imagen/opciones, no por rotura.

### Los 152 READY (los que sí promoverían)

| | # | Efecto al promover |
|---|---|---|
| Limpios | 71 | bien (51 solo con warning informativo) |
| Opciones-imagen vacías (MC) | 33 | MC sin alternativas visibles |
| Respuesta MC no A–D | 20 | tipo/respuesta mal (probable NUMERIC mal etiquetado) |
| NUMERIC con respuesta no numérica | 21 | respuesta inválida |
| Opciones parciales (<4) | 5 | incompleta |
| Opciones duplicadas | 2 | revisar |

### Ruido: warnings obsoletos

`"Correct answer not detected."` figura en **92 candidatos READY que SÍ tienen respuesta**
(se enriqueció después desde el ANS pero **el warning nunca se limpió**). El wizard muestra
alarmas rojas ya falsas → sensación de "no mejora" aunque el dato esté bien.
**Es bug de limpieza de warnings, no de contenido.**

## Acciones pendientes priorizadas (STANDBY — documentado, NO ejecutado)

1. **Limpiar warnings obsoletos** tras enriquecimiento (`Correct answer not detected` cuando
   ya hay `correctAnswer`). Alto impacto, bajo riesgo.
2. **Destopar/paginar** la lista de Review (`take: 300` → paginación o filtro server-side);
   hoy es imposible triar los 2549 desde la UI.
3. **Re-cruzar answer key de TEST 8 y TEST 10** (respuestas como imagen en el ANS → OCR/transcripción).
4. **290 opciones-imagen** de práctica (frente #2 ya conocido).
5. **Rechazar/fusionar** los 7 fragmentos de Equivalent Expressions y demás sin Question ID.

## Producción

El staging **reparado** (parser estructural: numeración 1..N/archivo, enunciados limpios,
opciones separadas, estímulo R&W) se empujó a `https://satsol.org` el 2026-08-07 con
`deploy/push-db-to-cloud.sh` (backup de prod previa en `gs://…/backups/pre-push-*`). Verificado
en la VM: 0 fugas de cabecera, 1607 numeradas, 101 con estímulo, `Question=0` (promoción sigue
en STANDBY). Los puntos de arriba aplican igual a prod (mismo staging).
