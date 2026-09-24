# Content QA — READING Practice Sets — Words in Context (MEDIUM + HARD)

- **Fecha:** 2026-09-24
- **Topic:** Words in Context (Craft and Structure) — dificultades **MEDIUM + HARD**
- **Alcance:** 2 practice sets · 110 preguntas (HARD=54, MEDIUM=56)
- **Método:** QA de contenido de solo lectura sobre preguntas READING promovidas vs. fuente (`sourceText` del candidato de ingesta = bloque exacto del PDF de ejercicio, + PDF `ANS …` para claves). Se comparó programáticamente cada `stem` (+`stimulus` en vocab-en-contexto) y cada `option.text` contra el cuerpo/opciones del `sourceText`, con normalización de comillas curvas y guiones. Se verificaron las 110 claves por `Question ID` (hex) contra `Correct Answer:` del ANS PDF. Escaneo de mojibake / carácter de reemplazo / underscore escapado / fugas de UI y anotación / fugas de etiqueta de opción. Render/vista de página fuente disponible pero no requerido: fuente 100% texto y `sourceText` fiel (0 divergencias de cuerpo/opciones).
- **Nota de diseño:** Words in Context es fill-in-the-blank → `stimulus` NULL por diseño en los ítems de blanco (49/54 HARD, 50/56 MEDIUM; el pasaje va dentro del `stem`). Los ítems "vocab en contexto" (`As used in the text…`, 5 HARD + 6 MEDIUM) sí llevan `stimulus` con el pasaje. NO se marca stimulus vacío.
- **Clases de defecto:** ver `docs/qa/README.md`. Severidad: answer_key_wrong=Alta; stem/stimulus/option_truncated / broken_question / type_mismatch=Alta; explanation_truncated / option_text_wrong / encoding_mangle=Media; stem_number_leak / escaped_underscore / option_label_leak=Baja.

## Resumen de defectos

| Clase | HARD | MEDIUM | Total | Sev |
|---|---|---|---|---|
| explanation_truncated | 6 | 2 | 8 | Media |
| **Total** | **6** | **2** | **8** | |

Sin defectos de: answer_key_wrong (110/110 claves OK), stem/stimulus/option truncation, option_text_wrong, stem_option_leak, option_label_leak, stem_annotation_leak, ui_leak, encoding_mangle, escaped_underscore, type_mismatch. Cuerpo publicado (stem+stimulus) y las 4 opciones = idénticos al `sourceText` en las 110 preguntas.

---

## Hallazgos por set

### Words in Context - HARD (setId=cmsjropsc06arqmt1i3zhw7f6)

Cuerpo y opciones fieles al `sourceText` en las 54 preguntas; 54/54 claves confirmadas contra `ANS WORDS CONTEXT HARD.pdf`. Único defecto: explicaciones cortadas a media palabra (~2.3k chars) al promover — el texto completo SÍ existe en la fuente ANS PDF. No cambia la respuesta; degrada la explicación mostrada al alumno.

`cmsjro5in05cxqmt1ibjhryjh | Words in Context HARD | seq5/p5 | class=explanation_truncated | sev=Media | current: explicación termina "…would actively try to undermine t" (2291 chars, corte a media palabra) | expected: ANS PDF continúa "…undermine their own marketing in pursuit of that goal." | action: re-extraer explicación completa del ANS PDF (candidato ext=6c086e70)`
`cmsjro5nb05elqmt1mbqd3bp6 | Words in Context HARD | seq17/p17 | class=explanation_truncated | sev=Media | current: "…there’s no reason to think that the Tikal citadel provid" (2276 chars) | expected: continúa (…provides evidence of animosity / hostility, etc.) en ANS PDF | action: re-extraer explicación completa (ext=54804e10)`
`cmsjro5ok05fkqmt1bzdegu4q | Words in Context HARD | seq24/p24 | class=explanation_truncated | sev=Media | current: "…studies of the effect on blood chemistry of living in loca" (2317 chars) | expected: continúa en ANS PDF | action: re-extraer explicación completa (ext=b411eb09)`
`cmsjro5ri05iwqmt1myhwpl0n | Words in Context HARD | seq48/p48 | class=explanation_truncated | sev=Media | current: "…confirmed the signal with a high degree of con" (2305 chars) | expected: continúa (…confidence/…) en ANS PDF | action: re-extraer explicación completa (ext=6017ae31)`
`cmsjro5s005jlqmt1oowpb9zp | Words in Context HARD | seq53/p53 | class=explanation_truncated | sev=Media | current: "…which would suggest its importance, the text doesn" (2314 chars) | expected: continúa (…the text doesn’t…) en ANS PDF | action: re-extraer explicación completa (ext=b35e2fdc)`
`cmsjro5s305jqqmt1wvr30h33 | Words in Context HARD | seq54/p54 | class=explanation_truncated | sev=Media | current: "…Although the study under discussion s" (2289 chars) | expected: continúa en ANS PDF | action: re-extraer explicación completa (ext=e8fb0744)`

_(seq1-4, 6-16, 18-23, 25-47, 49-52 sin incidencias — stem/stimulus/opciones/clave OK; seq16 y seq18, marcadas "truncation_suspect" por el pre-scan, verificadas LIMPIAS: son ítems vocab "As used…" con stem corto, stimulus+opciones idénticos a la fuente)_

### Words in Context - MEDIUM (setId=cmsjropue06atqmt1f25v4dpv)

Cuerpo y opciones fieles al `sourceText` en las 56 preguntas; 56/56 claves confirmadas contra `ANS WORDS CONTEXT MED.pdf`. Único defecto: mismo patrón de explicación truncada.

`cmsjro4t804tmqmt1mhve7810 | Words in Context MEDIUM | seq11/p11 | class=explanation_truncated | sev=Media | current: "…even if their predictions may be inaccurate, which sugge" (2276 chars, corte a media palabra) | expected: continúa (…which suggests…) en ANS PDF | action: re-extraer explicación completa (ext=23974d6c)`
`cmsjro4zt04y7qmt1bmncbj88 | Words in Context MEDIUM | seq44/p44 | class=explanation_truncated | sev=Media | current: "…especially in countries that want to rely more o" (2379 chars) | expected: continúa (…rely more on…) en ANS PDF | action: re-extraer explicación completa (ext=1107e7dc)`

_(seq1-10, 12-43, 45-56 sin incidencias — stem/stimulus/opciones/clave OK)_

---

## Notas

- **Patrón sistémico (explanation_truncated):** las 8 explicaciones se cortan entre ~2276 y ~2379 chars, siempre a media palabra, y el texto restante SÍ está en el ANS PDF fuente (verificado en seq5 HARD: "…undermine **their own marketing in pursuit of that goal.**"). Sugiere un tope de longitud de campo aplicado en la promoción/OCR de la explicación, no un defecto de fuente. Fuera de la taxonomía original stem/opción, pero es un defecto real publicado-vs-fuente (el alumno ve la explicación cortada). No afecta la clave correcta.
- **Claves:** 110/110 correctas (HARD 54/54, MEDIUM 56/56) contra los ANS PDF por `Question ID`. Confirma el pre-scan "CLEAN".
- **Fidelidad de texto:** 0 divergencias de stem/stimulus/opción en 110 preguntas (comparación normalizada incluyó líneas de atribución y copyright de los pasajes vocab, p.ej. "©1955 by Grove Press, Inc."). Sin mojibake, sin `�`, sin underscore escapado, sin fugas de UI/etiqueta/anotación. Todas MC de 4 opciones (type=MC).
