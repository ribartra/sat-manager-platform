# QA de contenido — Reading Practice Sets: Inferences + Cross-Text Connections (publicado vs fuente)

- **Fecha:** 2026-09-24
- **Topics:** Inferences · Cross-Text Connections (todas las dificultades)
- **Alcance:** 6 sets · 88 preguntas (Cross-Text: EASY 15 + HARD 12 + MEDIUM 9 = 36; Inferences: EASY 13 + HARD 26 + MEDIUM 13 = 52)
- **Sección:** `READING_WRITING` · dominios `Information and Ideas` + `Craft and Structure` · todas MC (A–D), PDF-sourced, ingest-linked.
- **Método:** comparación pregunta-por-pregunta de `stimulus` + `stem` + cada `option.text` publicados contra `sourceText` (bloque fuente exacto, ground truth) vía `resolveReadingPracticeSets`. Cross-check total de `correctAnswer` (88/88) contra las claves ANS por hex `Question ID`. Barridos automáticos de: replacement-char, escaped-underscore, ui_leak, `[tema/respuesta]`, prefijo numérico en stem, option-label-leak, conteo/duplicado de opciones, presencia de etiquetas `Text 1`/`Text 2` (Cross-Text) y del blank `______` (Inferences), y consistencia marcador `++subrayado++` ↔ stems que citan "underlined portion". Solo lectura.
- **Nota estructural — Cross-Text = doble pasaje:** cada ítem lleva DOS pasajes `Text 1` y `Text 2` seguidos de una pregunta comparativa. Riesgo especial verificado: que ambos textos (con sus etiquetas) sobrevivan a la promoción.

## Resultado global

**Corpus limpio: 0 defectos en las 88 preguntas.**

- **Integridad doble-pasaje (Cross-Text, 36/36):** las 36 preguntas conservan `Text 1` Y `Text 2` con sus etiquetas intactas en el `stimulus`. Cero casos de texto faltante, textos fusionados sin etiqueta, o pasaje truncado.
- **Blanks (Inferences, 52/52):** el `stimulus` de cada ítem termina/contiene el blank `______` en la posición correcta que corresponde al `sourceText`; stem = "Which choice most logically completes the text?" (o variante equivalente presente en fuente).
- **Claves de respuesta (88/88):** todas coinciden con las claves ANS (`ANS DOUBLE PASSAGE {EASY,HARD,MED}.pdf`, `ANS INFERENCES {EASY,MED}.pdf`, `ANS Inferences Hard.pdf`). 0 mismatches.
- **Opciones:** las 4 opciones de cada ítem coinciden literalmente con el bloque `Answer` del `sourceText`; sin drift de redacción, sin fronteras mal cortadas, sin duplicados, sin fugas de letra.
- **Subrayados:** los marcadores `++...++` del `stimulus` coinciden 1:1 con los stems que citan el "underlined sentence/portion"; sin desajustes.
- Los "truncation_suspect" del pre-scan (Inferences EASY seq1-13, HARD seq1-26, MEDIUM seq1-13; Cross-Text EASY seq12 `159ef46d`, HARD seq7 `96f3accc`) se inspeccionaron uno a uno: **falsos positivos**, todos los stimuli están completos.

## Hallazgos por set

### Cross-Text Connections - EASY (setId=cmsjroovg06a1qmt1xkvswscb)
_Sin incidencias._ 15/15 preguntas limpias; Text 1 + Text 2 presentes en las 15. _(seq1-15 sin incidencias)_

### Cross-Text Connections - HARD (setId=cmsjroox206a3qmt1b4ncgngb)
_Sin incidencias._ 12/12 preguntas limpias; Text 1 + Text 2 presentes en las 12. _(seq1-12 sin incidencias)_

### Cross-Text Connections - MEDIUM (setId=cmsjrooyo06a5qmt1pploy9kk)
_Sin incidencias._ 9/9 preguntas limpias; Text 1 + Text 2 presentes en las 9. _(seq1-9 sin incidencias)_

### Inferences - EASY (setId=cmsjrop3i06a9qmt109khhfyc)
_Sin incidencias._ 13/13 preguntas limpias; blank en posición correcta. _(seq1-13 sin incidencias)_

### Inferences - MEDIUM (setId=cmsjrop0g06a7qmt1azugpolo)
_Sin incidencias._ 13/13 preguntas limpias; blank en posición correcta. _(seq1-13 sin incidencias)_
- Nota (no defecto): seq12 (`cac82f9b`) opción D = "A. thaliana leaves and roots…" — el barrido de option-label-leak lo marcó, pero "A. thaliana" es la abreviatura de *Arabidopsis thaliana*, no una fuga de letra. Coincide con fuente. Limpio.

### Inferences - HARD (setId=cmsjrop6206abqmt1pppikums)
_Sin incidencias._ 26/26 preguntas limpias; blank en posición correcta. _(seq1-26 sin incidencias)_
- Nota (no defecto, fiel a fuente): seq16 (`0dccbf17`) el `stimulus` dice "The BanjoLesson" (sin espacio) en la primera mención y "The Banjo Lesson" (con espacio) en la segunda — reproduce **exactamente** el artefacto del PDF fuente (`sourceText` idéntico). No es defecto de promoción; a lo sumo `source_error` cosmético en el PDF original.

## Resumen de defectos

| Clase | Severidad | Conteo |
|---|---|---|
| (ninguno) | — | 0 |

**Total: 0 defectos / 88 preguntas.** Claves 88/88 OK. Integridad doble-pasaje 36/36 OK.
