# Mapa de recuperación — ¿está lo "faltante" ya en los artefactos de ingesta? (antes de OCR)

**Resultado principal: de los ~40 defectos de contenido catalogados (TEST 1-10), CERO requieren re-OCR.**
Todo el contenido "perdido" ya existe en las etapas de staging de la ingesta y es recuperable con un
re-slice / re-link / re-promoción, sin volver a la imagen fuente. Fase de **detección** (solo lectura);
no aplica ningún fix.

## Cómo se determinó (solo lectura)
- `scripts/qa/recover-sweep.mjs "TEST N"` — hace el JOIN de las 4 etapas por qid de defecto e imprime
  publicado / candidato / página(`extractedText`) / artefactos de imagen (con rutas `disk=` listas para abrir),
  y un veredicto automático. `dev.db` abierto `{readonly:true}` vía `openDb()`.
- Confirmación **visual** (3 agentes, uno por grupo de tests) leyendo los bytes reales de imagen en
  `.private/uploads/ingest/<batch>/…` vs. el publicado en `public/uploads/questions/…`, y el `extractedText`
  completo de las páginas. Ningún archivo oficial modificado; sin dev server.

## La cadena del dato y dónde sobrevive el contenido
Promoción = **lossy hacia `Question`, pero NO borra staging**. Por eso todo es re-hidratable:
- Texto de la página completa: `IngestPageArtifact.extractedText` (Mistral OCR **COMPLETED, `requiresOcr=0`** en
  todas las páginas tocadas) + `IngestOcrCache.responseJson`.
- Texto por-pregunta: `IngestQuestionCandidate.stem/stimulus/optionsJson` + `rawJson.text` (slice pre-sanitizado).
- Imágenes ya extraídas: `IngestImageArtifact` por página. `PDFPLUMBER` (`imageId=Im##`) = recorte grande de la
  región (suele ser el diagrama/tabla real); `MISTRAL_OCR` (`img-N.jpeg`) = sub-recortes (diagrama pequeño **o**
  panel de opciones/UI); `MANUAL_CROP` (`img_<hex>`) = recortes manuales previos. `IngestCandidateImageLink`
  guarda el `targetType` (STEM/STIMULUS/OPTION/**ANSWER_FIELD**/…).

## Veredictos (clases de recuperación)
- **PROMOTION_DROP** — el candidato ya tiene el contenido correcto; se perdió al promover. Fix = re-promover del candidato.
- **PARSE_MISALIGN** — el candidato (y el publicado) quedaron mal cortados, pero el texto correcto está íntegro en
  `IngestPageArtifact.extractedText` de la **misma página ya enlazada**. Fix = re-slice del `extractedText`.
- **IMAGE_MISLINK** — el diagrama real ya existe como `IngestImageArtifact` (a menudo **ya enlazado como STEM** en el
  candidato); la promoción publicó el recorte `ANSWER_FIELD` (panel de opciones). Fix = re-link al artefacto correcto.
- **NEEDS_SOURCE / NEEDS_REOCR** — solo si el `extractedText` está vacío o el diagrama no está en ningún artefacto.
  **Ocurrencias: 0.**

## Distribución
| Veredicto | Nº | Recuperación |
|---|---|---|
| PARSE_MISALIGN (texto) | ~22 | re-slice desde `extractedText` de la página ya enlazada |
| IMAGE_MISLINK (imagen) | ~17 | re-link al `IngestImageArtifact` correcto (o crop de la región PDFPLUMBER en 2 casos) |
| PROMOTION_DROP (texto) | 1 | re-promover del candidato |
| **NEEDS_REOCR / NEEDS_SOURCE** | **0** | — |

---

## Detalle por defecto (puntero exacto de recuperación)

### PROMOTION_DROP
| Defecto | qid | Recuperar de |
|---|---|---|
| T10 Math M1#7 (broken) | `cmsnffuwf000l0mmx4vvrlqaw` | `cand_4800c3c180f741de848c52fa963b8387` — `stem` completo (341 chars) + `optionsJson[A]` real ("The longest call… is 30 minutes."). El publicado tiene stem `"7."` y la opción A pisada por el stem. optD tiene un glyph `■` a limpiar. |

### PARSE_MISALIGN — texto (re-slice desde `extractedText` de la página)
| Defecto | qid | pageArtifact / página | Contenido correcto (cabeza) |
|---|---|---|---|
| T2 RW M2#10 (broken) | `cmsjrntzg00duqmt1t01beiay` | `page_a8617abe…` p.25 | falta la instrucción "Which choice most effectively uses data from the graph…"; opción A pisada por el pasaje. B/C/D e imagen OK. |
| T2 RW M2#27 (broken) | `cmsjrnu5300goqmt13nxbcs97` | `page_9b0969ee…` p.36 | stem debe ser "The student wants to describe the differences… Which choice…"; opción A debe ser la comparación Kozan/Meizan. |
| T3 Math M1#17 (broken) | `cmsjrntwp00c3qmt1009fvz2k` | `page_c97cfe79…` p.6 (2º bloque de opciones) | la promoción tomó las opciones de #16; las de #17 (std dev/mean de los dos dot plots) están en el 2º bloque del `extractedText`. **⚠ además la clave publicada `C` puede ser la de #16 arrastrada — verificar en fase de fixes.** |
| T4 Math M1#19 (broken) | `cmsjrnvad00rqqmt1dkutaaga` | `page_aef39924…` p.7 | stem truncado a "19."; debe ser "A polynomial function p(x)…"; opción A debe ser `p(x) = -0.5(x+2)(x-1)(x-3)`. optD tiene footer "COMB BACK LATER" a limpiar. |
| T4 RW M1#25 (broken) | `cmsjrnusr00lpqmt1m5c083u0` | `page_a9bbd28d…` p.17 | stem debe ser "The student wants to emphasize the intricacies… Which choice…"; opción A debe ser "Changzhou combs are produced using many different materials…". |
| T6 Math M1#8 (broken) | `cmsjrnvsm00xpqmt1r7yupxmu` | `page_2a09c3db…` p.3 | stem truncado en "…lengths of the sticks are shown."; falta la lista 4.2,6.3,… y "What is the mean length, in inches…". Sin imagen. |
| T6 Math M2#12 (broken) | `cmsjrnvua00xyqmt14touuur7` | `page_e8981e89…` p.14 | stem truncado en "…largest value is greater than"; completo: "If the largest value is removed… changes to the mean and median?". Opciones OK. |
| T7 RW M2#15 (orchids/lost) | `cmsjrnwor018cqmt1a2l03wsi` | `page_6964bb40…` p.27 | stimulus real (Chidon Ha-Tanach) está en el `extractedText`, justo antes del bloque de opciones de #15. |
| T7 RW M2#19 (astro/lost) | `cmsjrnwpf018oqmt12nzmb1in` | `page_a0014d0a…` p.29 | stimulus real (astrología / star charts) en el `extractedText`, antes de las opciones de #19. |
| T7 RW M2#22 (swap) | `cmsjrnwpw018yqmt19llko5o3` | `page_333e5a79…` p.31 (2º bloque) | actualmente es duplicado del stimulus de #20; el real (Milton Friedman) está en el 2º bloque de esa misma página. |
| T7 RW M2#24 (swap/broken) | `cmsjrnws80192qmt10nbo6aqr` | `page_550260a9…` p.32 (2º bloque) | el pasaje orchids real ("Despite their reputation, many orchids…") está en el 2º bloque; hoy tiene contenido de #22. |
| T9 RW M2#20 (optD leak) | `cmsjrny4201syqmt1n7f9hqsq` | `page_…` p.31 | stimulus (Jon Bois) ya correcto; solo `optionsJson[D]` tiene texto batik filtrado → trim. |
| T9 RW M2#23 (stem dup) | `cmsjrny4k01tgqmt16un61jz0` | `page_…` p.33 | pasaje Bhutan duplicado en stem y stimulus → dedup del stem. |
| T10 RW M2#21 (swap) | `cmsjrnt2e002mqmt1lj54y0xy` | `page_db11fa62…` p.31 | stimulus real (Ponzi scheme) en `extractedText`; el candidato también está mal (dup de #18) → la página es la única fuente limpia. |
| T10 RW M2#23 (swap) | `cmsjrnt2t002yqmt1qv2l69qf` | `page_343134ed…` p.32 | stimulus real (squirrel monkeys) en `extractedText`; candidato dup de #20. |
| T10 RW M2#25 (swap) | `cmsjrnt38003aqmt1041w3n5d` | `page_28c967a1…` p.33 | stimulus real (Boeing "the Incredibles") en `extractedText`; candidato dup de #22. |
| T10 RW M2#20/#22/#24 (optD leak) | `cmsjrnt26…` / `cmsjrnt2m…` / `cmsjrnt310…` | (propio registro) | stimulus ya correcto; solo `optionsJson[D]` tiene el pasaje del impar siguiente filtrado → trim. (Cross-check: el texto filtrado en optD del par == el pasaje real del impar.) |

**No-defecto (verificado, sin acción):** T7 RW M2#20/#21/#23 y T9 RW M2#21 — su stimulus publicado ya coincide con su propia página.

### IMAGE_MISLINK — imagen (re-link al artefacto correcto)
Patrón dominante: el candidato **ya tiene el link STEM** al diagrama correcto (`img-N.jpeg`); la promoción publicó el
recorte `ANSWER_FIELD` (panel de opciones). Fix = re-link (o re-promover el link STEM existente).

| Defecto | qid | Artefacto correcto (imageId) |
|---|---|---|
| T5 Math M1#8 | `cmsjrnugu00ijqmt1szmnlak6` | `img-0.jpeg` (parábola f(x)) — publicado = img-1.jpeg (panel) |
| T5 Math M1#9 | `cmsjrnuh400ilqmt1obq908v1` | `img-2.jpeg` (recta g(x)) — publicado = img-3.jpeg (panel) |
| T7 Math M1#16 | `cmsjrnwxx01bfqmt1dqsbjcuh` | `img-0.jpeg` (círculo inscrito en cuadrado, 8 in) |
| T7 Math M1#22 | `cmsjrnx2701c2qmt18m37uycw` | `img-0.jpeg` (dos parábolas f(x)/g(x)) |
| T8 Math M1#7 | `cmsnb3fzg000k0mpdb3ur9ziu` | `img-1.jpeg` (prisma 10×5×7 m, V=350) |
| T8 Math M1#21 | `cmsnb3g2c001y0mpd76881utf` | `img-0.jpeg` (histograma "Distance People Traveled…") |
| T8 Math M2#4 | `cmsnb3g2v002i0mpdrimxrlt4` | `img-1.jpeg` (triángulo DEF 48°/106°) |
| T8 Math M2#20 | `cmsnb3g4m00490mpd1v3v3lb8` | `img-0.jpeg` (curva exponencial f(x)) |
| T9 Math M1#18 | `cmsjrnw6y0115qmt1n6l2xku6` | `img-1.jpeg` (dos esferas en prisma) |
| T9 Math M2#14 | `cmsjrnw4o010qqmt15p9zquem` | `img-0.jpeg` (triángulos ACD/BCD 12 cm) |
| T9 Math M2#15 | `cmsjrnw4w010wqmt1lxiguftt` | `img-2.jpeg` (histograma "Mr. Corbin's Physics Class") |
| T10 Math M1#16 | `cmsnffuyr001q0mmxjm8sgd11` | `img-1.jpeg` (curva f(x) de doble joroba) |
| T10 Math M1#19 (incompleta) | `cmsnffuz3001x0mmxlkruutzz` | ya publica `img-1.jpeg` (Data Set A); **añadir** `img-2.jpeg` (Data Set B) — el candidato ya enlaza AMBAS como STEM (sortOrder 0/1). |

**IMAGE_MISLINK con crop (la tabla real solo está dentro del recorte grande PDFPLUMBER, no hay `img-N.jpeg` limpio):**
| Defecto | qid | Región fuente |
|---|---|---|
| T3 Math M1#17 (2º dot plot) | `cmsjrntwp00c3qmt1009fvz2k` | falta el dot plot "SET 2"; existe como `img-1.jpeg` sin enlazar → solo re-link. |
| T7 Math M1#17 | `cmsjrnwy501bhqmt1rs7o5c3c` | tabla blood-type/Rh (2×5) visible dentro de `Im17` (PDFPLUMBER, p.6). Mistral solo emitió `[tbl-0.html]` → recortar de la región. |
| T7 Math M1#18 | `cmsjrnwyd01bnqmt1l4vwq4sj` | tabla x/f(x) dentro de `Im18` (PDFPLUMBER, p.7). El publicado (MANUAL_CROP) es un dot plot de otra pregunta; `img-0.jpeg` de la página es un triángulo de la #19. → recortar de `Im18`. |

---

## Implicaciones para la fase de fixes (WAL-safe, fase aparte)
- La mayoría son re-slice de texto o re-link de imagen **desde datos ya presentes** → bajo riesgo, sin OCR ni re-extracción.
- Mecanismos ya existentes a reusar: `reconcileOfficialUpdate` (aditivo, no pisa datos buenos) para re-hidratar texto;
  `propagateAssignedImageToOfficial` + el crop-assign (`PdfPageCropper`) para re-linkar/re-cortar imágenes STEM.
- **Verificar en fixes (posibles claves nuevas más allá de las 2 de T8):** T3 Math M1#17 — la clave `C` publicada podría
  ser la de #16 arrastrada (mismo mis-slice que trajo las opciones equivocadas). No re-derivada aquí.
- Los 2 casos con crop (T7 M1#17/#18) son los de más trabajo manual; el resto es re-asignación mecánica.
