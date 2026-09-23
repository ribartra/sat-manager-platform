# QA TEST 5 — inconsistencias publicado vs fuente

**Fecha:** 2026-09-22 · **Método:** barrido determinístico por regex (`scripts/qa/scan-artifacts.mjs`) +
inspección visual (Claude) de cada pregunta publicada contra la imagen de su página fuente +
auditoría de las imágenes vinculadas (`imageUrl` de pregunta y de opción) contra el contenido real de la
fuente. Solo lectura (no se modificó contenido oficial ni `dev.db`).

- **Fuente Math:** `files_to_load/MOCK EXAMS/TEST 5/MATHS/INNOV. TEST 5 MATH  MOD 1&2.pdf` (18 págs, capturas del reproductor; Módulo 1 = págs 1-9, Módulo 2 = págs 10-18).
- **Fuente R&W:** `files_to_load/MOCK EXAMS/TEST 5/READING AND WRITING/INNOVATOR TEST 5 RW MOD 1&2.pdf` (38 págs; Módulo 1 = págs 1-19, Módulo 2 = págs 20-38; alineación confirmada por `pageNumber` de cada `IngestQuestionCandidate`, no solo secuencial).
- **Clave de respuestas:** `files_to_load/MOCK EXAMS/TEST 5/ANSWERS KEY TEST 5.docx` — una tabla, 4 columnas
  (R&W Mod.1 / R&W Mod.2 (Hard) / Math Mod.1 / Math Mod.2 (Hard)), extraída completa con python-docx (27+27+22+22=98).
- Preguntas publicadas: 98 (RW 27+27, Math 22+22). Todas `PUBLISHED`.

> Nota: las páginas fuente son **capturas del reproductor tipo College Board** (botones NEXT/PREV QUESTION,
> flag "COME BACK LATER"/variantes OCR "COMB"/"CUME"/"COMI", marcas ✗ de "no respondida"). Ese *chrome* de UI
> es la causa de casi todos los defectos textuales. TEST 5 además presenta un defecto **nuevo, no visto en
> TEST 1/2**: muchas preguntas de Math tienen el campo `Question.imageUrl` poblado con una captura de
> pantalla del **propio panel de opciones** (incluyendo botones PREV/NEXT y marcas ✗) en vez de estar vacío o
> contener el diagrama real — y ese campo se renderiza siempre debajo del stem
> (`components/question-player-preview.tsx:79`), antes de las opciones de texto reales.

> **Nota metodológica:** a mitad del barrido se agotó el cupo de tmpfs de la sesión (herramienta Bash dejó de
> funcionar). El barrido automático (`scan-artifacts.mjs`) y la verificación de las 98 claves de respuesta ya
> se habían completado sobre las 98 preguntas antes del fallo. El resto (inspección visual pregunta-por-página,
> auditoría de imágenes) se completó igualmente leyendo directamente las páginas/imágenes fuente, sin depender
> de Bash. Un sub-agente aparte re-extrajo el texto publicado de R&W Módulo 2 como verificación cruzada
> adicional de esta sección.

---

## Resumen de defectos

| Clase | Cantidad | Severidad | Dónde |
|---|---|---|---|
| `image_missing` — el `imageUrl` de la pregunta debería contener el gráfico/diagrama requerido por el stem, pero contiene una captura duplicada del propio panel de opciones (chrome de UI incluido); el gráfico real no está en ningún lado | **2** | **Crítica** | MATH M1 #8, #9 |
| `image_incomplete` — el diagrama publicado solo muestra la mitad de la figura que el stem dice mostrar; falta un dato (ángulo) que solo existe en la imagen | 1 | Alta | MATH M2 #9 |
| `option_image_wrong` — placeholder de tabla sin resolver en las 4 opciones + la imagen de la opción A duplica la de la opción B (la tabla real de A nunca se muestra) | 1 | Alta | MATH M1 #3 |
| `option_text_wrong` — sangrado: el intro/pasaje de la pregunta siguiente se pegó al final de una opción | 2 | Alta | RW M1 #9, #17 |
| `redundant_ui_image` — `imageUrl` = captura del propio panel de opciones o del campo NUMERIC (con botones PREV/NEXT) en preguntas que no necesitan ningún diagrama; se muestra duplicado antes de las opciones de texto reales | 19 | Media (masivo, cosmético pero visible) | MATH M1 #6,13,16,17,18,20; M2 #4,5,6,7,8,10,11,12,13,14,15,21,22 |
| `ui_leak` — las 4 opciones (con marcas ✗ o restos "COMI/COME BACK LATER") se vuelcan una segunda vez al final del `stem` o de una opción | 4 | Media | MATH M1 #12, #21, #22(optD); RW M1 #20 |
| `stem_stimulus_boundary_wrong` — la frase "A student wants to..." (el objetivo real de la pregunta) quedó pegada al final del `stimulus` en vez de al inicio del `stem`; o el `stimulus` completo se duplicó dentro del `stem` | 3 | Media | RW M1 #26; RW M2 #12, #27 |
| `stem_number_leak` — el nº de pregunta antepuesto al stem | 16 (RW) + 44 (Math, uniforme) | Baja / cosmética | ver detalle |

**No se hallaron:** `stem_annotation_leak` (`[tema/respuesta]`), `broken_question`, `escaped_underscore`,
`stimulus_bleed` en R&W Módulo 2, ni discrepancias reales de `optLabelLeak`/`optDupStim` (los 2 positivos del
barrido automático son falsos positivos verificados contra la fuente, ver abajo).

**Claves de respuesta: ✔ 98/98 correctas — 0 discrepancias**, incluidas las 12 NUMERIC
(1/8, 55, 7/22, 4, 24, 6, 7, 3, y las letras MC). Ninguno de los defectos listados altera la **letra/valor**
de la respuesta correcta.

---

## A. MATH (44)

### A1. `image_missing` — MATH Módulo 1 #8 (`cmsjrnugu00ijqmt1szmnlak6`, pág 4) — **Crítica**
- Stem: *"The graph of the function f(x) is shown. What value(s) of x satisfy f(x) = 0."* — requiere ver una
  parábola.
- Publicado: `imageUrl` = `/uploads/questions/e37c88d5b507d65253b11048.jpg`, que **no es la parábola**: es una
  captura duplicada del propio panel de opciones (`PREV.QUESTION`/`NEXT QUESTION`, opciones A-D con ✗, flag
  "COME BACK LATER").
- Fuente (pág 4): parábola con vértice ≈(2,5), raíces en x=−1 y x=5.
- La respuesta correcta (C = "−1 and 5") sigue siendo correcta según la fuente, pero el alumno **no puede
  verla ni verificarla** porque el gráfico real nunca se publicó.
- Acción: reemplazar `imageUrl` por el recorte real de la parábola de la pág 4.

### A2. `image_missing` — MATH Módulo 1 #9 (`cmsjrnuh400ilqmt1obq908v1`, pág 4) — **Crítica**
- Stem: *"The graph of g(x) is shown. What is the value of g(6)?"* — requiere ver una recta.
- Publicado: `imageUrl` = `/uploads/questions/508f26be02a6ce574e015c59.jpg`, de nuevo una captura duplicada del
  panel de opciones (3/6/7/8 con ✗), no la recta.
- Fuente (pág 4): recta que pasa por (0,5) y (8,8) aprox.; en x=6, g(6)=7.
- Respuesta correcta C (7) sigue siendo correcta, pero el gráfico real está ausente.
- Acción: reemplazar `imageUrl` por el recorte real de la recta de la pág 4.

### A3. `image_incomplete` — MATH Módulo 2 #9 (`cmsjrnuh900imqmt1xpf8w377`, pág 13) — **Alta**
- Stem: *"Triangles ABC and XYZ are shown. If AB/BC = k... which ratio is equal to k?"* — el valor del ángulo
  necesario (28° en Z) **solo existe en la imagen**, no en el texto.
- Publicado: `imageUrl` = `/uploads/questions/5c8cdf7af2e5abe4ba77d4a3.jpg` muestra **solo el triángulo ABC**
  (ángulo 62° en B); el triángulo XYZ (con el ángulo 28° en Z) está recortado/ausente.
- Fuente (pág 13): ambos triángulos lado a lado.
- La correspondencia de ángulos (necesaria para resolver con rigor) no puede derivarse del recorte publicado.
  Respuesta correcta A (XZ/XY) coincide con la fuente.
- Acción: reemplazar `imageUrl` por el recorte completo de ambos triángulos.

### A4. `option_image_wrong` — MATH Módulo 1 #3 (`cmsjrnudd00i1qmt1bete05le`, pág 2) — **Alta**
- Stem: *"Vira recorded the distances of her recent jogs... Which frequency table accurately represents this
  data?"* Las 4 opciones son tablas Distance/Frequency.
- Texto de las 4 opciones = placeholder sin resolver `[tbl-0.html]`…`[tbl-3.html]` (`asset_placeholder_leak`,
  cosmético — el contenido real vive en la imagen de cada opción).
- **Pero las imágenes están mal:** la imagen de la opción A (`26f7ec2d02e8bc217d3abc5a.jpg`) y la de la opción
  B (`6df0fd07ce13681566a826c8.jpg`) son la **misma tabla** (3→2, 5→4, 7→1, 10→2 = la tabla B real de la
  fuente). La tabla A real de la fuente (3→2, 5→6, 7→7, 10→9) **nunca se muestra**. Opciones C y D correctas
  (verificadas contra la fuente).
- La respuesta correcta (B) sigue siendo correcta porque la tabla B mostrada es la real; el problema es que el
  alumno ve la **misma tabla duplicada** en A y B y nunca ve la tabla A real.
- Acción: reemplazar la imagen de la opción A por el recorte real de la tabla A (3,2/5,6/7,7/10,9) de la pág 2;
  limpiar el texto placeholder `[tbl-N.html]` de las 4 opciones.

### A5. `redundant_ui_image` — 19 preguntas Math — **Media (masivo, cosmético)**
En 19 preguntas de Math que **no requieren ningún diagrama** en la fuente (solo texto/ecuaciones), el campo
`Question.imageUrl` quedó poblado con una captura de pantalla del **propio panel de opciones** (o del campo de
respuesta NUMERIC vacío), incluyendo los botones "PREV. QUESTION"/"NEXT QUESTION" y las marcas ✗. Como
`imageUrl` se renderiza siempre debajo del stem (`components/question-player-preview.tsx:79`) y las opciones
de texto reales se renderizan de nuevo más abajo, el alumno ve el contenido **duplicado** con chrome de UI
filtrado en medio. El texto de las opciones/objetivo mostrado en el recorte coincide con las opciones reales
(no hay pérdida de información, solo redundancia visual):
- **Math M1:** #6 (`cmsjrnueg...`), #13 (`cmsjrnui4...`), #16 (`cmsjrnuj1...`), #17 (`cmsjrnujz...`),
  #18 (`cmsjrnuka...`), #20 (`cmsjrnukr...`)
- **Math M2:** #4 (`cmsjrnudx...`), #5 (`cmsjrnuea...`), #6 (`cmsjrnuel...`), #7 (`cmsjrnugo...`),
  #8 (`cmsjrnugz...`), #10 (`cmsjrnuhi...`), #11 (`cmsjrnuhq...`), #12 (`cmsjrnuhz...`), #13 (`cmsjrnuie...`),
  #14 (`cmsjrnuio...`), #15 (`cmsjrnuiw...`), #21 (`cmsjrnul6...`), #22 (`cmsjrnulh...`)
- Acción: vaciar `imageUrl` en estas 19 preguntas (no aportan información, solo ruido/UI leak).
- Contraste — preguntas Math donde el `imageUrl` SÍ es necesario y SÍ es correcto (verificadas): M1 #10 (tabla
  Red/White/Blue Team), M1 #21 (gráfico población lagartos), M1 #22 (figura geométrica H-A-B-I-C-F-G-D-E),
  M2 #16 (gráfico región sombreada), M2 #19 (gráfico de barras problemas completados). Estas 5 están bien.

### A6. `ui_leak` — MATH Módulo 1 #12 (`cmsjrnuhu00irqmt1y4592ec4`, pág 5) — **Media**
- El `stem` termina con las 4 opciones volcadas una segunda vez, con marcas ✗ (formato del panel de la
  fuente): `"...✗ A It is plausible... ✗ B The percentage is exactly 68%. ✗ C ... ✗ D ..."`. El array de
  opciones real es correcto y limpio. No detectado por `scan-artifacts.mjs` (su regex `ui` no incluye el
  carácter ✗ aislado sin "COME/COMB BACK LATER").
- Acción: recortar el stem en "...population that was tagged?".

### A7. `ui_leak` — MATH Módulo 1 #21 (`cmsjrnul000jhqmt1q1p9ey2x`, pág 9) — **Media**
- El `stem` vuelca las 4 opciones de nuevo (sin ✗ esta vez) más un resto de UI: `"...COMI BACK LATER"` al
  final (typo OCR de "COME BACK LATER", variante no capturada por el regex `COM[BE]\.?\s*BACK\s*LATER`).
- Acción: recortar el stem en "...interpretation of a in this context?".

### A8. `ui_leak` — MATH Módulo 1 #22, opción D (`cmsjrnulb00jjqmt1ij3wojjk`, pág 9) — **Media**
- Opción D publicada: `"140 COMI BACK LATER"` → debe ser `"140"`. Mismo typo OCR "COMI" no cubierto por el
  regex del scan.
- Acción: opción D = "140".

### A9. `stem_number_leak` (Math) — informativo
Las 44 preguntas de Math llevan el número ("1.", "2.", …) dentro del `stem`, de forma uniforme (igual que en
TEST 1/2); bajo impacto, no se itemiza por pregunta.

Las 21 preguntas Math restantes (fuera de las listadas arriba) coinciden con la fuente en stem, opciones,
imágenes y respuesta.

---

## B. READING & WRITING (54)

### B1. `option_text_wrong` — RW Módulo 1 #9, opción D (`cmsjrnuvx00niqmt1oua1tttg`, pág 7) — **Alta**
- Publicado: opción D = `'Growing and eating maize is the entirety of one's duty to "keep the days."
  The following text is from Charlotte Brontë's 1847 novel Jane Eyre. It is told from the perspective of the
  title character. Mr. Rochester, on hearing the name, set his teeth...'` (701 caracteres — el intro completo
  + extracto de la pregunta #10 sangró al final de la opción D).
- Fuente (pág 7): la opción D real es solo `'Growing and eating maize is the entirety of one's duty to "keep
  the days."'`. El pasaje de Jane Eyre pertenece —y aparece correctamente— al stimulus de la #10 (no falta
  ahí; es una duplicación, no una reubicación).
- Respuesta correcta A no se ve afectada.
- Acción: opción D = `'Growing and eating maize is the entirety of one's duty to "keep the days."'`.

### B2. `option_text_wrong` — RW Módulo 1 #17, opción D (`cmsjrnv1k00oyqmt18ce2jrim`, pág 12) — **Alta**
- Publicado: opción D = `"has caused The circadian rhythm is an internal process that functions as the
  biological clock of the human body. Since its discovery, biologists have noted how external factors, such
  as the detection of blue light, can impact _____. Blue light in particular can suppress the production of
  melatonin, which is directly related to sleep-wake cycles."` (347 caracteres — el intro completo del
  stimulus de la #18 sangró a la opción D).
- Fuente (pág 12): la opción D real es solo `"has caused"`. El párrafo del ritmo circadiano pertenece —y
  aparece correctamente— al stimulus de la #18.
- Respuesta correcta C no se ve afectada.
- Acción: opción D = `"has caused"`.

### B3. `ui_leak` — RW Módulo 1 #20 (`cmsjrnv2500pcqmt1x83duysn`, pág 13) — **Media**
- El `stem` vuelca las 4 opciones una segunda vez con marcas ✗: `"...✗ A discovery was, that over time,
  some, ✗ B discovery was, that, over time, some ✗ C discovery, was, that over time, some ✗ D discovery was
  that, over time, some"`. El array de opciones real es correcto y limpio. No detectado por el regex `ui` del
  scan (solo ✗, sin "COME/COMB BACK LATER").
- Acción: recortar el stem en "...conventions of Standard English?".

### B4. Falsos positivos del barrido automático (verificados, NO son defectos)
- **RW Módulo 1 #27** (`cmsjrnv3400pxqmt139tcv9hk`, pág 19, flag `optDupStim`): opción A = *"The Sombrero
  Galaxy has a diameter of about 49,000 light-years and an estimated mass equivalent to 800 billion suns."*
  Combina legítimamente dos viñetas de las notas del stimulus (patrón normal de estas preguntas "student
  wants to..."). Verificado contra la fuente: coincide exactamente. No es `broken_question`.
- **RW Módulo 2 #27** (`cmsjrnwac011wqmt14eysu7el`, pág 38, flag `optLabelLeak`): opción A empieza con *"A
  dialectologist could study..."* — el artículo "A" es legítimo, no una letra de opción filtrada. Verificado
  contra la fuente: coincide exactamente.

### B5. `stem_stimulus_boundary_wrong` — la frase-objetivo "A student wants to..." mal ubicada — **Media (3)**
En las preguntas de tipo "notas de investigación" (*"While researching a topic, a student has taken the
following notes..."*), el `stem` real debe ser la frase completa *"A student wants to [objetivo]. Which
choice most effectively uses relevant information from the notes to accomplish this goal?"* — verificado en
las 4 preguntas de este tipo que SÍ están bien (RW M1 #24, #25, #27; RW M2 #26). En 3 preguntas la frase
"A student wants to..." quedó mal ubicada:

- **RW M1 #26** (`cmsjrnv3000psqmt1trpw9nor`, pág 18): `stimulus` publicado termina en `"...*The Tragedy of
  Macbeth* is a movie adaptation of *Macbeth* that was released in 2021. **26. A student wants to convey the
  relevancy of Shakespeare's plays in the modern age.**"` — esa última oración pertenece al `stem`, no a las
  notas. `stem` publicado = solo `"Which choice most effectively uses relevant information from the notes to
  accomplish this goal?"` (falta la oración objetivo). Fuente (pág 18): el panel derecho combina ambas
  oraciones como el enunciado completo; el panel izquierdo (notas) NO incluye esa oración.
  Acción: `stem` = `"A student wants to convey the relevancy of Shakespeare's plays in the modern age. Which
  choice most effectively uses relevant information from the notes to accomplish this goal?"`; quitar la
  oración del final del `stimulus`. (Respuesta A no afectada.)

- **RW M2 #27** (`cmsjrnwac011wqmt14eysu7el`, pág 38): mismo patrón — `stimulus` termina en `"...52% use
  'tea,' and the rest use 'supper.' **27. A student wants to provide an example of how a dialectologist might
  depict linguistic variations based on location.**"`; `stem` publicado = solo `"Which choice most effectively
  uses relevant information from the notes to accomplish this goal?"`. Fuente (pág 38): confirma la misma
  separación de paneles que M1#26.
  Acción: `stem` = `"A student wants to provide an example of how a dialectologist might depict linguistic
  variations based on location. Which choice most effectively uses relevant information from the notes to
  accomplish this goal?"`; quitar la oración del final del `stimulus`. (Respuesta B no afectada.)

- **RW M2 #12** (`cmsjrnv0800o9qmt1nrfg0m09`, pág 28) — variante distinta: aquí el `stimulus` SÍ está completo
  y correcto (*"The Birds is a comedy play... reach new heights of knowledge: ______"*), pero el `stem`
  publicado **duplica ese mismo texto completo** antes de la pregunta real: `stem` = `"*The Birds* is a comedy
  play by Aristophanes... knowledge: ______\n\n12. Which translated quotation from *The Birds* most
  effectively illustrates the claim?"`. Fuente (pág 28): panel izquierdo = ese pasaje (ya está en
  `stimulus`); panel derecho = solo `"12. Which translated quotation from The Birds most effectively
  illustrates the claim?"`.
  Acción: `stem` = `"Which translated quotation from The Birds most effectively illustrates the claim?"`
  (quitar el pasaje duplicado). (Respuesta C no afectada.)

Verificado con doble extracción (consulta directa + sub-agente de re-verificación independiente sobre R&W
Módulo 2 completo): no se encontró este patrón en ninguna otra de las 54 preguntas R&W.

### B6. `stem_number_leak` (RW) — informativo / cosmético (16)
El número de pregunta quedó dentro del `stem` de forma inconsistente, igual que en TEST 1/2:
- **M1:** #2, #4, #10, #14, #16, #18, #20, #22 (8)
- **M2:** #2, #4, #6, #17, #19, #21, #23, #25 (8)

Las demás preguntas R&W (fuera de las listadas arriba) coinciden con la fuente en stem, stimulus, opciones e
imágenes. Las 3 preguntas R&W con `imageUrl` (M1 #12 gráfico de costos, M2 #13 tabla de especies, M2 #14
gráfico de puntajes) están correctas y son necesarias — no comparten el defecto `redundant_ui_image` visto en
Math.

---

## Estado de la inspección — TEST 5

- **Math (44):** inspección visual completa página por página (18 págs) + auditoría de las 27 preguntas con
  `imageUrl` (comparando cada imagen contra la página fuente, no solo el texto) + las 4 imágenes de opción de
  M1#3. Defectos: 2 `image_missing` (críticos), 1 `image_incomplete`, 1 `option_image_wrong`, 19
  `redundant_ui_image`, 3 `ui_leak` en stem/opción. Resto (21 preguntas) fiel a la fuente.
- **R&W (54):** inspección visual completa de las 38 páginas fuente + barrido automático de artefactos sobre
  las 98 (bracket/ui/tbl/esc/stemNum/optLabelLeak/optDupStim, ejecutado antes de una falla de herramienta a
  mitad de sesión) + barrido manual de longitud de opción (>130 car.) sobre las 54 preguntas para detectar
  sangrados tipo TEST 2 + re-extracción completa (texto íntegro `stem`/`stimulus`/opciones) de las 27
  preguntas de R&W Módulo 2 vía un sub-agente independiente, usada como verificación cruzada de la inspección
  visual. Defectos: 2 `option_text_wrong` (sangrado de intro de pregunta siguiente), 1 `ui_leak` en stem, 3
  `stem_stimulus_boundary_wrong` (frase-objetivo "A student wants to..." mal ubicada). 2 falsos positivos del
  barrido automático verificados y descartados. Las 3 imágenes de R&W correctas.
- **Claves de respuesta:** ✔ **98/98 correctas**. Se extrajeron completas con python-docx de
  `ANSWERS KEY TEST 5.docx` (una tabla, 4 columnas) y se compararon contra `correctAnswer` de las 98 preguntas
  publicadas por sección+módulo+moduleSeq — 0 discrepancias (incluye NUMERIC 1/8, 55, 7/22, 4, 24, 6, 7, 3).

## Causa raíz de los defectos nuevos de TEST 5

1. **`image_missing`/`image_incomplete`/`option_image_wrong` (A1-A4):** el paso de recorte de imágenes del
   pipeline de ingesta asignó el crop equivocado — reutilizando el recorte del panel de opciones (o el de una
   opción vecina) en vez del recorte del diagrama/tabla real de la página. Es un defecto de **asignación de
   imagen**, no de OCR de texto.
2. **`redundant_ui_image` (A5):** en 19 preguntas de Math sin diagrama en la fuente, el pipeline igualmente
   asignó un `imageUrl` — el recorte por defecto del panel de opciones — en vez de dejarlo vacío. Como el
   frontend siempre renderiza `imageUrl` si existe, esto duplica visualmente las opciones y filtra chrome de
   UI (botones PREV/NEXT, ✗) al alumno.
3. **`ui_leak` en stem/opción con "COMI" (A6-A8, B3):** variante de OCR del flag "COME BACK LATER" que
   `scripts/qa/scan-artifacts.mjs` no captura (su regex solo reconoce "COMB"/"COME"/"CUME"). Se recomienda
   ampliar `RE.ui` a `COM[BEI]\.?\s*BACK\s*LATER` y añadir un patrón para marcas ✗ sueltas seguidas de una
   letra de opción (`✗\s*[A-D]\b`) para detectar automáticamente este patrón en tests futuros.
4. **`option_text_wrong` (B1-B2):** mismo patrón de "sangrado secuencial" identificado como causa raíz de
   TEST 2 — el promotor tomó el intro/pasaje de la pregunta siguiente en la misma página del reproductor y lo
   pegó al final de la última opción de la pregunta actual.
5. **`stem_stimulus_boundary_wrong` (B5):** en las preguntas "notas de investigación", la fuente presenta el
   panel de notas (stimulus) y el panel de pregunta (stem, que empieza con "N. A student wants to...") como
   dos columnas separadas en la misma captura de página. El promotor calculó mal el límite entre ambos
   paneles en 3 de las 6 preguntas de este tipo: en 2 casos dejó la frase-objetivo del lado del stimulus (sin
   quitarla de ahí ni pasarla al stem); en el tercero (M2#12) copió el panel de stimulus completo dos veces
   (una correcta en `stimulus`, otra pegada al inicio del `stem`).
