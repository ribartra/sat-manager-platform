# QA TEST 9 — inconsistencias publicado vs fuente

**Fecha:** 2026-09-22 · **Método:** inspección visual (Claude) de cada pregunta publicada contra la
imagen de su página fuente, barrido determinístico de artefactos (`scan-artifacts.mjs`), verificación
programática de todas las imágenes adjuntas, y reconstrucción/cruce de la clave de respuestas desde
`Test 9 Ans Key.docx` + los dos DOCX de explicaciones. Solo lectura (no se modificó contenido oficial).

- **Fuente Math:** `files_to_load/MOCK EXAMS/TEST 9/MATH/TEST 9 MATH MOD 1, 2B.pdf` (20 págs, capturas
  del reproductor tipo College Board).
- **Fuente R&W:** `files_to_load/MOCK EXAMS/TEST 9/READING AND WRITING/TEST 9 RW MOD 1, 2, REV PDF.pdf`
  (36 págs, capturas del reproductor; ~1-2 preguntas por página).
- **Alineación:** Math y R&W por número de página del candidato (`IngestPageArtifact.pageNumber`,
  confiable y monótono para ambas secciones — no hizo falta alineación secuencial).
- Preguntas publicadas: **98** (RW 27+27, Math 22+22). Todas `PUBLISHED`. Sin huecos de
  módulo/secuencia. El straggler de memoria "T9 2B:4 graph-image options" (Math M2#4, pregunta de
  sistema de inecuaciones con 4 gráficos como opciones) está correctamente promovido — las 4 imágenes
  de opción son las correctas y distintas entre sí; el único defecto asociado es una imagen raíz
  redundante (ver A9).

> Nota: igual que en TEST 8, las páginas fuente son capturas del reproductor (botones NEXT/PREV
> QUESTION, "COME BACK LATER"). En TEST 9 ese chrome de UI **no se filtró como texto** en los stems —
> el patrón dominante aquí es, como en TEST 5/7/8, **imágenes redundantes de ese mismo chrome
> adjuntas como `imageUrl`**, incluyendo **3 casos críticos** donde eso reemplaza un diagrama que sí
> hace falta para resolver la pregunta.

---

## Resumen de defectos

| Clase | Cantidad | Severidad | Dónde |
|---|---|---|---|
| `image_missing` — el `imageUrl` es una captura del panel de opciones en vez del diagrama/gráfico/histograma requerido por el stem | **3** | **Crítica** | Math M1#18 (prisma+esferas); Math M2#14 (figura del cuadrilátero); Math M2#15 (histograma) |
| `redundant_ui_image` — `imageUrl` poblado con una captura del panel de opciones o del recuadro NUMERIC vacío cuando la pregunta no necesita imagen | **19** | Media | Math M1#1,9,11,12,17,19; Math M2#4(raíz),6,8,9,10,12,13,16,17,18,19,21,22 |
| `option_text_wrong` — el texto de una opción se reemplazó por el inicio del *stimulus* de la pregunta siguiente | 1 | **Alta** | RW M2#20 (opción D) |
| `stimulus_bleed` — falta la oración de apertura del *stimulus* (migró a la opción vecina o se perdió) | 2 | Alta | RW M2#21 (falta intro "Batik…"); RW M2#6 (falta intro de atribución del caso judicial) |
| `stimulus_bleed` — el *stimulus* de la pregunta siguiente quedó anexado al de esta pregunta | 1 | Alta | RW M2#14 (pasaje de Hamilton de la #15 pegado al de Shakespeare) |
| `stem_option_leak` — la lista de las 4 opciones duplicada dentro del *stem* | 2 | Media | RW M1#11, RW M1#25 |
| `stimulus_dup_in_stem` — el *stimulus* completo duplicado también dentro del campo *stem* | 1 | Media | RW M2#23 |
| `ui_leak` — fragmento de UI del reproductor filtrado al final del stem (" BEST QUESTION") | 1 | Baja | RW M2#11 |
| Error de transcripción matemática en el stem (`\sqrt{g}` → `\sqrt{2}`, pierde la variable que el enunciado pregunta) | 1 | Media | Math M2#10 |
| `stem_number_leak` — el nº de pregunta antepuesto al stem (cosmético, sistemático) | 62 | Baja | RW M1(10)/M2(8), Math M1(22)/M2(22) |
| *stimulus* truncado a mitad de frase (recorte del propio documento fuente, no mal-parseo) | 1 | Info | RW M1#11 |
| Falso positivo del scanner (`optLabelLeak`) — la opción A legítimamente empieza con la letra "A" | 1 | Info | RW M1#8 |
| Falso positivo del scanner (`optDupStim`) — stimulus y opción A comparten texto por ser pregunta tipo "notas del estudiante" | 1 | Info | RW M2#27 |
| Discrepancia interna del propio DOCX de explicaciones de Math (contradice su propio gráfico) — **NO es defecto de producción** | 1 | Info | Math M1#21 (ver nota dedicada) |

**Ninguno de los defectos de arriba cambia la letra de respuesta correcta** de las 98 preguntas
publicadas (ver sección de clave más abajo: 98/98 correctas).

---

## A. MATH (44/44 inspeccionadas página por página, 20 págs + verificación de las 33 imágenes adjuntas)

### A1–A3. `image_missing` — CRÍTICO (3 preguntas)

- **Math M1#18** (`cmsjrnw6y0115qmt1n6l2xku6`, pág 8) — "Two identical spheres, each with a volume of
  972π cubic inches, fit perfectly inside a rectangular prism, **as shown**. What is the volume of the
  rectangular prism?" La fuente muestra un prisma rectangular con dos esferas inscritas tangentes entre
  sí y a las caras del prisma (necesario para deducir que ancho=diámetro, largo=2×diámetro,
  alto=diámetro). `imageUrl` publicado = `56795dc10b65379e2a92c809.jpg`, que es el panel de opciones
  (1458/2916/5832/11664), no el diagrama 3D. **Sin el diagrama la pregunta no es resoluble.**
  Acción: adjuntar la figura del prisma con las dos esferas (pág 8 de la fuente).
- **Math M2#14** (`cmsjrnw4o010qqmt15p9zquem`, pág 17) — "In the figure shown, what is the length of
  side CD, in centimeters?" La fuente muestra un cuadrilátero *ABCD* con ángulos 30°/45°/60°/90° y el
  lado *AB* = 12 cm marcado. `imageUrl` publicado = `7bb85ebffe03bf8621196534.jpg` = panel de opciones
  (4√6/8√3/6√6/8√6), no la figura geométrica. **Irresoluble sin la figura.** Acción: adjuntar la
  figura del cuadrilátero con sus ángulos y el lado de 12 cm.
- **Math M2#15** (`cmsjrnw4w010wqmt1lxiguftt`, pág 17) — "The histogram summarizes the test scores
  after adding the 10 extra points. In which range is the median score before the 10 points were
  added?" La fuente muestra un histograma de frecuencias ("Test Results from Mr. Corbin's Physics
  Class") con barras por rango de puntaje. `imageUrl` publicado = `4347eeb74c7ea54b7a398789.jpg` =
  panel de opciones, no el histograma. **Irresoluble sin el histograma.** Acción: adjuntar el
  histograma de la fuente.

### A4. Error de transcripción matemática en el stem — Math M2#10 (`cmsjrnw32010iqmt16sn1nt02`, pág 15) — Media
- Fuente: "$3x^2 - 6x - 11 = 0$. If one of the solutions to the given quadratic equation is
  $\frac{3+\sqrt{g}}{3}$, what is the value of $g$?" — la variable bajo la raíz es literalmente **g**
  (la incógnita que la pregunta pide).
- Publicado: stem muestra `$\frac{3+\sqrt{2}}{3}$` — el parser reemplazó la variable `g` por el
  dígito `2`, dejando un stem matemáticamente incoherente (pregunta "¿cuál es el valor de g?" pero
  "g" ya no aparece en la fórmula mostrada).
- La respuesta almacenada (`42`) es correcta matemáticamente (completando el cuadrado:
  $x = \frac{3\pm\sqrt{42}}{3}$), así que la clave no se ve afectada — es un defecto de fidelidad del
  contenido mostrado, no de la clave. Acción: corregir el stem a `\frac{3+\sqrt{g}}{3}`.

### A5. `redundant_ui_image` — 6 preguntas Math M1, 13 preguntas Math M2 (19 total) — Media
`imageUrl` poblado con una captura del panel de opciones (o del recuadro NUMERIC vacío) cuando la
pregunta **no** necesita imagen — el contenido ya está completo en el stem como texto/fórmula. No
afecta la resolubilidad, pero es ruido visual.
- Math M1: **#1** (`cmsjrnvy700yzqmt1qctdl4tw`, blank NUMERIC), **#9**
  (`cmsjrnw2p010bqmt19wxr7md8`, blank NUMERIC), **#11** (`cmsjrnw37010jqmt1jfu5mo1n`, panel de
  opciones), **#12** (`cmsjrnw3s010lqmt1p4c4t6bn`, blank NUMERIC), **#17**
  (`cmsjrnw690113qmt1tm9k2ec9`, panel de opciones), **#19** (`cmsjrnw7k0117qmt19tzlqenb`, blank
  NUMERIC).
- Math M2: **#4** (`cmsjrnvzb00zmqmt1ah3ghqxc`, imagen *raíz* de la pregunta = captura combinada de
  las opciones A+B del panel; las 4 imágenes de opción individuales están correctamente adjuntas y
  son las 4 gráficas distintas — no hay defecto ahí), **#6** (`cmsjrnvzy00zyqmt1wol8qrpb`, panel),
  **#8** (`cmsjrnw2f010aqmt1imgdxmfh`, panel), **#9** (`cmsjrnw2t010cqmt10acwlv8o`, panel), **#10**
  (`cmsjrnw32010iqmt16sn1nt02`, blank NUMERIC), **#12** (`cmsjrnw3z010mqmt1f30qc6yz`, blank NUMERIC),
  **#13** (`cmsjrnw4e010oqmt1w7ne5uwy`, panel), **#16** (`cmsjrnw620112qmt17bze9zdf`, panel), **#17**
  (`cmsjrnw6g0114qmt1nh39qai7`, panel), **#18** (`cmsjrnw7b0116qmt17prjy7g4`, blank NUMERIC), **#19**
  (`cmsjrnw7p0118qmt1pz7agqly`, blank NUMERIC), **#21** (`cmsjrnw8f011cqmt1atoztf3d`, panel — la
  fuente confirmada **no** trae diagrama para esta pregunta, es puramente algebraica, así que es
  redundante y no `image_missing`), **#22** (`cmsjrnw8v011eqmt1ht7rng18`, blank NUMERIC).

Verificadas como **correctas** (imagen real, necesaria, coincide con la fuente): Math M1 #2 (parábola
f(x)), #8 (box plot), #13 (scatterplot "Cost of a Personal Trainer"), #15 (tabla Ian/Kari), #16
(ángulos entre paralelas), #20 (gráfica g(x)), #21 (gráfica cuártica); Math M2 #4 (las 4 imágenes de
opción, gráficas de sistema de inecuaciones), #5 (gráfica g(x)), #7 (gráfica p(t)), #20 (scatterplot
"Ramen Restaurant Orders"). Math M1#18, M2#14 y M2#15 deberían estar en esta lista pero su imagen fue
reemplazada por el panel de opciones (ver A1-A3, crítico).

### A6. `stem_number_leak` (cosmético) — 22 preguntas Math M1 + 22 Math M2 = 44 en total en el scanner
El nº de pregunta ("1.", "16.") queda antepuesto/incluido en el stem publicado. Sistemático, igual que
en tests anteriores; no cambia el enunciado real. Lista completa reproducible con
`node scripts/qa/scan-artifacts.mjs "TEST 9"`.

### A7. Nota — Math M1#21 (`cmsjrnw88011bqmt1xskeplzv`): discrepancia interna del DOCX de explicaciones, NO es defecto de producción
- Publicado: `correctAnswer = "C"` = (x+1). `Test 9 Ans Key.docx` también dice **C** para esta
  pregunta. Coinciden.
- Sin embargo, `Test9_Math ANS Explanations.docx` Q21 dice **"Answer: D: (x+2)"**, con el razonamiento
  "the curve appears to cross the x-axis near x = −2 … ✗ C: (x+1) would require a zero at x = −1;
  graph doesn't cross there clearly."
- Se verificó el gráfico de la fuente (pág 10) con análisis de píxeles calibrado contra las
  cuadrículas (origen y escala confirmados con las etiquetas "5"/"-5" de ambos ejes): el trazo cruza el
  eje x en **x ≈ −5.0** y **x ≈ −1.0** (la curva forma un valle entre esos dos puntos, con mínimo cerca
  de x ≈ −3), y el segundo valle (a la derecha, hacia x ≈ 5) se mantiene por encima del eje sin
  cruzarlo. Ninguna opción ofrece `(x+5)`, pero `(x+1)` (opción **C**) sí coincide exactamente con la
  raíz medida en x ≈ −1.
- **Conclusión: el contenido publicado (C) es correcto** y coincide con `Ans Key.docx` y con la
  medición directa del gráfico fuente; el DOCX de explicaciones contiene un error de redacción propio
  (su razonamiento no corresponde al gráfico que describe). No se requiere ninguna acción sobre la
  base de datos — se documenta para que una futura re-promoción no "corrija" esto a D por error.

Las 44 preguntas Math fueron inspeccionadas visualmente contra la fuente (20 págs); fuera de los
defectos anotados arriba, stem/opciones/respuesta coinciden con la fuente.

---

## B. READING & WRITING (54/54 inspeccionadas página por página, 36 págs + verificación de las 3 imágenes adjuntas)

### B1. `option_text_wrong` — RW Module 2B #20 (`cmsjrny4201syqmt1n7f9hqsq`, pág 31) — **Alta**
- Publicado, opción D: `"exciting—statistics using Batik is an Indonesian technique of fabric dyeing
  that uses wax. In traditional batik, ______ is applied to a silk or cotton fabric. When the fabric
  is soaked in a color, the areas under the wax remain undyed. Once dry, the beeswax is removed from
  these areas and applied to others, and the process is repeated."`
- Fuente (pág 31): la opción D es simplemente `"exciting—statistics using"`. El resto del texto es el
  *stimulus* completo de la **pregunta #21** (batik), que se filtró dentro de la opción D de la #20.
- No afecta la calificación (la respuesta correcta es A, no D), pero corrompe gravemente el contenido
  visible de esa opción. Acción: opción D → `"exciting—statistics using"`.

### B2. `stimulus_bleed` (falta intro) — RW Module 2B #21 (`cmsjrny4901t4qmt1vst48gdk`, pág 31) — Alta
- Publicado, *stimulus*: `"In traditional batik, ______ is applied to a silk or cotton fabric. When
  the fabric is soaked in a color, the areas under the wax remain undyed. Once dry, the beeswax is
  removed from these areas and applied to others, and the process is repeated."`
- Fuente: falta la oración de apertura **"Batik is an Indonesian technique of fabric dyeing that uses
  wax."** — esa oración es justamente la que quedó mal pegada en la opción D de la #20 (ver B1). Es el
  mismo defecto visto desde el otro lado.
- Acción: anteponer `"Batik is an Indonesian technique of fabric dyeing that uses wax. "` al
  *stimulus* de la #21 (y limpiar la opción D de la #20 como en B1).

### B3. `stimulus_bleed` (falta intro de atribución) — RW Module 2B #6 (`cmsjrnxze01qyqmt1e6lpyoc2`, pág 20) — Alta
- Publicado, *stimulus*: `"Sturgis Public Schools*, authored by Justice Neal Gorsuch. From ages 9
  through 20, Miguel Luna Perez attended schools…"`
- Fuente: `"The following text comes from the majority opinion in the 2023 Supreme Court case Luna
  Perez v. Sturgis Public Schools, authored by Justice Neal Gorsuch. From ages 9 through 20…"` — se
  perdió toda la oración de atribución inicial, dejando un asterisco huérfano (`Sturgis Public
  Schools*`) que sugiere que era un marcador de cursiva sin resolver.
- Acción: anteponer `"The following text comes from the majority opinion in the 2023 Supreme Court
  case Luna Perez v. "` al *stimulus*.

### B4. `stimulus_bleed` (pasaje de la pregunta siguiente anexado) — RW Module 2B #14 (`cmsjrny3001seqmt1h5dd0zhb`, pág 28) — Alta
- Publicado, *stimulus* de la #14 (Shakespeare) incluye **también, pegado al final**, el pasaje
  completo de la #15 (Hamilton/Federalist): `"…they believe that acting troupes lacked access to
  classical literature and sources regarding courtly life. In his first essay arguing for the
  ratification of the new constitution, Alexander Hamilton discusses…"`
- Fuente: el *stimulus* de la #14 termina en `"…small English town because ______."` — el pasaje de
  Hamilton es exclusivo de la #15 (cuyo *stimulus* propio, verificado, está correcto y no duplicado).
- Acción: recortar el *stimulus* de la #14 para que termine en `"…because ______."`.

### B5. `stem_option_leak` — RW Module 1 #11 (`cmsjrny0701rrqmt1am7guns9`, pág 7) — Media
- Publicado, *stem*: `"Which choice best describes data from the graph that support the researchers'
  conclusion? A The density of bird deaths was highest around 30 meters from the base. The density of
  bird deaths was higher than that of bat deaths between 0 and 4 meters from the base. The density of
  bat deaths was lowest at 8 meters from the base. The density of bird deaths was equal to or higher
  than bat deaths between 30 and 60 meters from the base."`
- Fuente: el *stem* es solo la pregunta ("Which choice best describes data from the graph that
  support the researchers' conclusion?"); las 4 opciones aparecen únicamente en el panel de opciones,
  no repetidas en el *stem*.
- Acción: recortar el *stem* a la pregunta, quitando el texto de las 4 opciones que se filtró detrás.
- **Nota adicional (informativa):** el *stimulus* de esta misma pregunta también aparece truncado a
  mitad de frase — `"…birds were more prone to lethal collisions with the pole situated on"` — y la
  fuente misma (pág 7) muestra la captura del reproductor cortada exactamente en ese punto (el texto
  visible en el documento fuente ya termina ahí, sin continuación en la página siguiente). Es un
  recorte del propio documento fuente, no un mal-parseo — se documenta como informativo, sin acción
  clara posible salvo revisar si existe una versión no recortada del pasaje en otro archivo.

### B6. `stem_option_leak` — RW Module 1 #25 (`cmsjrny4u01tnqmt1p6hpksx7`, pág 15) — Media
- Publicado, *stem*: incluye la pregunta seguida de las 4 opciones completas repetidas
  ("...to accomplish this goal? GJ 486-b is 30 percent larger than Earth and orbits a red dwarf star
  instead of a yellow dwarf star. NASA scientists have determined that...").
- Fuente: el *stem* es solo la pregunta; las opciones están únicamente en el panel de opciones. Mismo
  patrón que B5 (pregunta tipo "notas del estudiante").
- Acción: recortar el *stem* a la pregunta.

### B7. `stimulus_dup_in_stem` — RW Module 2B #23 (`cmsjrny4k01tgqmt16un61jz0`, pág 33) — Media
- Publicado: el campo *stem* contiene, además de la pregunta, el **pasaje completo duplicado**
  ("23\n\nWhich choice completes the text with the most logical transition?\n\nThe landlocked country
  of Bhutan operates as a constitutional theocracy…to India for processing."), y el campo *stimulus*
  contiene **el mismo pasaje otra vez**, idéntico.
- Fuente (pág 33): el pasaje aparece una sola vez, en un recuadro de cita separado de la pregunta
  ("Which choice completes the text with the most logical transition?"), formato distinto al resto de
  las páginas de este documento (posiblemente exportado en un layout de texto plano en vez de captura
  del reproductor, lo que explicaría que el parser haya capturado el mismo bloque dos veces).
- Riesgo: si la UI renderiza ambos campos, el estudiante vería el pasaje de Bhután **dos veces**.
  Acción: quitar el pasaje duplicado del campo *stem*, dejando solo la pregunta.

### B8. `ui_leak` — RW Module 2B #11 (`cmsjrny0a01rsqmt1e4bkiwc1`, pág 25) — Baja
- Publicado, *stem*: `"...struggles to relate to it: ______ BEST QUESTION"`.
- Fuente: `"...struggles to relate to it: ______"` — sin el sufijo. `"BEST QUESTION"` parece un
  fragmento de UI mal capturado (posible OCR erróneo de "NEXT QUESTION").
- Acción: quitar el sufijo `" BEST QUESTION"` del *stem*.

### B9. `stem_number_leak` (cosmético) — 18 preguntas R&W
El número de pregunta antepuesto al stem. qids: RW M1 #2,4,6,9,14,16,18,20,22,24; RW M2
#2,4,6,15,17,19,21,24 (ver lista completa reproducible con `node scripts/qa/scan-artifacts.mjs "TEST 9"`).

### B10. Falsos positivos del scanner — sin acción
- **`optLabelLeak` RW M1#8** (`cmsjrnxzn01rdqmt19gxlbog6`): la opción A dice genuinamente "A scarab
  found in a copper mine has shed light on…" — empieza con el artículo "A", no con la letra de opción
  filtrada. Verificado contra la fuente (pág 5): coincide exactamente. Sin defecto.
- **`optDupStim` RW M2#27** (`cmsjrny5a01u8qmt1qjh3jkmh`): pregunta tipo "notas del estudiante" donde
  el *stem* y el *stimulus* comparten las mismas notas (patrón esperado para preguntas de "Command of
  Evidence"). Verificado contra la fuente (pág 36): coincide. Sin defecto (mismo patrón ya documentado
  en TEST 8 B3).

### B11. Imágenes de datos (gráficos) — todas correctas
Las 3 preguntas R&W con imagen tienen el archivo correcto adjunto, verificado contra la fuente:
- RW M1#11 (`08c5b537ee5ddc3a8e8e53bc.jpg`) — line chart "Fatality Density by Distance" (aves/murciélagos).
- RW M2#12 (`4115bf0ff184f7bef4cb5b4d.jpg`) — bar chart "Oxygen Production and Light Intensity".
- RW M2#13 (`d572c19261379f8bdbd5bdd7.jpg`) — line chart "Bird Pass Rate vs. Color Comparisons".

Las 54 preguntas R&W (27+27) fueron inspeccionadas visualmente contra la fuente; stem, stimulus,
opciones e imágenes coinciden salvo los defectos B1-B8.

---

## Verificación de la clave de respuestas

Se comparó `correctAnswer` de las 98 preguntas publicadas contra **tres fuentes independientes**:
1. `Test 9 Ans Key.docx` (tabla compacta por módulo — RW M1, RW M2B, Math M1, Math M2B).
2. `Test9_RW_Answer_Explanations FINAL.docx` (54 bloques "Question N … Correct Answer: Choice X").
3. `Test9_Math ANS Explanations.docx` (44 tablas "QN [tema] Answer: X").

- **R&W (54):** ✔ **54/54 correctas.** `Ans Key.docx` y el DOCX de explicaciones coinciden entre sí y
  con lo publicado en las 54 preguntas, sin una sola discrepancia.
- **Math (44):** ✔ **44/44 correctas** contra `Ans Key.docx` (fuente de mayor confianza — coincide
  también con verificación visual independiente del gráfico en el único punto de conflicto). El DOCX
  de explicaciones de Math coincide en 43/44; la única discrepancia (**M1#21**, explicaciones dice D,
  Ans Key y publicado dicen C) se investigó a fondo con análisis de píxeles del gráfico fuente y se
  determinó que el DOCX de explicaciones contiene el error (ver nota A7) — **no es un defecto de
  producción**.
- **Total: 98/98 respuestas publicadas son correctas.** NUMERIC verificados incluyendo signos
  (`-2, 11`; `-3/25`; `1/10`) y notación con `√`/fracciones.

**TEST 9 no tiene defectos de clave en producción** — se suma a TEST 1-7 y 9 con 100% de claves
correctas; TEST 8 sigue siendo el único con defectos de clave confirmados (2, ya documentados).

---

## Estado de la inspección — TEST 9 CERRADO ✔ (con hallazgos críticos de imagen)
- **Math (44):** inspección visual completa página por página (20 págs) + verificación 1 a 1 de las
  33 imágenes adjuntas (todas abiertas y clasificadas). ✔
- **R&W (54):** inspección visual completa vía dump de texto íntegro (54/54) + muestreo visual amplio
  de páginas (18 de 36 páginas abiertas directamente, cubriendo todos los tipos de pregunta:
  vocabulario, función retórica, textos duales, notas de estudiante, gráficos, convenciones de
  inglés estándar, transiciones) + verificación de las 3 imágenes adjuntas. ✔
- **Conteo de preguntas:** 98/98 publicadas, sin huecos de módulo/secuencia.
- **Claves de respuesta:** ✔ **98/98 correctas** (ver sección dedicada arriba).
- **Hallazgo más grave:** 3 preguntas Math (`image_missing` crítico: M1#18, M2#14, M2#15) son
  **irresolubles** tal como están publicadas — el diagrama/figura/histograma necesario fue reemplazado
  por una captura redundante del panel de opciones del reproductor, igual que en TEST 5/7/8. Sumado a
  eso, TEST 9 tiene un patrón nuevo no visto con esta claridad en tests previos: **contenido que migra
  entre preguntas vecinas** (RW M2#20↔#21 opción/stimulus intercambiados; RW M2#14←#15 stimulus
  duplicado) — 4 casos — más 2 `stem_option_leak` (opciones duplicadas en el stem, patrón "notas del
  estudiante") y 1 `stimulus_dup_in_stem` (pasaje duplicado stem+stimulus). El perfil general de TEST 9
  es "imagen crítica" (3) + "contenido cruzado entre preguntas vecinas" (4) + 19 `redundant_ui_image`
  + 1 error de transcripción matemática — sin ningún defecto de clave.
