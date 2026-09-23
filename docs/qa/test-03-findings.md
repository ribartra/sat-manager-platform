# QA TEST 3 — inconsistencias publicado vs fuente

**Fecha:** 2026-09-22 · **Método:** inspección visual (Claude) de las 98 preguntas publicadas contra la
imagen de su página fuente (cobertura completa: 16/16 páginas Math, 31/31 páginas R&W) + barridos
automáticos por regex (`scripts/qa/scan-artifacts.mjs`) sobre las 98. Solo lectura (no se modificó
contenido oficial ni `dev.db`).

- **Fuente Math:** `files_to_load/MOCK EXAMS/TEST 3/MATH/Test 3 REV Math modules 1&2(A and B).pdf` (16 págs, capturas del reproductor).
- **Fuente R&W:** `files_to_load/MOCK EXAMS/TEST 3/READING AND WRITING/INNOV test 3 R&W mod. 1 and 2B.pdf` (31 págs; ~2 preguntas por página en orden, pasajes largos ocupan una página completa).
- **Clave de respuestas:** `ANS Key Test 3.docx` — tabla única de 5 columnas (RW Módulo 1, RW Módulo 2
  Easy [=2A, se ignora], RW 2 Hard [=Módulo 2B, la que usa la plataforma], MATH 1, MATH 2B). Re-extraída
  íntegra con python-docx (celdas Math truncadas en un dump previo). Las columnas MATH 1 y MATH 2B tienen
  además una sección "EXTRA" al final con 2 notas cada una (ver §C, causa raíz).
- **Alineación:** Math por `pageNumber` del candidato (fiable, 1:1 con la página del PDF); R&W por
  `pageNumber`/`moduleSeq`, confirmada visualmente en las 31 páginas.
- Preguntas publicadas: 98 (RW 27+27, Math 22+22). Todas `PUBLISHED`.

> Nota: las páginas fuente son **capturas del reproductor tipo College Board** (botones NEXT/PREV
> QUESTION, flag "COME BACK LATER", marcas ✗). Ese *chrome* de UI y el hecho de que 1-2 preguntas
> compartan página son la causa de casi todos los defectos: contenido de la pregunta **siguiente**
> sangra dentro de la última opción o del stem/stimulus de la pregunta actual.

---

## Resumen de defectos

| Clase | Cantidad | Severidad | Dónde |
|---|---|---|---|
| `broken_question` — imagen incompleta (falta 1 de 2 datasets) + opciones íntegramente duplicadas de otra pregunta | **1** | **Crítica** | Math M1 #17 |
| `stem_bleed` — stem inundado (~1300 car.) con el dump de las 4 opciones + el stimulus COMPLETO de la pregunta siguiente + resto de chrome UI | **1** | **Crítica** | R&W M1 #12 |
| `option_text_wrong` / `stimulus_bleed` — una opción reemplazada por el stimulus COMPLETO de la pregunta siguiente | **2** | Alta | R&W M2 #1 (opt D), M2 #19 (opt D) |
| `option_text_wrong` — opciones A/B mezcladas/corruptas (letra de respuesta correcta) | 1 | Media | Math M2 #19 |
| `ui_leak` — "COME BACK LATER" filtrado dentro del stem | 3 | Media | Math M1 #2, #11, #13 |
| `ui_leak` — dump de las 4 opciones (con o sin marcas "x A/B/C/D") pegado al final del stem | 5 | Media | R&W M1 #2, #8, #9, #21, #22 |
| `content_math_error` — símbolo/variable mal parseado (no cambia la respuesta) | 2 | Baja | Math M1 #20 (° → `*`), Math M2 #17 (variable `g` → literal `9` dentro del `\sqrt{}`) |
| `stimulus_bleed` — palabra suelta de la opción anterior pegada al inicio del stimulus | 1 | Baja | R&W M2 #24 ("For " sangrado desde M2 #23 opt A "Literature **for**") |
| `stem_number_leak` — nº de pregunta antepuesto al stem | 67 (Math 44/44 uniforme + RW 23/54 inconsistente) | Baja / cosmética | Ver detalle §B7 |
| `source_error` (informativo, NO es defecto de parseo) — la misma pregunta ("Frances Perkins…") aparece literalmente duplicada en el PDF fuente, en M1 y en M2B | 2 qids | Info | R&W M1 #24 = R&W M2 #25 |

**Total de preguntas con al menos un defecto de contenido** (excluyendo el `stem_number_leak` cosmético y
el duplicado informativo de fuente): **15 de 98** (≈15%). Ninguna altera la letra/valor de respuesta
correcta (verificado contra la clave, ver §C).

**Falsos positivos verificados y descartados** (barrido automático los marcó, inspección visual confirmó que
son correctos): R&W M2 #14 opción A ("**A** study reveals…" — el artículo legítimo "A", no una letra
filtrada); Math M1 #12 y Math M2 #8 comparten las 4 opciones (−9,−3,3,9) porque `2x²+6x−18=0` y
`3x²+9x−27=0` son la **misma ecuación simplificada** (`x²+3x−9=0`) — coincidencia matemática legítima, no
un error de copiado.

---

## A. MATH (44/44 inspeccionadas, 16/16 páginas)

### A1. `broken_question` — Math Module 1 #17 (`cmsjrntwp00c3qmt1009fvz2k`, pág 6) — **Crítica**
- Pregunta real (fuente): dos dot plots ("SET 1" y "SET 2") comparando media/desviación estándar; 4
  opciones de tipo "La desviación estándar de… es mayor/menor/igual… y la media de Set 1 es
  menor/mayor…". Respuesta correcta en la clave: **C**.
- Publicado: la imagen adjunta (`/uploads/questions/3d9a8a61a57b3a926e0b2cec.jpg`) contiene **solo el dot
  plot "SET 1"**; falta por completo "SET 2" (dato imprescindible para responder).
- Además, las 4 opciones publicadas son una **copia íntegra de las opciones de Math M1 #16** (la pregunta
  de la encuesta del boardwalk: "The ballot measure will pass…", "…at least 51%…", "…between 45.7% and
  47.9%…", "The results don't provide sufficient evidence…") — nada que ver con desviación estándar.
- `correctAnswer` publicado = "C", que coincide con la clave por casualidad de posición, pero el texto de
  la opción C mostrado al alumno es el de M1#16, no el real. Pregunta efectivamente incontestable tal como
  está publicada.
- Acción: (1) completar la imagen con ambos dot plots; (2) reemplazar las 4 opciones por las reales de la
  fuente (pág. 6): A) "desv. est. Set1 > Set2, media Set1 < Set2"; B) "desv. est. Set1 < Set2, media Set1 >
  Set2"; C) "desv. est. iguales, media Set1 < Set2"; D) "desv. est. iguales, media Set1 > Set2".

### A2. `ui_leak` — Math Module 1 #2 (`cmsjrntqd009nqmt1mxv3m4lx`, pág 1) — **Media**
- Stem publicado termina en `...What is the value of $$y$$?\n\n■ COME BACK LATER` → la fuente muestra el
  botón "COME BACK LATER" bajo la caja de respuesta (chrome de UI, no forma parte del enunciado).
- Acción: quitar el sufijo `■ COME BACK LATER`.

### A3. `ui_leak` — Math Module 1 #11 (`cmsjrntsr00bdqmt193hd8bwy`, pág 4) — **Media**
- Mismo patrón: `...what is the value of $$\frac{9x}{12y}$$?\n\n■ COME BACK LATER`.

### A4. `ui_leak` — Math Module 1 #13 (`cmsjrntta00btqmt13xdrew8r`, pág 4) — **Media**
- Mismo patrón: `...What is one possible positive solution to the given equation?\n\n■ COME BACK LATER`.

### A5. `content_math_error` — Math Module 1 #20 (`cmsjrntx500caqmt1bpt36vtp`, pág 8) — **Baja**
- Publicado: `"If sin(C*) = 0.454 and cos(63*) = 0.454, what is the value of C, in degrees?"`.
- Fuente: `sin(C°) = 0.454` y `cos(63°) = 0.454` — el símbolo de grados `°` se parseó como `*`.
- No afecta la respuesta (27).

### A6. `content_math_error` — Math Module 2 #17 (`cmsjrntva00buqmt1gdlz4mhi`) — **Baja/Media**
- Publicado: stem = `"If one of the solutions to the given quadratic equation is $\frac{3+\sqrt{9}}{3}$, what is the value of $g$?"`.
- Fuente (pág. 13): la solución dada es `(3+√g)/3` — la **variable `g`** dentro de la raíz se parseó
  incorrectamente como el literal `9`, dejando un enunciado matemáticamente incoherente (pregunta "¿cuál es
  el valor de g?" pero g ya no aparece en la fórmula mostrada). `correctAnswer` publicado = 42, correcto
  según la clave y verificado independientemente (b = −24·(7/8)... nota: el cálculo real de esta pregunta
  usa suma/producto de raíces de `3x²−6x−11=0`; el valor 42 coincide con la clave y con el propio documento
  de explicaciones).
- Acción: stem debe leer `\frac{3+\sqrt{g}}{3}`.

### Resto de Math (39 preguntas)
Inspección visual completa de las 16 páginas fuente (M1 #1-22, M2 #1-22) confirma stem, stimulus,
imágenes, opciones y respuesta fieles a la fuente, salvo lo listado arriba. Nota aparte: **Math M2 #21**
(`cmsjrnvck00soqmt1vn0qou8q`, tabla `f(x)=24x²+bx+c`) tiene `correctAnswer` publicado = **−21**, que es el
valor matemáticamente correcto (verificado: suma de raíces −15/8+11/4=7/8=−b/24 → b=−21) — coincide con la
nota "EXTRA 21. -21" de la clave, no con el valor de esa misma posición en la tabla principal de la clave
("A"); ver causa raíz en §C. No es un defecto del contenido publicado: la plataforma ya tiene el valor
correcto.

---

## B. READING & WRITING (54/54 inspeccionadas, 31/31 páginas)

### B1. `stem_bleed` — R&W Module 1 #12 (`cmsjrnvgn00tqqmt19m9y0ui2`, pág 6) — **Crítica**
- Pregunta real (fuente, pág. 6): stimulus = *"To Autumn" is a short poem written by John Keats…* (claim
  sobre el poema); stem = *"Which quotation from "To Autumn" most effectively illustrates the claim?"*;
  4 opciones = citas del poema. Todo esto está **correctamente preservado** en los campos `stimulus` y
  `options` publicados.
- Pero el campo **`stem`** publicado además contiene, pegados a continuación: (1) un dump de las 4
  opciones sin marcas de letra, y (2) el **stimulus completo de la pregunta siguiente (#13, sobre la
  salamandra *Tylototriton phukhaensis*)**, terminando en un resto de chrome "MOST QUESTION" — en total
  ~1300 caracteres de basura tras la pregunta real. R&W M1 #13 en sí (`cmsjrnvgz...`) está intacta y
  correcta (no se perdió contenido, solo se duplicó indebidamente dentro de #12).
- Acción: recortar el `stem` de #12 a solo `"Which quotation from \"To Autumn\" most effectively illustrates the claim?"`.

### B2. `option_text_wrong` / `stimulus_bleed` — R&W Module 2 #1 (`cmsjrnvcv00svqmt1524h0aai`, pág 14) — **Alta**
- Opción D publicada: `"revitalized by Korean-American author Min Jin Lee _____ in the world of finance while writing *Free Food for Millionaires*, her 2007 debut novel. In order to better depict the education of one of her central characters, the ambitious Ted Kim, she visited Harvard to audit the sort of business seminars that a real-life Ted would have absorbed."`
- Fuente (pág. 14): opción D = solo `"revitalized by"`. El resto es el **stimulus completo de la pregunta
  siguiente (#2, sobre Min Jin Lee)**, que sangró dentro de la opción D de #1.
- Respuesta correcta = A, no afectada. Acción: opción D = `"revitalized by"`.

### B3. `option_text_wrong` / `stimulus_bleed` — R&W Module 2 #19 (`cmsjrnvic00vmqmt1kie8440h`, pág 25) — **Alta**
- Opción D publicada: `"will accommodate Many organizations are turning to a policy called "job sharing" in an effort to retain good employees. Dividing one full-time job between two employees _____ a company to recruit talented workers who do not have the time or inclination to work 40 hours every week."`
- Fuente: opción D = solo `"will accommodate"`. El resto es el **stimulus completo de la pregunta
  siguiente (#20, "job sharing")**.
- Respuesta correcta = A, no afectada. Acción: opción D = `"will accommodate"`.

### B4. `ui_leak` — dump de opciones pegado al stem — **Media (5)**
El stem conserva el prompt real al inicio, pero además repite las 4 opciones (a veces con marcas "x A/B/C/D"
de cruce de UI) al final. Las opciones en sí (`options[]`) están correctas; es una duplicación cosmética
pero ruidosa.
- **R&W M1 #2** (`cmsjrnvcy00t0qmt19mju2ii4`): `"2. As used in the text, what does the word "foreign" most nearly mean?\n\nx A Contrary\n\nx B Exiled\n\nx C Exotic\n\nx D Remote"`.
- **R&W M1 #8** (`cmsjrnve100tgqmt16c33qeyh`): prompt + `"A The Harts want to keep the party a secret for a time. The Harts have revealed their plans... The Harts are in a state of disorder... The Harts hope that the neighborhood will be more accepting..."`.
- **R&W M1 #9** (`cmsjrnvfy00tiqmt1ds6b6mtd`): prompt + `"A The captain is confident... The boat is surrounded by perils... The men in the boat feel a powerful bond. The boat's crew pities the captain."`.
- **R&W M1 #21** (`cmsjrnvil00vxqmt109g32q09`): `"21. ...conforms to the conventions of Standard English?\n\nx A have been\n\nx B is\n\nx C is being\n\nx D are"`.
- **R&W M1 #22** (`cmsjrnvir00vzqmt1xxam8v0b`): mismo patrón con las opciones "eye's lachrymal gland's / eye's lachrymal gland / eyes lachrymal gland's / eyes' lachrymal glands".
- Acción: recortar el stem al prompt real (antes del primer "x A" / repetición de opción A).

### B5. `stimulus_bleed` — R&W Module 2 #24 (`cmsjrnvj700w4qmt1rfg1dcx6`, pág 28) — **Baja**
- Stimulus publicado: `"For Several international organizations monitor the position of space debris..."`.
- Fuente: el pasaje empieza `"Several international organizations monitor..."` (sin "For"). La palabra
  suelta **"For"** sangró desde la opción A de la pregunta anterior (M2 #23: **"Literature for**").
- Acción: quitar el prefijo `"For "` del stimulus.

### B6. `source_error` (informativo, NO es defecto de parseo) — R&W Module 1 #24 = R&W Module 2 #25
- **R&W M1 #24** (`cmsjrnvj400w3qmt1rwbyj43s`, pág. 10) y **R&W M2 #25** (`cmsjrnvjd00waqmt1kk678x3k`,
  pág. 29) tienen stem, stimulus y las 4 opciones **idénticos** ("Frances Perkins became the first woman
  appointed…"; transición lógica; respuesta C).
- Verificado visualmente en ambas páginas fuente: la pregunta está **duplicada en el propio PDF fuente**
  (aparece completa y verbatim tanto en el bloque de Módulo 1 como en el de Módulo 2 "Hard"). No es un
  error de copiado del promotor; el parseo fue fiel a una fuente que repite la pregunta.
- Sin acción necesaria salvo decisión de producto sobre si conviene tener la misma pregunta en ambos
  módulos del mismo test.

### B7. `stem_number_leak` — nº de pregunta antepuesto al stem — **Baja / cosmética (67 total)**
- **Math (44/44, uniforme):** las 44 preguntas de Math llevan "1.", "2.", … dentro del stem. Consistente
  con TEST 1/2; bajo impacto.
- **R&W (23/54, inconsistente):** M1 #2,4,5,7,9,11,13,15,16,18,19,21,22,24 (14); M2 #2,4,6,8,16,18,20,22,24 (9).
  El resto de R&W no tiene el número filtrado.
- Acción (opcional, cosmética): quitar el prefijo `^\s*\d{1,2}\.\s*` del stem donde aplique.

### Falsos positivos descartados (verificados visualmente)
- **R&W M2 #14** opción A: `"A study reveals that species with greater seed dispersal distances..."` — el
  barrido automático marcó "optA" por el patrón `^A\s+\S`, pero es el artículo legítimo "A" de la oración,
  no una letra de opción filtrada (idéntico a TEST 2 M2 #12). Confirmado contra la fuente (pág. 23): coincide
  verbatim.
- **Math M1 #12 / Math M2 #8** comparten las 4 opciones (−9, −3, 3, 9): `2x²+6x−18=0` (M1#12) y
  `3x²+9x−27=0` (M2#8) son la misma ecuación simplificada (`x²+3x−9=0`, suma de raíces = −3) — coincidencia
  matemática legítima verificada contra ambas páginas fuente (4 y 11), no una duplicación errónea de
  opciones (a diferencia de TEST 1 Math M2#8, que sí era un error real).

### Resto de R&W (44 preguntas)
Inspección visual completa de las 31 páginas fuente confirma stem, stimulus, opciones y respuesta fieles a
la fuente, salvo lo listado arriba.

---

## C. Claves de respuesta — ✔ 98/98 correctas

Se re-extrajo `ANS Key Test 3.docx` (tabla única, 5 columnas) completa con python-docx, incluyendo la
sección "EXTRA" al final de las columnas MATH 1 y MATH 2B, y se comparó contra `correctAnswer` de las 98
preguntas publicadas (mapeo por sección+módulo+`moduleSeq`; RW usa **"RW 2 Hard"** para Módulo 2B, no "RW
Módulo 2 Easy"). **0 discrepancias.**

- **RW Módulo 1 (27):** A A A D C D C B C C B C C A B C A A D B B D A C C B D
- **RW Módulo 2 / "2 Hard" (27):** A B B C D B B D D A B C B C C A A B A B C C A A C D D
- **Math Módulo 1 (22):** D, −2, D, A, C, B, C, A, A, D, 18, B, 2|6, A, C, D, C, 3.2, B, 27, C, 162
- **Math Módulo 2B (22):** D, A, C, D, −12, −6/5, A, B, C, B, A, C, D, 10, −1/2, D, 42, 3, **B**, B, **−21**, D
  (las dos últimas letras en negrita difieren de la tabla principal de la clave — ver causa raíz abajo).

### Causa raíz de la sección "EXTRA" del ANS Key
Las columnas MATH 1 y MATH 2B del docx de clave tienen, tras las 22 respuestas principales, una sección
"EXTRA" con 2 notas cada una:
- **MATH 1:** "21. 113" y "2. -11" — **no corresponden a ninguna pregunta real**: se comprobó contra el
  documento de explicaciones (`Test3 Math Answer Explan_.docx`, alineado 1:1 por encabezado "Question N")
  que M1 Q21 = **C** (fórmula `a=d/(bv²)`, sin sentido tener un valor "113") y M1 Q2 = **−2**, ambos
  coincidiendo con la tabla principal y con lo publicado. Además la página 15 del PDF fuente de Math
  contiene una sección separada **"EXTRA PRACTICE"** con 2 preguntas bonus (arco de circunferencia,
  triángulo con altitud) numeradas también "21." y "22." pero que **no forman parte de las 44 preguntas
  oficiales promovidas** — correctamente excluidas de la publicación. Se interpreta que estas notas "EXTRA"
  de la columna MATH 1 son residuo no aplicable (posible referencia cruzada a ese material bonus, sin
  relación con las preguntas oficiales); no afectan ninguna pregunta publicada.
- **MATH 2B:** "21. -21" y "22. D" — **sí son correcciones reales** a la tabla principal. Verificado
  independientemente: (a) M2B Q21 (tabla `f(x)=24x²+bx+c`, raíces −15/8 y 11/4) → suma de raíces =
  −b/24 = 7/8 → **b = −21** (la tabla principal decía "A", claramente erróneo para una pregunta NUMERIC;
  el propio documento de explicaciones calcula −21 y luego se "autocorrige" a un valor "42" inconsistente
  con su propia álgebra — se confirmó que 42 es el error). (b) M2B Q22: "D" coincide con la tabla principal,
  nota redundante sin cambio real. La plataforma ya tiene el valor correcto (**−21**) para M2#21 — no hay
  defecto que corregir.
- Aparte, se detectó una discrepancia **entre la tabla principal de la clave y el documento de
  explicaciones** en M2B Q19 (transformación de vértice): tabla principal = "A", documento de explicaciones
  marca "B" — pero el texto que el documento de explicaciones pone bajo "B" es literalmente el de la opción
  A de la fuente real. Tras verificar contra la página fuente real (pág. 14: opción A = "right 2, down 3",
  la transformación correcta), se determinó que la **tabla principal de la clave ("A") es la correcta** y
  coincide con lo publicado — el documento de explicaciones tiene su propio error interno de re-etiquetado,
  no la clave ni la plataforma. Este análisis reveló además un defecto de contenido en las opciones
  publicadas de Math M2#19, documentado en A7 abajo.

### A7. `option_text_wrong` — Math Module 2 #19 (`cmsjrnvc900siqmt1cesowz8n`, pág 14) — **Media**
- Fuente (pág. 14): A) "The x-coordinate moves to the right 2 units and the y-coordinate moves 3 units
  down." (correcta) B) "...left 2... down 3." C) "...right 2... up 3." D) "...left 2... up 3."
- Publicado: opción A = `"x moves right 2, y moves 3 units down — same as B, but stated differently."`
  (paráfrasis + coletilla filtrada del documento de explicaciones, no el texto real de la fuente) y opción
  B = `"The x-coordinate moves to the right 2 units and the y-coordinate moves 3 units down."` (esto es
  **el texto real de la opción A de la fuente**, duplicado en B). La opción B real de la fuente ("left 2,
  down 3") **no aparece publicada**. C y D coinciden con la fuente (paráfrasis fieles).
- `correctAnswer` publicado = A, que es correcto en cuanto a **contenido** (la transformación real es
  "right 2, down 3"), pero el texto que ve el alumno en A trae una coletilla espuria y B es una opción
  duplicada/incorrecta en vez de la real.
- Acción: opción A = `"The x-coordinate moves to the right 2 units and the y-coordinate moves 3 units down."`; opción B = `"The x-coordinate moves to the left 2 units and the y-coordinate moves 3 units down."`.

---

## Estado de la inspección — TEST 3 CERRADO ✔

- **Math (44/44):** inspección visual completa de las 16 páginas fuente + barrido automático. Defectos: 1
  `broken_question` (crítico), 1 `option_text_wrong` (media), 3 `ui_leak`, 2 `content_math_error`. Resto
  fiel a la fuente. 1 falso positivo de duplicado de opciones descartado (M1#12/M2#8, coincidencia
  matemática legítima).
- **R&W (54/54):** inspección visual completa de las 31 páginas fuente + barrido automático. Defectos: 1
  `stem_bleed` (crítico), 2 `option_text_wrong`/`stimulus_bleed` (alta), 5 `ui_leak` (dump de opciones), 1
  `stimulus_bleed` menor, 1 duplicado de fuente (informativo). 1 falso positivo de `optLabelLeak`
  descartado (M2#14 opt A, artículo legítimo).
- **Claves de respuesta:** ✔ **98/98 correctas** — 0 discrepancias contra `ANS Key Test 3.docx` (re-extraída
  íntegra), incluyendo NUMERIC multi-valor (M1#13 = "2 or 6", almacenado como `2|6`) y las dos correcciones
  reales de la sección "EXTRA" de la clave (Math M2B #21 = −21, ya correcto en la plataforma). Las notas
  "EXTRA" de la columna MATH 1 (21→113, 2→−11) se investigaron y determinaron no aplicables a ninguna
  pregunta oficial (ver causa raíz §C).

## Causa raíz general
El patrón dominante de TEST 3 es el mismo "sangrado secuencial" de TEST 2 (contenido de la pregunta
siguiente pegado a la última opción o al final del stem de la pregunta actual, por cómo el reproductor
apila 1-2 preguntas por página), pero con dos casos más extremos que en TEST 1/2: (a) Math M1#17, donde
el sangrado fue tan severo que sustituyó por completo las 4 opciones reales por las de la pregunta
anterior (M1#16) y además la imagen quedó incompleta; y (b) R&W M1#12, donde el stem absorbió el stimulus
íntegro de la pregunta siguiente (no solo unas palabras sueltas como en TEST 2). El defecto de TEST 1
([tema/respuesta]) está ausente (0 hits); el `stem_number_leak` reaparece con el mismo patrón inconsistente
de TEST 2 (uniforme en Math, parcial en R&W).
