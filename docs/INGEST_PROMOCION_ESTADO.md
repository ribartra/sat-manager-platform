# Ingesta → Promoción: estado, viabilidad y trabajo pendiente

> Evaluación al **2026-08-07** sobre el batch `batch_e877446f45e144eda0a1e4199465e3d2`
> (`SAT files_to_load ingest`, 2 549 candidatos). La **promoción sigue en STANDBY**:
> el contenido oficial (`Question`, `PracticeSet`, `FullPracticeTest`) está en 0 y así se queda
> hasta decidir promover en serio. Este documento registra qué funcionaría y qué falta.

## Modelo de "conjunto" (archivo de pregunta + archivo ANS/explanation)

El "conjunto" no es una entidad explícita: se **infiere por carpeta + nombre de archivo**
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
- **Cómo importar un conjunto**: subir ambos archivos al mismo batch/carpeta
  (`/batches/upload-sources` o `/batches/upload-zip`). La misma carpeta hace que Q y ANS
  compartan Section/Domain/Skill/Difficulty; el enriquecimiento los enlaza.
- **Punto débil**: todo depende del layout de rutas (`PRACTICE EXERCISES/…`,
  `MOCK EXAMS/TEST N/…`) y de que el ANS comparta Question ID (práctica). Un conjunto fuera de
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

Prueba end-to-end **real** vía HTTP (sesión ADMIN) sobre un conjunto limpio:
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
