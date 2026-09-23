# QA TEST 10 — inconsistencias publicado vs fuente

**Fecha:** 2026-09-22 · **Método:** inspección visual (Claude) de las 98 preguntas publicadas
página por página contra la fuente, barrido determinístico de artefactos (`scan-artifacts.mjs`),
detección programática de contenido duplicado/desplazado entre preguntas vecinas, y
reconstrucción/verificación de la clave de respuestas desde `TEST 10 ANS KEY.docx` +
`Test10_Math_Answer_Explanations.docx` + `Test10_RW_Answer_Explanations.docx`. Solo lectura
(no se modificó contenido oficial ni `dev.db`).

- **Fuente Math:** `files_to_load/MOCK EXAMS/TEST 10/MATH/Test 10 Innov. Math.pdf` (19 págs,
  capturas del reproductor tipo College Board).
- **Fuente R&W:** `files_to_load/MOCK EXAMS/TEST 10/READING AND WRITING/INNOVATORS TEST 10 RW 1, 2B.pdf`
  (35 págs, capturas del reproductor; 1–2 preguntas por página).
- **Alineación:** Math y R&W por número de página del candidato (`IngestPageArtifact.pageNumber`),
  confiable y consistente para ambas secciones (19 págs Math cubren M1#1–M2#22; 34 de 35 págs R&W
  cubren M1#1–M2#27, mapeo 1:1 verificado).
- Preguntas publicadas: **98** (RW 27+27, Math 22+22) — confirmado con `resolveTestQuestions(db,"TEST 10")`.
  Todas `PUBLISHED`, sin huecos de módulo/secuencia.

---

## Estado de los "stragglers" reportados en memoria — TODOS RESUELTOS

La memoria previa (`test10-completion-progress`) marcaba como pendiente: *"2 option stragglers,
12 stimuli (visual), create M2B#1/#2, stemless M2B#12, verify M1#11/#23 answers"*. Estado actual:

| Straggler | Estado actual |
|---|---|
| Math M2B#1 (círculo Q, diámetro) | ✔ Presente, contenido completo, clave `C` correcta |
| Math M2B#2 (ecuación 3x−x(7−8)+12=...) | ✔ Presente, contenido completo, clave `A` correcta |
| Math M2B#12 "stemless" | ✔ Ya NO está sin stem: `"12.\n\n$$4|12-2x|+12|6-x|=140$$\nWhat is the positive solution..."`, clave `13` correcta |
| RW M1#11 respuesta a verificar | ✔ Verificada: publicado `D`, explicación confirma **D** ("Choice D is the best answer...") |
| RW M1#23 respuesta a verificar | ✔ Verificada: publicado `D`, explicación confirma **D** ("Choice D is the best answer...") |
| "12 stimuli (visual)" pendientes | ✔ Las 54 preguntas R&W tienen stimulus no vacío. **Pero la inspección de esta ronda encontró que 3 de esos stimuli visualmente "no vacíos" contienen el texto EQUIVOCADO** (ver B5–B7 abajo) — un defecto distinto y más grave que el hueco original, no detectable solo con un chequeo de "¿está vacío?" |

Es decir: los huecos de promoción originales (preguntas faltantes o sin stimulus) están cerrados,
pero la inspección de contenido de esta ronda encontró **defectos de fidelidad nuevos** no
capturados por el estado "no vacío" — ver el resumen de defectos.

---

## Resumen de defectos

| Clase | Cantidad | Severidad | Dónde |
|---|---|---|---|
| `broken_question` — stem colapsado a solo el número; el enunciado real se volcó dentro de la opción A, que perdió su texto real | **1** | **Crítica** | Math M1#7 |
| `image_missing` — imagen requerida (gráfico) reemplazada por captura del panel de opciones | **1** | **Crítica** | Math M1#16 |
| `image_incomplete` — solo se adjuntó la mitad del diagrama (Data Set A), falta Data Set B, necesario para responder | **1** | **Crítica** | Math M1#19 |
| `stimulus_bleed` (intercambio de contenido) — el stimulus mostrado es un duplicado truncado del de OTRA pregunta anterior; no corresponde a las opciones de la propia pregunta | **3** | **Crítica** | RW M2#21, #23, #25 |
| `stimulus_bleed` (pérdida de la oración con el blank) — falta la primera oración del stimulus, que contenía el `_____`; sin blank visible la pregunta es irresoluble | **1** | **Crítica** | RW M1#4 |
| `stimulus_bleed` (recorte de introducción, blank intacto) | 1 | Media | RW M1#19 |
| `stimulus_bleed` + `ui_leak` combinados (texto de la opción D de la pregunta anterior + "➤ COME BACK LATER" al inicio del stimulus) | 1 | Media | RW M1#15 |
| `option_text_wrong` — opción D contiene, pegado al final, el stimulus completo (o parcial) de la pregunta siguiente de la misma página | **14** | Media | ver B-series abajo |
| `option_text_wrong` — stimulus con el Texto 1/Texto 2 de la pregunta siguiente duplicado al final (contenido propio intacto) | 1 | Media | RW M2#8 |
| `ui_leak` — header de módulo (`# Test 10 Innovator` / `Math Module 1`) volcado al inicio del stem | 1 | Alta | Math M1#1 |
| `redundant_ui_image` — `imageUrl` es una captura del panel de opciones/NUMERIC vacío en vez de no llevar imagen | **20** | Media | Math M1 y M2, ver A-series |
| `option_text_wrong` (glyph OCR suelto `■` al final de la opción D) | 2 | Baja | Math M1#7, M1#8 |
| `option_text_wrong` (flecha `➤` suelta al final de la opción D) | 1 | Baja | RW M1#14 |
| palabra duplicada suelta ("The ") al inicio del stimulus | 1 | Baja | RW M1#21 |
| `stem_number_leak` — número de pregunta antepuesto al stem (cosmético, sistemático) | 61 | Baja | RW M1/M2, Math M1/M2 (reproducible con el scanner) |
| Falsos positivos del scanner (`optLabelLeak`, `optDupStim`) — texto legítimo, sin acción | 4 | Info | RW M2#8 optA, Math M2#8 optA, RW M1#26/#27 (preguntas tipo "student notes") |

**Clave de respuestas: 98/98 correctas** (ver sección dedicada). Ninguno de los defectos de arriba
altera la letra/valor de la respuesta correcta almacenada — todos son defectos de **fidelidad del
contenido mostrado**, no de calificación.

---

## A. MATH (44/44 inspeccionadas, página por página, 19 págs)

### A1. `broken_question` — Math Module 1 #7 (`cmsnffuwf000l0mmx4vvrlqaw`, pág 3) — **CRÍTICA**
- Publicado: `stem = "7."` (solo el número, sin enunciado). Opción A publicada:
  `"phone company collects data on a random sample of 300 customers for six months. They
  determined the longest phone call each customer made, and then found the average time of the
  longest phone call for each month. The results are shown in the line graph. Which of the
  following can be inferred about all of the phone company's customers?"` (el enunciado completo
  de la pregunta, con la "A" inicial faltante, volcado dentro de la opción A).
- Fuente (pág 3): stem real = *"A phone company collects data on a random sample of 300 customers
  for six months. ... Which of the following can be inferred about all of the phone company's
  customers?"*; **opción A real = "The longest call of any customer is 30 minutes."** — texto que
  se perdió por completo, reemplazado por el enunciado.
- Opciones B, C publicadas coinciden con la fuente. Opción D publicada tiene además un glyph OCR
  suelto: `"The longest phone call anyone made during month 3 was 25 minutes. ■"`.
- Es la única pregunta de TEST 10 con stem colapsado — verificado programáticamente (0 stems
  adicionales con longitud < 8 caracteres).
- Impacto: tal como está publicada, la pregunta es **irresoluble** — un estudiante ve solo "7."
  como enunciado y una opción A que repite la pregunta en vez de dar una respuesta.
- Acción: restaurar `stem` = *"A phone company collects data on a random sample of 300 customers
  for six months. They determined the longest phone call each customer made, and then found the
  average time of the longest phone call for each month. The results are shown in the line graph.
  Which of the following can be inferred about all of the phone company's customers?"*; restaurar
  opción A = `"The longest call of any customer is 30 minutes."`; quitar el `■` de la opción D.
  (La clave `B` ya es correcta y no requiere cambio.)

### A2. `image_missing` — Math Module 1 #16 (`cmsnffuyr001q0mmxjm8sgd11`, pág 6) — **CRÍTICA**
- Stem: *"The function f(x) is graphed on the coordinate plane, where f(x) = ax⁴+bx³+cx²+dx+e...
  For how many values of x does f(x) = 0?"* — requiere leer el número de cruces con el eje x en la
  gráfica cuártica mostrada en la fuente (curva con mínimo local, máximo local y dos "valles").
- `imageUrl` publicado (`33688fe2e8fa459215cafe2a.jpg`) **no es la gráfica**: es una captura del
  panel de opciones del reproductor (`A) Zero  B) One  C) Two  D) Four` + botón "COME BACK LATER").
  La curva real nunca se adjuntó.
- Sin la gráfica, la pregunta es irresoluble (la respuesta correcta `D` = cuatro cruces solo puede
  leerse contando los cruces con el eje x en la imagen fuente).
- Acción: adjuntar la imagen de la gráfica cuártica de la pág 6 de la fuente.

### A3. `image_incomplete` — Math Module 1 #19 (`cmsnffuz3001x0mmxlkruutzz`, pág 7) — **CRÍTICA**
- Stem: *"The dot plot shows the distribution of values in two data sets. Which of the following is
  true about the standard deviations of two data sets?"* — requiere comparar **Data Set A y Data
  Set B**, mostrados lado a lado en la fuente.
- `imageUrl` publicado (`2025a8ffac8a6b6ffcbc9832.jpg`, 141×110 px) contiene **solo "DATA SET A"**;
  "DATA SET B" no está en la imagen adjunta — el recorte se hizo incompleto.
- Sin ver Data Set B, un estudiante no puede verificar la comparación de desviaciones estándar
  (la explicación oficial confirma que ambos sets tienen la misma forma/dispersión, algo que solo
  se puede constatar viendo ambos dot plots).
- Acción: reemplazar la imagen por el recorte completo de la pág 7 que incluya ambos dot plots
  ("DATA SET A" y "DATA SET B").

### A4. `ui_leak` — Math Module 1 #1 (`cmsjrnu6000gtqmt1ii0ab5tx`, pág 1) — **Alta**
- Stem publicado: `"# **Test 10 Innovator**\n**Math Module 1**\n\n1. Scott works at a job for four
  hours. He spent $18 of his earnings for lunch, and has $42 remaining. How many dollars did he
  earn per hour at the job?"` — se filtró el título/header de la fuente ("Test 10 Innovator" /
  "Math Module 1") al inicio del stem, además del número "1.".
- Fuente (pág 1): el header es parte del layout de la página (título del documento), no del
  enunciado.
- Nota: este qid usa el prefijo antiguo (`cmsjrnu6…`), distinto del resto de Math M1
  (`cmsnffu…`) — remanente de una promoción anterior, igual al patrón documentado en TEST 8 para
  las preguntas "#1" de cada módulo.
- Acción: quitar `"# **Test 10 Innovator**\n**Math Module 1**\n\n1. "` del inicio del stem, dejando
  solo `"Scott works at a job for four hours..."`.

### A5. `redundant_ui_image` — 9 preguntas Math M1, 11 preguntas Math M2 (20 total) — Media
`imageUrl` poblado con una captura del panel de opciones o del recuadro vacío de respuesta NUMERIC,
en preguntas que no llevan diagrama en la fuente (el contenido, si lo había, ya está en el stem
como texto). No afecta la resolubilidad, es ruido visual/de datos. Verificado abriendo cada imagen:

- Math M1: **#1** (`a3427a41…`, pág 1 — además tiene el `ui_leak` de A4), **#2** (`86b539a4…`,
  pág 1), **#3** (`953d2a0b…`, pág 1), **#5** (`60312831…`, pág 2, blank NUMERIC), **#9**
  (`c4960d60…`, pág 4, blank NUMERIC), **#17** (`011c1007…`, pág 6, blank NUMERIC), **#18**
  (`2efb132e…`, pág 7, blank NUMERIC), **#21** (`eee1f27c…`, pág 8), **#22** (`af4cf2db…`, pág 9).
- Math M2: **#1** (`ee0fd102…`, pág 9), **#2** (`ca468ae0…`, pág 9), **#3** (`f7a67653…`, pág 10),
  **#5** (`1bb0738f…`, pág 11, blank NUMERIC), **#7** (`79243484…`, pág 12), **#8** (`3271ec30…`,
  pág 12), **#12** (`a2206b16…`, pág 14, blank NUMERIC), **#19** (`7b68439f…`, pág 18, blank
  NUMERIC), **#20** (`30b7e27b…`, pág 18), **#21** (`d24683e2…`, pág 19, blank NUMERIC), **#22**
  (`74366561…`, pág 19).

Verificadas como **correctas** (imagen real, no redundante): Math M1 #7 (line graph "AVERAGE LENGTH
OF LONGEST PHONE CALLS" — pero la pregunta en sí está rota, ver A1), M1 #8 (triángulo rectángulo
ABC), M1 #16 (ver A2, imagen equivocada), M1 #19 (ver A3, imagen incompleta), M1 #20 (parábola
h(x)), M2 #4 (gráfica de ahorros de Maya), M2 #6 (scatterplot "Racing Laps Over Time"), M2 #11
(histograma "Data Collected for Set X"), M2 #13 (gráfica cúbica f(x)), M2 #15 (tabla x/f(x) — sin
la cual la pregunta también sería irresoluble, y está correctamente adjunta), M2 #17 (diagrama de
triángulos con rectas paralelas m, n). Estas 11 preguntas tienen el diagrama/tabla correcto
adjunto, sin defecto.

### A6. `option_text_wrong` (glyph OCR suelto) — Math M1#7 (ver A1), M1#8 (`cmsnffux1000q0mmxic96gfpq`, pág 3) — Baja
- M1#8 opción D publicada: `"116 ■"` → fuente (pág 3): `"116"`. Glyph suelto sin impacto en la
  legibilidad de la respuesta (la letra D sigue siendo correcta), pero es ruido de OCR.
- Acción: quitar el `■` final.

Las 44 preguntas Math fueron inspeccionadas visualmente página por página (19 págs) contra el
contenido publicado; fuera de los defectos anotados arriba, stem/opciones/respuesta coinciden con
la fuente para las 41 preguntas restantes.

---

## B. READING & WRITING (54/54 inspeccionadas, página por página, 34 de 35 págs)

### B1. `stimulus_bleed` (blank perdido) — RW Module 1 #4 (`cmsjrnsxq0008qmt1wxyfhfiq`, pág 2) — **CRÍTICA**
- Publicado: `stimulus = "A study led by Jeffrey M. Ellenbogen demonstrates that individuals who
  slept after learning were significantly more likely to recall the information with greater
  accuracy compared to those who remained awake. The findings of the study suggest that sleep
  plays a crucial role in improving the ability to recall information through processing and
  combining newly acquired knowledge."` — **no contiene ningún `_____`**.
- Fuente (pág 2): la oración inicial real es *"While all the benefits of sleep have yet to be
  discovered, research has shown that the brain works to `_____` memories during a sleep cycle."*
  — esta oración (la única con el blank que hay que completar) se perdió por completo; lo que
  sobrevivió es solo el contexto de apoyo.
- Impacto: el stem pide *"Which choice completes the text..."* pero el texto mostrado no tiene
  ningún hueco que completar — irresoluble tal como está.
- Verificado programáticamente: es la única pregunta de tipo "completes the text" en todo TEST 10
  sin ningún carácter `_` en su stimulus.
- Acción: restaurar la oración perdida al inicio del stimulus.

### B2–B4. `stimulus_bleed` (intercambio de contenido) — RW Module 2B #21, #23, #25 — **CRÍTICA (3)**
Patrón sistémico: en tres pares consecutivos de páginas, el stimulus real de la pregunta **impar**
(2ª de la página) terminó pegado al final de la opción D de la pregunta **par** anterior (ver
B5–B7), y en su lugar el campo `stimulus` de la pregunta impar quedó con un **duplicado truncado
del stimulus de una pregunta 2–3 posiciones antes**, que no tiene nada que ver con sus propias
opciones.

- **RW M2#21** (`cmsjrnt2e002mqmt1lj54y0xy`, pág 31) — Publicado: `stimulus = "Lil Nas X featuring
  Billy Ray Cyrus, broke multiple Billboard records and had wide-ranging impacts on the music
  industry. ... _____ multiple generations of music lovers together, and revived the career of a
  beloved country music icon."` — esto es un duplicado truncado (falta el arranque `"Old Town
  Road," the hit by`) del stimulus de **M2#18** (pág 30, "Old Town Road" / Lil Nas X). El stimulus
  real de M2#21 (Ponzi scheme) sobrevive solo como texto bleed al final de la opción D de **M2#20**
  (ver B6). Las opciones publicadas de M2#21 (`cash it / cash: it / cash, it / cash—it`) sí son las
  correctas para la pregunta de Ponzi scheme — coinciden con la fuente pág 31, confirmando que el
  desajuste es solo en el `stimulus`.
- **RW M2#23** (`cmsjrnt2t002yqmt1qv2l69qf`, pág 32) — Publicado: `stimulus = "The United States
  Department of Agriculture (USDA) monitors food accessibility across the country. In 2022, ______
  estimated that over 6 percent of US residents could not purchase fresh food within a reasonable
  distance."` — duplicado de la cola del stimulus de **M2#20** (food deserts). El stimulus real de
  M2#23 (squirrel monkeys / deforestación) sobrevive al final de la opción D de **M2#22** (ver B7).
  Las opciones publicadas (`there is a major disadvantage that squirrel monkeys...`, etc.) sí
  corresponden a la pregunta real de squirrel monkeys, confirmando el mismo patrón.
- **RW M2#25** (`cmsjrnt38003aqmt1041w3n5d`, pág 33) — Publicado: `stimulus = "Annual competitions
  were held in Boston, for men and women separately, to determine the fastest typesetter or
  'swift.' ... The success of these women opened the door for female admission into Boston's
  Typographical Union a few months later."` — duplicado de la cola del stimulus de **M2#22**
  (typesetting contests). El stimulus real de M2#25 (Boeing 747 / "the Incredibles") sobrevive al
  final de la opción D de **M2#24**. Opciones publicadas (`Subsequently, / Accordingly, / However,
  / In fact,`) sí corresponden a la pregunta real del Boeing 747.
- Impacto: en las tres, el estudiante lee un pasaje que **no tiene relación con las opciones** que
  debe elegir — la pregunta es confusa/irresoluble en su forma actual aunque la clave almacenada
  (`correctAnswer`) sea la correcta para el contenido real (verificado contra los documentos de
  explicación, ver sección de clave).
- Acción: restaurar el `stimulus` real de cada una a partir del texto que quedó bleed en la opción D
  de la pregunta anterior (ver B6–B8) — quitando de paso ese bleed de la opción D correspondiente.

### B5. `stimulus_bleed` + `ui_leak` — RW Module 1 #15 (`cmsjrnt130025qmt1mq5k6kky`, pág 10) — **Media**
- Publicado: `stimulus = "advancements and for ➤ COME BACK LATER In 2021, archaeologist Zahi
  Hawass uncovered an ancient metropolis in Luxor, Egypt..."` — al inicio se filtró la opción D de
  la pregunta anterior (M1#14, "advancements and for") seguida del botón de UI "➤ COME BACK LATER",
  antes de empezar el stimulus real de M1#15.
- Fuente (pág 10): el stimulus de M1#15 empieza directamente en *"In 2021, archaeologist Zahi
  Hawass..."*.
- Relacionado: RW M1#14 (`cmsjrnt0v001zqmt1m8c5b4l0`) opción D publicada = `"advancements and for
  ➤"` (con la flecha suelta) → fuente: `"advancements and for"`. La clave de M1#14 es `C`, no se ve
  afectada.
- Acción: quitar el prefijo `"advancements and for ➤ COME BACK LATER "` del stimulus de M1#15;
  quitar el `" ➤"` final de la opción D de M1#14.

### B6–B8. `option_text_wrong` — 14 preguntas con el stimulus de la siguiente pregunta pegado al final de la opción D — Media
Patrón sistémico (visible en las páginas con 2 preguntas): al final del texto de la opción D se
pegó, sin separador, el stimulus completo (o parcial) de la pregunta siguiente en la misma página.
No cambia la letra de la opción D en sí (la clave sigue siendo correcta), pero ensucia visualmente
la última opción con un párrafo entero ajeno.

| Pregunta (opción D con bleed) | qid | pág | Contiene bleed de |
|---|---|---|---|
| RW M1#1 | `cmsjrnsw10000qmt1eqc6f6pv` | 1 | M1#2 |
| RW M1#3 | `cmsjrnsxb0002qmt1hmsu0g3b` | 2 | M1#4 |
| RW M1#16 | `cmsjrnt1a002bqmt16c5o7waw` | 11 | M1#17 |
| RW M1#18 | `cmsjrnt1o002fqmt1u4dkbha5` | 12 | M1#19 |
| RW M1#20 | `cmsjrnt22002jqmt1pv7adl76` | 13 | M1#21 (+ palabra suelta "The" duplicada en M1#21, ver B9) |
| RW M1#22 | `cmsjrnt2i002nqmt1uov33jv1` | 14 | M1#23 |
| RW M2#5 | `cmsjrnsyc000jqmt1zsjwuywp` | 21 | M2#6 |
| RW M2#10 | `cmsjrnt06001lqmt16edse07w` | 24 | M2#11 |
| RW M2#16 | `cmsjrnt1e002cqmt1nie20dsk` | 29 | M2#17 |
| RW M2#18 | `cmsjrnt1s002gqmt1ulxf4lm8` | 30 | M2#19 |
| RW M2#20 | `cmsjrnt26002kqmt1v1jrud3i` | 31 | M2#21 real (ver B2 — este bleed es la única fuente recuperable del stimulus real de M2#21) |
| RW M2#22 | `cmsjrnt2m002sqmt1dwpxzyvd` | 32 | M2#23 real (ver B3) |
| RW M2#24 | `cmsjrnt310034qmt1kw37nf0u` | 33 | M2#25 real (ver B4) |
| RW M2#26 | `cmsjrnt3g003gqmt1q4mj9iqb` | 34 | M2#27 (M2#27 en sí está intacto, este bleed es inofensivo) |

Ejemplo verbatim (RW M2#10, pág 24): opción D publicada = `"A walled garden outside of his city
\"A Thread Without a Knot\" is a 1920 short story by Dorothy Canfield Fisher. The protagonist
Harrison, much to the dismay of his professor, adopts a casual, apathetic approach to education:
______"` → debe quedar solo `"A walled garden outside of his city"`.

- Acción: truncar cada opción D al texto real de la propia opción (cortando en el primer carácter
  del stimulus de la siguiente pregunta). Para M2#20, M2#22 y M2#24, el texto cortado es
  precisamente el que hay que usar para restaurar el `stimulus` de M2#21/#23/#25 (ver B2–B4) antes
  de descartarlo de la opción D.

### B9. Palabra duplicada suelta — RW Module 1 #21 (`cmsjrnt2a002lqmt1ctzcykx6`, pág 13) — Baja
- Publicado: `stimulus = "The In 1834, Myra Clark Gaines initiated a lawsuit..."` — sobra un `"The
  "` suelto al inicio (remanente del bleed de la opción D de M1#20, que también empieza con "The
  In 1834..." — ver B6).
- Acción: quitar el `"The "` sobrante del inicio del stimulus.

### B10. `stimulus_bleed` (truncamiento de introducción, blank intacto) — RW Module 1 #19 (`cmsjrnt1w002hqmt10ya7zghr`, pág 12) — Media
- Publicado: `stimulus` empieza en *"In the early 2020s, supporters of the Independent State
  Legislature theory argued..."* — falta la oración introductoria de la fuente: *"One objective of
  the Supreme Court is to ensure the democratic integrity of not only federal elections but state
  elections as well."*
- A diferencia de B1 (M1#4), aquí el `_____` sí está presente más adelante en el texto
  (`"the Supreme _____ unbridled authority..."`), por lo que la pregunta sigue siendo técnicamente
  resoluble — se pierde solo contexto introductorio, no el blank en sí. Severidad Media, no
  Crítica.
- Acción: restaurar la oración introductoria al inicio del stimulus.

### B11. `option_text_wrong` (duplicado no crítico) — RW Module 2B #8 (`cmsjrnsza0015qmt1bf7ttfky`, pág 23) — Media
- Publicado: el `stimulus` de M2#8 (discurso de Theodore Roosevelt, correcto y completo) tiene
  pegado al final, sin separador, el **Texto 1 / Texto 2 completos de M2#9** (Tulip Mania).
  A diferencia de B2–B4, aquí el contenido propio de M2#8 está intacto — es un duplicado añadido,
  no un reemplazo. M2#9 en sí tiene su propio stimulus completo y correcto (no está vacío ni
  afectado).
- Acción: cortar el `stimulus` de M2#8 en `"...those cold and timid souls who neither know victory
  nor defeat."`, eliminando el duplicado de Texto 1/Texto 2.

### B12. Falsos positivos del scanner — Info, sin acción
- `optLabelLeak` en RW M2#10 opción A (`"A palatial estate for recreation"`) y Math M2#8 opción A
  (`"A random sample of followers..."`): el regex `^A\s` detecta la letra "A" como si fuera la
  etiqueta de opción filtrada, pero en ambos casos es la primera palabra legítima de la respuesta
  ("A palatial...", "A random..."). Verificado contra la fuente — coincide exactamente. Sin acción.
- `optDupStim` en RW M1#26 (`cmsjrnt3c003bqmt18cnd961d`) y M1#27 (`cmsjrnt3k003lqmt129lmapyo`):
  preguntas tipo "student notes" (Blade Runner / En-Gedi scroll) donde el stimulus son notas de
  investigación y las opciones son síntesis de esas notas — texto compartido es el patrón esperado
  y correcto para este tipo de pregunta (igual que TEST 8 B3). Verificado contra la fuente (págs
  17–18). Sin acción.

### B13. `stem_number_leak` (cosmético) — 33 preguntas R&W
El número de pregunta antepuesto al stem publicado en vez de mostrarse solo en el índice UI.
Sistemático, igual que en tests anteriores. qids reproducibles con
`node scripts/qa/scan-artifacts.mjs "TEST 10"`: RW M1 #2,4,6,8,15,17,19,21,23 (9); RW M2
#4,6,9,11,12,17,19,21,23,25,27 (11); resto de la lista completa de 61 incluye las 22+22 Math (ver
A-series arriba, todas menos M1#1,6,7,21 y M2#... nota: la lista completa la imprime el scanner).

Las 54 preguntas R&W fueron inspeccionadas visualmente página por página (34 de 35 págs — la
última página del PDF no tiene preguntas) contra la fuente; fuera de los defectos anotados arriba,
stem/opciones/imágenes coinciden con la fuente.

---

## Verificación de la clave de respuestas — 98/98 CORRECTAS

Clave reconstruida de tres fuentes y cruzada:
1. `TEST 10 ANS KEY.docx` (tabla con 4 columnas: RW Module 1, RW Mod. 2B, Math Module 1, Math
   Module 2B — con una sección `EXTRA:` al final de la columna Math 2B, ver nota abajo).
2. `Test10_Math_Answer_Explanations.docx` (44 tablas 1×1, una por pregunta, con formato
   `"✓ Correct Answer: <letra/valor> <explicación>"` o, en 4 casos, `"Choice <letra> is
   correct."`).
3. `Test10_RW_Answer_Explanations.docx` (54 tablas 1×1 equivalentes; en 2 casos usa `"Choice
   <letra> is the best answer."`).

Las tres fuentes coinciden en las **98 preguntas**, y las 98 coinciden con `correctAnswer` en la
base de datos:

- **RW Module 1 (27):** 27/27. `1D 2A 3B 4C 5A 6D 7D 8D 9D 10A 11D 12B 13D 14C 15D 16C 17B 18A 19C
  20A 21A 22A 23D 24B 25A 26B 27C`. **M1#11** (`cmsjrnt0a001mqmt1cup0z4r9`) verificado: explicación
  dice *"Choice D is the best answer because it describes data from the table that weaken the
  student's conclusion..."* → publicado `D` ✔. **M1#23** (`cmsjrnt2p002tqmt1aq2natuc`) verificado:
  explicación dice *"Choice D is the best answer. 'Likewise' logically signals that Jackson
  received early success both in her theater and movie careers..."* → publicado `D` ✔.
- **RW Module 2B (27):** 27/27. `1B 2A 3B 4B 5D 6B 7C 8C 9B 10A 11D 12D 13B 14A 15B 16B 17A 18A
  19C 20C 21C 22A 23C 24A 25C 26A 27B`. Incluye las 3 preguntas con `stimulus` intercambiado
  (M2#21=C, M2#23=C, M2#25=C — el defecto de B2–B4 es solo de contenido mostrado, la clave
  almacenada ya corresponde a la pregunta real).
- **Math Module 1 (22):** 22/22. `1C 2B 3B 4A 5:15 6A 7B 8A 9:6 10B 11D 12A 13D 14C 15D 16D
  17:29.25 18:8.5 19C 20C 21B 22B`. Incluye Math M1#7 (clave `B`), correcta a pesar del
  `broken_question` de A1 (el defecto es de stem/opción, no de la letra almacenada).
- **Math Module 2B (22):** 22/22. `1C 2A 3A 4B 5:0.72 6C 7C 8B 9C 10D 11B 12:13 13D 14A 15B 16:0.5
  17B 18C 19:8 20B 21:9 22C`. Incluye M2B#1=C, M2B#2=A, M2B#12=13 (los "stragglers" de memoria,
  todos correctos).
- **Total: 98/98 correctas.** Sin discrepancias de clave en TEST 10.

### Nota — sección "EXTRA" del `ANS KEY.docx` crudo (Math Module 2B)
La columna Math Module 2B del `TEST 10 ANS KEY.docx` termina con una sección adicional:
```
EXTRA:
14. B
21. A
22. B
```
Esto **no coincide** ni con la lista principal del mismo documento (`14:A, 21:9, 22:C`) ni con
`Test10_Math_Answer_Explanations.docx` (`14:A, 21:9, 22:C`, verbatim: *"Choice A is correct. h(x) =
g(x+2)..."* para #14, *"9 We need t such that..."* para #21, *"Choice C is correct. Volume of A:
πr²h..."* para #22) ni con lo publicado (`14:A, 21:9, 22:C`). Las tres fuentes independientes están
de acuerdo entre sí y con la base de datos; la sección `EXTRA:` parece ser un remanente/borrador no
aplicable (posiblemente de otra versión del test o un error de copia en el documento fuente), no
una corrección real. **No se tradujo en ningún defecto de clave** — se documenta por transparencia
pero no requiere acción.

---

## Estado de la inspección — TEST 10 CERRADO ⚠️ (con hallazgos críticos de contenido, clave 98/98 limpia)

- **Math (44):** inspección visual completa página por página (19 págs). ✔ — 1 `broken_question`
  crítico (M1#7), 1 `image_missing` crítico (M1#16), 1 `image_incomplete` crítico (M1#19), 1
  `ui_leak` de header (M1#1), 20 `redundant_ui_image`, 2 glyphs OCR sueltos.
- **R&W (54):** inspección visual completa página por página (34/35 págs). ✔ — 4 `stimulus_bleed`
  críticos (1 blank perdido + 3 intercambios de contenido en cadena M2#20→21, M2#22→23,
  M2#24→25), 14 `option_text_wrong` por bleed de la siguiente pregunta en la opción D, 1 bleed no
  crítico de Texto1/Texto2 duplicado, 1 combo stimulus_bleed+ui_leak, 1 palabra suelta duplicada,
  61 `stem_number_leak` (cosmético, Math+RW combinados).
- **Conteo de preguntas:** 98/98 publicadas, sin huecos de módulo/secuencia.
- **Claves de respuesta:** ✔ **98/98 correctas**, incluidas las 5 específicamente señaladas por la
  memoria previa (Math M2B#1, M2B#2, M2B#12, RW M1#11, RW M1#23).
- **Hallazgo más grave:** TEST 10 tiene el perfil de defectos de **fidelidad de contenido** más
  denso encontrado hasta ahora — no por errores de clave (0, la clave está impecable) sino por un
  patrón sistémico de *bleed* entre preguntas vecinas de la misma página que, en 3 casos de R&W
  Module 2B (M2#21, #23, #25), llega a **reemplazar completamente el stimulus mostrado por el de
  otra pregunta**, y en Math M1#7 colapsa el stem completo dentro de una opción. Estos 7 casos
  (Math M1#7, M1#16, M1#19, RW M1#4, RW M2#21/#23/#25) hacen que la pregunta, tal como está
  publicada hoy, sea confusa o irresoluble para un estudiante — prioridad máxima de fix, por encima
  de los 14 bleeds cosméticos de opción D y los 20 `redundant_ui_image`.
