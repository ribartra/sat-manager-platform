# QA TEST 7 — inconsistencias publicado vs fuente

**Fecha:** 2026-09-22 · **Método:** inspección visual (Claude) de cada pregunta publicada contra la
imagen de su página fuente (Math completo página por página; R&W completo, 35 páginas) + barrido
automático por regex sobre las 98. Solo lectura (no se modificó contenido oficial ni `dev.db`).

- **Fuente Math:** `files_to_load/MOCK EXAMS/TEST 7/MATH/TEST 7 INNOVATOR MATH.pdf` (18 págs, capturas del
  reproductor; Módulo 1 págs 1-9, Módulo 2 (HARDER) págs 10-18).
- **Fuente R&W:** `files_to_load/MOCK EXAMS/TEST 7/READING AND WRITING/ Test 7 RW.pdf` (35 págs; un único
  PDF con ambos módulos — M1 págs 1-17, divisor "MODULE 2 R&W (HARDER)" pág 18, M2 págs 19-35).
- **Claves de respuesta:** `TEST 7 ANS KEY.docx` (tabla única R&W1/R&W2B/MATH1/MATH2B, extraída con
  parseo XML de celdas) + `Test7_Math_Answer_Explanations.docx` (✓ Correct Answer / "Choice X is correct"
  por pregunta) + `Test7_RW_Answer_Explanations.docx`. Las tres fuentes concuerdan.
- **Alineación:** Math por `pageNumber` del candidato (fiable, monótona 1→18); R&W secuencial por
  `moduleSeq`, confirmada visualmente página por página.
- Preguntas publicadas: 98 (RW 27+27, Math 22+22). Todas `PUBLISHED`.

> Nota: las páginas fuente son capturas del reproductor tipo College Board (botones NEXT/PREV QUESTION,
> "COME BACK LATER", panel de opciones/NUMERIC). TEST 7 **no** tiene el artefacto de corchetes `[tema/
> respuesta]` de TEST 1 ni `ui_leak` de texto de botón, pero sí un patrón nuevo y grave: varias preguntas
> de R&W Módulo 2 tienen el **stimulus completo de otra pregunta** (vecina o no) en vez del propio, con la
> pregunta real perdida del todo en algunos casos.

---

## Resumen de defectos

| Clase | Cantidad | Severidad | Dónde |
|---|---|---|---|
| `broken_question` — falta el stimulus real; se muestra el de otra pregunta (contenido perdido) | **3** | **Crítica** | R&W M2 #15, #19, #24 |
| `stimulus_bleed` — stimulus duplicado de otra pregunta, o fragmento de vecino prepended | **3** | **Crítica/Alta** | R&W M2 #22 (dup. de M2#20); M1 #24, M2 #24 (fragmento prepended) |
| `option_text_wrong` (bleed dentro de opción) — el texto de la siguiente pregunta completa se anexó a una opción | 1 | **Crítica** | R&W M2 #8 (opción D) |
| `image_missing` / imagen incorrecta — `imageUrl` = panel de opciones o gráfico de otra pregunta, falta el diagrama/tabla requerido | **4** | **Crítica** | Math M1 #16, #17, #22 (falta diagrama); M1 #18 (imagen de *otra* pregunta: dot-plot de abejas en vez de tabla f(x)) |
| `stem_option_leak` — lista de opciones (con `\times\boxed{}` u OCR) duplicada dentro del stem | 5 | Media | Math M1 #18, #19, M2 #19, #20; R&W M1 #24 |
| `redundant_ui_image` — `imageUrl` = captura del panel de opciones/casilla NUMERIC vacía, sin diagrama real | **22** | Media (masivo, cosmético) | Math M1 #4,7,8,9,10,12,13,14,15,21; M2 #1,3,4,5,8,9,10,12,13,15,21,22 |
| `escaped_underscore` — blank `\_\_\_\_\_` se renderiza literal | 1 | Baja | R&W M2 #2 |
| `stem_number_leak` — nº de pregunta antepuesto al stem (cosmético, sistemático) | 64 | Baja | Math 44/44; R&W M1 #2,4,6,10,14,16,18,20,22,24; M2 #1,2,4,6,9,15,17,19,22,24 |

**No** se hallaron: `[tema/respuesta]` bracket leak, `ui_leak` de botones, `asset_placeholder_leak`,
`option_label_leak`, `stimulus_ui_leak`. El falso positivo del barrido automático `optDupStim` en
R&W M1 #25 es la paráfrasis legítima de las notas del estudiante (formato "notes question"), no un defecto.

**Claves de respuesta: ✔ 98/98 correctas — 0 discrepancias.** Las tres fuentes (`TEST 7 ANS KEY.docx`,
`Test7_Math_Answer_Explanations.docx`, `Test7_RW_Answer_Explanations.docx`) concuerdan entre sí y con
`correctAnswer` publicado en las 98 preguntas, **incluidas las que tienen el stimulus roto** (R&W M2
#8, #15, #19, #22, #24): la *letra* correcta sigue coincidiendo aunque el contenido mostrado al alumno
esté corrupto o pertenezca a otra pregunta. NUMERIC verificados: Math M1 #4=2, #7=9, #9=15, #12=7,
#15=−5, #21=71; M2 #1=100, #5=34, #8=4, #9=28, #13=3, #15=7/10, #21=4, #22=3/7.

---

## A. MATH (44/44 inspeccionadas, página por página)

### A1. `image_missing` — Math Módulo 1 #16 (`cmsjrnwxx01bfqmt1dqsbjcuh`) — **Crítica**
- Stem: "A circle is inscribed in a square, as shown. What is the area of the shaded region...?" — requiere
  el diagrama del círculo inscrito con "8 inches" marcado (pág 6 fuente).
  Publicado `imageUrl` = captura del panel de opciones (A-D) + botón COME BACK LATER, **no** el diagrama.
- Acción: reemplazar `imageUrl` por el recorte del diagrama círculo-en-cuadrado de la fuente.

### A2. `image_missing` — Math Módulo 1 #17 (`cmsjrnwy501bhqmt1rs7o5c3c`) — **Crítica**
- Stem: "...the table above shows the distribution of blood types and Rh factors..." — requiere la tabla
  2x5 de tipos de sangre (pág 6 fuente).
  Publicado `imageUrl` = captura del panel de opciones (11/120, 11/50, 11/32, 11/21), **no** la tabla.
- Acción: reemplazar `imageUrl` por el recorte de la tabla de tipos de sangre.

### A3. `image_missing` (imagen de otra pregunta) — Math Módulo 1 #18 (`cmsjrnwyd01bnqmt1l4vwq4sj`) — **Crítica**
- Stem: "The table shows select values for the function f(x). What is the equation for f(x)?" — requiere la
  tabla x/f(x) (−3→9, −1→19/3, 2→7/3, 12→−11), pág 7 fuente.
  Publicado `imageUrl` (`12a224076a513480257f948c.jpg`, 569×301) = un **dot plot de "Number of bee hives in
  each sector"**, contenido de una pregunta completamente distinta (ni siquiera es M2#18, cuyo dot-plot es
  un archivo distinto: `aede96fb5cf4912236bdd59d.jpg`, 278×107 — no son el mismo archivo, md5 distintos).
  La tabla real de f(x) no está en ningún otro `imageUrl` publicado del test.
- Acción: generar/recortar la tabla x/f(x) real desde la pág 7 y reemplazar el `imageUrl`.

### A4. `stem_option_leak` — Math Módulo 1 #18 y #19 — Media
- M1 #18 (mismo qid que A3): el `stem` publicado termina con las 4 opciones duplicadas en LaTeX corrupto:
  `\[ \times \boxed {A} f (x) = - 3 x + 9 \]  \[ \times \boxed {B} ... \]` etc. El campo `options` ya trae
  el texto limpio (A-D) por separado — el stem no debería repetirlos.
- M1 #19 (`cmsjrnwym01btqmt1846xul16`, triángulo 45-45-90, imagen correcta): mismo patrón,
  `\[ \times \boxed {A} 3 \] \[ \times \boxed {B} 3\sqrt2 \] ...` anexado al stem.
- Acción: quitar el bloque `\[ \times \boxed {...} ... \]` repetido del final del `stem` en ambas.

### A5. `image_missing` — Math Módulo 1 #22 (`cmsjrnx2701c2qmt18m37uycw`) — **Crítica**
- Stem: "The functions f(x) and g(x) are graphed on the xy-plane shown. If g(2) = q, what is f(q)?" —
  requiere el gráfico de ambas funciones (pág 9 fuente).
  Publicado `imageUrl` = captura del panel de opciones (0, 1, 2, 5), **no** el gráfico xy.
- Acción: reemplazar `imageUrl` por el recorte del gráfico de f(x)/g(x).

### A6. `stem_option_leak` — Math Módulo 2 #19 y #20 — Media
- M2 #19 (`cmsjrnwyq01buqmt1p4128am4`): stem termina en
  `...How many distinct real solutions does the given equation have?  x A Zero x B Exactly one x C Exactly two x D Infinitely many` —
  opciones duplicadas (con OCR "x" en vez de "✗") pegadas al final del stem.
- M2 #20 (`cmsjrnwzg01bwqmt1kj5hz9qu`): stem termina en `...What is the area of the shaded region, in
  square units?  x A \(\frac{\sqrt{3}}{8} a^2\)` — solo la opción A quedó parcialmente duplicada (leak
  incompleto).
- Acción: quitar el texto de opciones repetido del final de ambos stems.

### A7. `redundant_ui_image` — 22 preguntas Math sin diagrama real — Media (masivo, cosmético)
`imageUrl` apunta a una captura del **panel de opciones MC** (texto ya presente en `options`) o de la
**casilla NUMERIC vacía + botones** (sin ningún diagrama), cuando la pregunta no requiere imagen alguna
(álgebra/aritmética pura). No afecta la respuesta ni el enunciado, pero es ruido visual redundante.
- Math M1: #4 (`cmsjrnwv101afqmt18bl7cnit`), #7 (`cmsjrnwvo01atqmt1bd104lnl`), #8 (`cmsjrnwvv01azqmt1mfieaq2s`),
  #9 (`cmsjrnww401b1qmt1wxxc2meb`), #10 (`cmsjrnwwd01b3qmt13rryv96r`), #12 (`cmsjrnwwv01b7qmt15yu2cr29`),
  #13 (`cmsjrnwx501b9qmt1o97iza46`), #14 (`cmsjrnwxf01bbqmt18tuh45q8`), #15 (`cmsjrnwxo01bdqmt1g6kdpd8i`),
  #21 (`cmsjrnwzl01c0qmt147onafqb`).
- Math M2: #1 (`cmsjrnwug01a2qmt11ejod0hc`), #3 (`cmsjrnwuw01aeqmt1v4bli56s`), #4 (`cmsjrnwv501agqmt13icfwcp1`),
  #5 (`cmsjrnwvd01amqmt1fygwuecz`), #8 (`cmsjrnww001b0qmt192ba8rnz`), #9 (`cmsjrnww901b2qmt11a73dd8i`),
  #10 (`cmsjrnwwi01b4qmt1ygb26lmg`), #12 (`cmsjrnwx001b8qmt10070sq27`), #13 (`cmsjrnwxb01baqmt1s1u8sv5b`),
  #15 (`cmsjrnwxt01beqmt1hbe204cz`), #21 (`cmsjrnx1k01c1qmt111g85jey`), #22 (`cmsjrnx2h01c3qmt1a5rvbs91`).
- Acción: poner `imageUrl = null` en las 22 (verificado que ninguna tiene diagrama real en la fuente).

Las 18 preguntas Math restantes (imágenes con diagrama real: box plot M2#17, dot plot M2#18, hexágono
M2#20, gráfico de línea M2#2, triángulo M1#19, y las 12 sin imagen en absoluto) coinciden con la fuente.

---

## B. READING & WRITING (54/54 inspeccionadas visualmente, 35 páginas)

### B1. `option_text_wrong` (bleed masivo dentro de opción) — R&W M2 #8 (`cmsjrnwmf0176qmt1mo1aok2h`) — **Crítica**
- Stem: "According to the text, how were the sramans different from the rank-and-file citizens of
  Shen-shen?" (pasaje *A Record of Buddhistic Kingdoms*, pág 22 fuente).
- Opción D publicada: `"The sramans followed India's laws more carefully than the regular citizens. The
  following text is from Carl Schurz's 1908 book *Reminiscences*. We tore down the stair, into the
  street... [continúa el párrafo entero]"` — el texto correcto de la opción D es solo la primera frase; el
  resto es el **stimulus completo de la siguiente pregunta (M2 #9)** pegado por error.
  Confirmado en fuente pág 22: opción D real = `"The sramans followed India's laws more carefully than
  the regular citizens."` (sin más texto).
- Respuesta correcta D — la letra sigue siendo correcta, pero el alumno ve un bloque de texto ajeno de
  ~500 caracteres colgando de la opción.
- Acción: truncar la opción D al texto real (una sola oración).

### B2-B4. `broken_question` — stimulus real perdido, reemplazado por el de otra pregunta — **Crítica**

- **R&W M2 #15** (`cmsjrnwor018cqmt1a2l03wsi`, pág 27 fuente). Stem/opciones son sobre un trivia contest
  ("the results of the 2010 competition raised questions about its objectivity" / "the prime minister
  skewed the question to favor his son"...) — corresponden al pasaje real: *"The Chidon Ha-Tanach is a
  global trivia competition... the prime minister's son competed... and placed third. Thus, ____"*.
  Publicado `stimulus` = mezcla de la cola de M2#11 ("...show an increased BOLD response to food
  stimuli.") + el stimulus **completo** de M2#12 (Isothiocyanates/TR-AR) — ninguno de los dos tiene
  relación con las opciones. El pasaje real del Chidon Ha-Tanach **no existe en ninguna otra pregunta
  publicada** (grep negativo sobre las 98).
  Acción: restaurar el stimulus real del Chidon Ha-Tanach desde la fuente.

- **R&W M2 #19** (`cmsjrnwpf018oqmt12nzmb1in`, pág 29 fuente). Stem/opciones son de gramática de posesivos
  ("peoples' birth charts" / "people's birth charts"...) — corresponden al pasaje real sobre astrología:
  *"Skeptics may dismiss astrology as a passing fad... astrologers have used ____ — maps that display the
  arrangement of the cosmos at the time of their birth — to divine information..."*.
  Publicado `stimulus` = `"The role is more than merely _____ China relies on these iconic mammals in
  diplomacy..."` — un **fragmento del stimulus de M2 #17** (Pandas). El pasaje real de astrología **no
  existe en ninguna otra pregunta publicada** (grep negativo).
  Acción: restaurar el stimulus real sobre astrología desde la fuente.

- **R&W M2 #24** (`cmsjrnws80192qmt10nbo6aqr`, pág 32 fuente). Stem/opciones son de transición lógica
  (Conversely/However/Meanwhile/In short) — corresponden al pasaje real: *"Despite their reputation, many
  orchids are easy to maintain... _____ experts say, flower enthusiasts should not be deterred..."*.
  Publicado `stimulus` = `"Bryant, until 1934. Milton Friedman was a Nobel Prize-winning economist..."` —
  es el stimulus real de **M2 #22** (ver B5) con un fragmento colgado ("Bryant, until 1934.") de la cola
  de M2 #21. El pasaje real de las orquídeas **no existe en ninguna otra pregunta publicada** (grep
  negativo) → perdido del todo.
  Acción: restaurar el stimulus real sobre orquídeas desde la fuente.

### B5. `stimulus_bleed` (duplicado de otra pregunta) — R&W M2 #22 (`cmsjrnwpw018yqmt19llko5o3`) — **Crítica**
- Stem/opciones: "have been / are / were / was" (concordancia sujeto-verbo) — corresponden al pasaje real:
  *"Milton Friedman was a Nobel Prize-winning economist... Among his many contributions _____ his work on
  monetary policy..."* (pág 31 fuente, mismo pasaje que terminó mal-asignado a M2 #24, ver B4).
  Publicado `stimulus` = copia exacta del stimulus de **M2 #20** ("Although the screenwriter of *Midnight
  Cowboy*... Genuinely shocked by an oncoming car, _____") — pasaje ajeno, no relacionado con las opciones
  de concordancia verbal.
  Acción: mover el stimulus real de Milton Friedman (hoy en M2 #24) a M2 #22, y restaurar en M2 #24 el
  pasaje de orquídeas de la fuente (ver B4). Las opciones de ambas preguntas SÍ son correctas.

### B6. `stimulus_bleed` (fragmento prepended) — R&W M1 #24 (`cmsjrnwq60191qmt141m6qsvf`) — Alta
- Publicado `stimulus` empieza: `"Consequently, Divergent evolution is the process by which..."` — la
  palabra "Consequently," (idéntica a la opción C) está pegada al inicio; la fuente (pág 14) empieza
  directamente en "Divergent evolution is the process...".
  Además el `stem` trae las 4 opciones duplicadas con marcas OCR: `"24. ... ✗ A In other words, ✗ B
  Alternatively, ✗ C Consequently, ✗ D Despite that,"` (`stem_option_leak`).
- Acción: quitar el prefijo "Consequently, " del stimulus y el bloque de opciones repetido del stem.
  (Respuesta correcta B, no afectada.)

### B7. `escaped_underscore` — R&W M2 #2 (`cmson6g1w000518pp9ognfh6z`) — Baja
- Stimulus: `"...notorious for his \_\_\_\_\_, wrongly assuming..."` — el blank quedó como guiones bajos
  escapados en vez de renderizarse como línea `_____`. Fuente pág 18 muestra un blank normal.
- Acción: reemplazar `\_` por `_`.

### B8. `stem_number_leak` (cosmético, sistemático) — 20 preguntas R&W
- M1: #2, #4, #6, #10, #14, #16, #18, #20, #22, #24 (10).
- M2: #1, #2, #4, #6, #9, #15, #17, #19, #22, #24 (10).
- El número de pregunta ("2.", "16.") queda antepuesto al stem; no cambia el enunciado real. Mismo patrón
  visto en TEST 2-6.

### B9. Falso positivo revisado — R&W M1 #25 (`cmsjrnwsp0193qmt1o7t4skqv`)
El barrido automático marcó "optA⊂stimulus" (opción A ⊂ stimulus). Es una pregunta de tipo "notas del
estudiante" donde la opción A correcta es, por diseño, una paráfrasis casi literal de una viñeta de las
notas (pág 15 fuente) — **no es un defecto de parseo**.

Las 46 preguntas R&W restantes (incluidos los pasajes largos de M1 #6, #7, #8, #9, y todas las de "student
notes") coinciden con la fuente en stem, stimulus, opciones y (donde aplica) imagen.

---

## Estado de la inspección — TEST 7 CERRADO ✔
- **Math (44):** inspección visual completa página por página (18 págs), incluida verificación de cada
  `imageUrl` contra el diagrama/tabla/gráfico fuente. ✔
- **R&W (54):** inspección visual completa página por página (35 págs), M1 #1-27 y M2 #1-27, incluida
  verificación cruzada de qué stimulus real corresponde a cada stem/opciones cuando el barrido o la lectura
  detectó contenido sospechoso. ✔
- **Claves de respuesta:** ✔ **98/98 correctas** — verificadas contra `TEST 7 ANS KEY.docx` (tabla de
  celdas R&W1/R&W2B/MATH1/MATH2B) **y** contra `Test7_Math_Answer_Explanations.docx` /
  `Test7_RW_Answer_Explanations.docx` (las tres fuentes concuerdan, incluidas las preguntas con contenido
  roto). 0 discrepancias.

## Causa raíz de los `broken_question`/`stimulus_bleed` de R&W M2 (B1-B5)
El PDF fuente de R&W apila 1-2 preguntas por página como capturas del reproductor. El parseo de TEST 7
mezcló el `stimulus` de varias preguntas del Módulo 2 (HARDER) con el de sus vecinas — en 3 casos (M2 #15,
#19, #24) el pasaje real parece haberse **perdido completamente** del pipeline de ingesta (no aparece en
ninguna otra pregunta publicada del test), y en otros 2 (M2 #8 opción D, M2 #22) el contenido ajeno
convive con el propio (`option_text_wrong`) o lo reemplaza por duplicado de un vecino no adyacente
(M2 #20). A diferencia de TEST 2 (`broken_question` = opción A corrupta) y TEST 3 (`broken_question` =
opciones de la pregunta vecina), en TEST 7 el patrón dominante es **stimulus completo de otra pregunta**,
posiblemente por un desplazamiento en el mapeo página→pregunta durante el parseo de Módulo 2. La
recuperación del contenido real requiere OCR/transcripción manual de las págs 27 (Chidon Ha-Tanach) y 32
(orquídeas), ya que esos dos pasajes no sobreviven en ninguna otra fila de la base.
