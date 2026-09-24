# QA de contenido — Practice Sets READING: Text Structure and Purpose + Central Ideas and Details (publicado vs fuente)

- **Fecha:** 2026-09-24
- **Topics:** Text Structure and Purpose · Central Ideas and Details (Craft and Structure + Information and Ideas; Section `READING_WRITING`)
- **Alcance:** 6 sets · 96 preguntas (todas MC A–D, single-passage, PDF-sourced, ingest-linked)
- **Estado:** Solo lectura (detección). No se modificó BD ni contenido oficial.

## Método
- Carga vía `resolveReadingPracticeSets` + `filterSets` (`scripts/qa/practice-common.mjs`), BD `openDb()` en modo `readonly`.
- Ground truth = `sourceText` (`IngestQuestionCandidate.rawJson.text`, el bloque exacto de la fuente con "Question ID / Question / Answer").
- Comparación por pregunta de `stimulus` + `stem` + cada `option.text` contra `sourceText` (truncamiento, drift de opciones, dup stimulus→stem, leaks UI/`[tema]`, encoding, curly/replacement chars, número de pregunta prependido).
- Barrido automatizado de fidelidad por substring (stimulus/stem/opciones normalizados —quitando marcadores `++` y colapsando saltos de línea— deben ser substring exacto de `sourceText`).
- Verificación **completa** (no muestreo) de `correctAnswer` contra el PDF `ANS …` de cada set (`Question ID: <hex>` → `Correct Answer: X`).

## Resultado global
- **Claves de respuesta: 96/96 correctas** vs los ANS PDFs (0 mismatch, 0 missing). Confirma el pre-scan (529/529).
- **Fidelidad de texto: 95/96 preguntas byte-fieles** al `sourceText`. Un único hallazgo cosmético (apóstrofo recto vs tipográfico) en 1 pregunta.
- Los "truncation_suspect" del pre-scan (TS EASY seq3/5/6/8/10/16, TS HARD seq6/14, CI HARD seq8/11) son **falsos positivos**: en todos, el `stimulus` publicado reproduce íntegro el pasaje fuente. El pre-scan comparaba longitudes contra `sourceText`, que incluye además las cabeceras "Question/Answer" y las 4 opciones, por lo que el stimulus siempre resulta mucho más corto.
- Corchetes editoriales (`[banter]`, `[informed that he was]`, `[visits]`, `[hurry]`, `[Begin]`, `[Coketown]`, `[Bill]`, `[stay]`, `[all]`, `[Mr. Ely]`) están presentes también en la fuente SAT → no son leaks. Comillas curvas y subíndices (CO₂, WASP-39b) coinciden con la fuente.

## Hallazgos por set

### Text Structure and Purpose - EASY (setId=cmsjropmd06anqmt1iij9jlon)
Sin incidencias. _(seq1-17 sin incidencias — claves 17/17 OK)_

### Text Structure and Purpose - MEDIUM (setId=cmsjropi706ajqmt1kimtfahb)
Sin incidencias. _(seq1-17 sin incidencias — claves 17/17 OK)_

### Text Structure and Purpose - HARD (setId=cmsjropka06alqmt1fjrq2fv7)
Sin incidencias. _(seq1-14 sin incidencias — claves 14/14 OK)_

### Central Ideas and Details - EASY (setId=cmsjropb806afqmt1ilt42wgg)
Sin incidencias. _(seq1-16 sin incidencias — claves 16/16 OK)_

### Central Ideas and Details - MEDIUM (setId=cmsjrope206ahqmt15nc3w2rc)
Sin incidencias. _(seq1-15 sin incidencias — claves 15/15 OK)_

### Central Ideas and Details - HARD (setId=cmsjrop8606adqmt1lk3ro00p)
Un hallazgo cosmético (severidad Baja); resto sin incidencias.

`cmsjro3yr04h0qmt1x8qfo7xk | Central Ideas and Details HARD | seq5/p5 | class=encoding_mangle | sev=Baja | current: opciones B y D con apóstrofo recto ("the report's findings", "researchers' inordinate focus") | expected: apóstrofo tipográfico como en la fuente ("report's", "researchers'") | action: normalizar ' → ' en B/D (cosmético; no altera significado ni corrección; el resto de la misma pregunta ya usa comillas curvas)`

_(seq1-4, seq6-17 sin incidencias — claves 17/17 OK)_

## Resumen de defectos

| class | sev | count | sets afectados |
|---|---|---|---|
| encoding_mangle (apóstrofo recto vs tipográfico, cosmético) | Baja | 1 | Central Ideas and Details HARD (seq5) |
| **Total defectos** | | **1** | de 96 preguntas |

**Sin defectos** de: `broken_question`, `stimulus_truncated`, `stimulus_wrong`, `stimulus_bleed`, `stimulus_dup_in_stem`, `option_text_wrong`, `option_truncated`, `option_dup`, `stem_option_leak`, `option_label_leak`, `stem_annotation_leak`, `ui_leak`, `escaped_underscore`, `answer_key_wrong`, `type_mismatch`.
