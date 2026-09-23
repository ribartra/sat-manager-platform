# QA TEST 8 — inconsistencias publicado vs fuente

**Fecha:** 2026-09-22 · **Método:** inspección visual (Claude) de cada pregunta publicada contra la
imagen de su página fuente, más barrido determinístico de artefactos (`scan-artifacts.mjs`) y
reconstrucción de la clave de respuestas desde los dos DOCX de explicaciones. Solo lectura (no se
modificó contenido oficial).

- **Fuente Math:** `files_to_load/MOCK EXAMS/TEST 8/MATH/TEST 8 INNOV MATH MOD 1&2.pdf` (19 págs,
  capturas del reproductor tipo College Board).
- **Fuente R&W:** `files_to_load/MOCK EXAMS/TEST 8/READING AND WRITING/TEST 8 R&W MOD 1 AND 2.pdf`
  (37 págs, capturas del reproductor; ~1-2 preguntas por página, 1 cuando el pasaje es largo).
- **Alineación:** Math y R&W por número de página del candidato (`IngestPageArtifact.pageNumber`,
  confiable para ambas secciones en este test — no hubo que recurrir a alineación secuencial).
- **TEST 8 no tiene `ANS KEY.docx` propio.** La clave se derivó de
  `Test8_Math_Answer_Explanations.docx` y `Test8_RW_Answer_Explanations.docx` (cada explicación
  declara la respuesta correcta), igual que en TEST 2.
- Preguntas publicadas: **98** (RW 27+27, Math 22+22) — el hueco de promoción previo (memoria:
  "Test 8 was ~unpromoted") **ya no existe**; `resolveTestQuestions(db, "TEST 8")` devuelve el
  total completo y todas están `PUBLISHED`.

> Nota: al igual que en tests previos, las páginas fuente son **capturas del reproductor** (botones
> NEXT/PREV QUESTION, flag "COME BACK LATER"). En TEST 8 ese chrome de UI **no se filtró al texto**
> (0 `ui_leak` detectados) — el problema dominante aquí es distinto: **imágenes redundantes de ese
> mismo chrome adjuntas como `imageUrl`**, incluyendo varios casos donde eso reemplaza a un diagrama
> que sí hace falta.

---

## Resumen de defectos

| Clase | Cantidad | Severidad | Dónde |
|---|---|---|---|
| `image_missing` — el `imageUrl` es un screenshot del panel de opciones (o no existe) en vez del diagrama/gráfico requerido por el stem | **4** | **Crítica** | Math M1 #7, M1 #21, M2 #4, M2 #20 |
| `redundant_ui_image` — `imageUrl` poblado con una captura del panel de opciones/NUMERIC cuando la pregunta no necesita imagen (el contenido visual, si existía, ya se transcribió a texto) | **19** | Media | Math M1 #1,2,5,6,9,10,11,12,15,16,17,18; Math M2 #6,7,9,11,12,18,19,22 |
| Clave de respuesta incorrecta (`correctAnswer` no coincide con la explicación oficial) | **2** | **Alta** | RW M2 #1 (pub. C, correcta B); Math M2 #1 (pub. A, correcta B) |
| `type_mismatch` — pregunta MC de 4 opciones en la fuente, promovida como `NUMERIC` sin opciones | 1 | Alta | Math M1 #17 |
| Transcripción numérica incorrecta en el stem (dígito perdido en LaTeX: `5,730` → `0.730`) | 1 | Media | Math M1 #16 |
| `stem_number_leak` — el nº de pregunta ("8.", "16.") antepuesto al stem (cosmético, sistemático) | 59 | Baja | RW M1/M2, Math M1/M2 (ver detalle) |
| `escaped_underscore` — blank `\_\_\_\_\_` que se renderiza literal en vez de `_____` | 1 | Baja | RW M2 #11 |
| Falso positivo del scanner (`optDupStim`) — stimulus y stem legítimamente duplicados (pregunta tipo "notas del estudiante") | 1 | Info | RW M1 #24 |

Las imágenes correctamente adjuntas (bar graph, histograma con el que sí funciona, scatterplot,
tabla, gráfico de dispersión, rectas perpendiculares, parábola, gráfico de inecuación, gráficos de
barras/tablas de R&W) se verificaron una por una — ver sección A/B.

---

## A. MATH (44/44 inspeccionadas, página por página, 19 págs)

### A1–A4. `image_missing` — CRÍTICO (4 preguntas)

Estas cuatro preguntas requieren un diagrama/gráfico para poder resolverse (el stem no da los datos
en texto), pero el único `imageUrl` adjunto es un screenshot del panel de opciones/UI del
reproductor — el diagrama real nunca se adjuntó.

- **Math M1 #7** (`cmsnb3fzg000k0mpdb3ur9ziu`, pág 3) — "What is the volume of the rectangular prism
  shown, in cubic meters?" El stem no da las dimensiones (10×5×7 m aparecen solo en la figura de la
  fuente). `imageUrl` = `731d2376264f0ae8416b0193.jpg`, que es el panel de opciones (88/175/310/350),
  no la caja 3D. Acción: adjuntar la imagen del prisma rectangular (pág 3 de la fuente) o transcribir
  las dimensiones al stem.
- **Math M1 #21** (`cmsnb3g2c001y0mpd76881utf`, pág 9) — histograma "Distance People Traveled for a
  Convention" requerido para estimar la media. `imageUrl` = `6f4eed8e8656499ee8670048.jpg` = panel de
  opciones (24.14/29.97/33.50/40.63), no el histograma. Acción: adjuntar el histograma de la fuente.
- **Math M2 #4** (`cmsnb3g2v002i0mpdrimxrlt4`, pág 11) — triángulo *DEF* con ángulos E=48° y F(marca
  exterior)=106°; el stem no menciona esos valores. `imageUrl` = `746cc04036beee1a9907a7a9.jpg` =
  panel de opciones (26/58/154/206), no el triángulo. Acción: adjuntar la figura del triángulo.
- **Math M2 #20** (`cmsnb3g4m00490mpd1v3v3lb8`, pág 18) — función exponencial *f(x)* graficada; se
  necesita leer *f(-1)* del gráfico para resolver *k*. `imageUrl` = `6645715309b9e6490dd9e6f3.jpg` =
  panel de opciones (-5/-4/4/5), no la curva exponencial. Acción: adjuntar el gráfico de *f(x)*.

Ninguna de estas 4 preguntas es resoluble para un estudiante con el material publicado actual.

### A5. `redundant_ui_image` — 12 preguntas Math M1, 8 preguntas Math M2 (20 total) — Media

`imageUrl` poblado con una captura del panel de opciones (o del recuadro vacío de respuesta NUMERIC)
cuando la pregunta **no** necesita imagen — el contenido relevante ya está en el stem como texto (o
nunca hubo diagrama en la fuente). No afecta la resolubilidad, pero es ruido visual/de datos.

- Math M1: #1 (`47888cff…`), #2 (`2134d3cc…`), #5 (`ed452495…`, blank NUMERIC), #6 (`9accad03…`,
  la tabla de Aditya ya está transcrita en el stem), #9 (`cf1e3e70…`, blank NUMERIC), #10
  (`05ff965b…`), #11 (`7f559e37…`), #12 (`faed74be…`, blank NUMERIC), #15 (`4c3e8890…`), #16
  (`ec7c0c0e…`, blank NUMERIC — ver A7 abajo para el defecto real de esta pregunta), #17
  (`5a1b0847…` — ver A6, esta pregunta tiene un defecto más grave de tipo), #18 (`9b79e055…`, blank
  NUMERIC).
- Math M2: #6 (`f6ffdf87…`), #7 (`834faecd…`, la gráfica de la recta *a* está en la fuente pero el
  enunciado ya da la ecuación algebraica completa — imagen no crítica), #9 (`065bb5d2…`, blank
  NUMERIC), #11 (`61c7d8b6…`), #12 (`2a8c6a35…`), #18 (`76851ed…`, la tabla de camisetas ya está
  transcrita en el stem), #19 (`6d92af07…`), #22 (`fa8ad994…`, las dimensiones de la pirámide *b,
  2b, c* ya están en el stem).

Verificadas como **correctas** (imagen real, no redundante): Math M1 #8 (bar graph "ripe vegetables"),
M1 #13 (parábola *h(x)*), M2 #8 (inecuación lineal graficada — región sombreada), M2 #13
(scatterplot "Cost of a Plumber"), M2 #14 (rectas perpendiculares *m*, *n*). Estas 5 tienen el
diagrama correcto adjunto, sin defecto.

### A6. `type_mismatch` — Math M1 #17 (`cmsnb3g1i001m0mpd5u7uaswv`) — Alta
- Fuente (pág 7): pregunta de opción múltiple con 4 alternativas letradas — A) −9  B) −2  C) 4/5
  D) 18.
- Publicado: `type = NUMERIC`, `correctAnswer = "-9"`, **0 filas en `QuestionOption`** — se promovió
  como pregunta de respuesta libre en vez de opción múltiple.
- Causa probable: el DOCX de explicaciones para esta pregunta específica no usa el formato
  "✓ Correct Answer: A ..." como las demás MC de ese módulo, sino "✓ Correct Answer: −9" (sin letra,
  como las preguntas genuinamente NUMERIC) — el parser probablemente heredó el tipo de esa fuente en
  vez de la fuente visual real.
- El valor "-9" coincide con la opción A, así que la calificación automática (comparación de string)
  da el resultado correcto por coincidencia, pero el estudiante ve un cuadro de texto libre en vez de
  4 opciones — experiencia distinta a la del examen real.
- Acción: reclasificar a `MC` y crear las 4 `QuestionOption` (A: −9, B: −2, C: 4/5, D: 18).

### A7. Transcripción numérica incorrecta — Math M1 #16 (`cmsnb3g1d001l0mpd1lt129hz`) — Media
- Fuente (pág 7): $c(t) = 4{,}000(0.5)^{t/5{,}730}$ (vida media del carbono-14 = 5730 años).
- Publicado: stem = `$$c(t) = 4,000(0.5)^{\frac{t}{0.730}}$$` — el dígito "5" del denominador
  "5,730" se perdió, quedando "0.730". La fórmula mostrada es matemáticamente incorrecta (no
  corresponde a la semivida real), aunque la respuesta NUMERIC almacenada (`5730`) sí es correcta,
  así que la calificación no se ve afectada — es un defecto de fidelidad del contenido mostrado, no
  de la clave.
- Verificado que es un caso aislado: no se encontró otro patrón similar de coma-en-miles perdida en
  el resto del dump de TEST 8.
- Acción: corregir el stem a `\frac{t}{5{,}730}`.

### A8. `stem_number_leak` (cosmético) — 22 preguntas Math
El número de pregunta ("1.", "16.", etc.) queda antepuesto al stem publicado en vez de mostrarse
solo en el índice UI. Sistemático, igual que en tests anteriores; no cambia el enunciado real.
qids: M1#1,2,3,4,5,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22; M2#1,2,3,4,5,6,7,8,9,10,11,12,
13,14,15,16,17,19,20,21,22 (ver lista completa reproducible con
`node scripts/qa/scan-artifacts.mjs "TEST 8"`).

Las 44 preguntas Math fueron inspeccionadas visualmente página por página (19 págs) contra el
contenido publicado; fuera de los defectos anotados arriba, stem/opciones/respuesta coinciden con la
fuente.

---

## B. READING & WRITING (54/54 inspeccionadas, página por página, 37 págs)

### B1. Clave de respuesta incorrecta — RW Module 2B #1 (`cmsjrnwkk0168qmt1r4m1sqcd`) — Alta
- Pregunta: "Conservation efforts to preserve the Great Barrier Reef have been _____..." (pág 20).
  Opciones: A) tentative B) extensive C) contentious D) pretentious.
- `Test8_RW_Answer_Explanations.docx` Q1 Módulo 2B: **"✓ Correct Answer: B — extensive"**, y
  descarta explícitamente C ("Contentious means causing disagreement. The passage does not suggest
  the conservation efforts are disputed").
- Publicado: `correctAnswer = "C"` (contentious). **Discrepancia confirmada.**
- Nota: este qid usa el prefijo antiguo (`cmsjrnwkk…`), distinto del resto de RW M2 (`cmsojfk…`) —
  es la pregunta #1 remanente de una promoción anterior a la que completó el resto del módulo; el
  contenido (stem/stimulus/opciones) es correcto y coincide con la fuente, solo la clave está mal.
- Acción: corregir `correctAnswer` a `B`.

### B2. `escaped_underscore` — RW Module 2B #11 (`cmsojfkrm002s18ppn4eddu0o`) — Baja
- El blank del enunciado ("For example, _____.") quedó como `\_\_\_\_\_` en el stem publicado en vez
  de `_____`. Único caso en TEST 8 (el scanner solo detectó este).
- Acción: reemplazar `\_` por `_`.

### B3. Falso positivo — RW Module 1 #24 (`cmsojfl0c006918pplh78b1aw`) — Info, sin acción
- El scanner marcó `optDupStim` (opción A ⊂ stimulus) porque STIMULUS y STEM contienen texto
  idéntico (las notas del estudiante sobre Assateague Island), seguido en el STEM por la pregunta
  real ("24. The student wants to describe..."). Esto es el patrón esperado y correcto para
  preguntas tipo "student notes" (Command of Evidence / síntesis), verificado contra la fuente (pág
  16) — no es un mal-parseo, la opción A tampoco duplica el stimulus más allá de lo que la pregunta
  exige. No requiere acción.

### B4. `stem_number_leak` (cosmético) — 17 preguntas R&W
Igual que en Math: el número de pregunta antepuesto al stem. qids: RW M1 #2,4,6,8,17,19,21,23; RW
M2 #2,4,7,15,17,19,21,23,25.

### B5. Imágenes de datos (gráficos/tablas) — todas correctas
Las 4 preguntas R&W que dependen de una imagen de datos tienen el archivo correcto adjunto,
verificado visualmente contra la fuente:
- RW M1 #11 (`d11dd8aa…`) — bar chart Moldova (Gagauz/Ukrainian/Russian/Romanian/Moldovan %).
- RW M1 #12 (`d950f4c0…`) — tabla "World Wine Production and Consumption".
- RW M2 #11 (`c7a955b1…`) — bar chart "Changes in Economic Class 1979–2019".
- RW M2 #12 (`a4fbeb01…`) — line chart "Drag vs. Froude Number".

Las 54 preguntas R&W (27+27) fueron inspeccionadas visualmente página por página (37 págs) contra
la fuente; stem, stimulus, opciones e imágenes coinciden con la fuente salvo B1 y B2.

---

## Verificación de la clave de respuestas

Clave derivada de `Test8_Math_Answer_Explanations.docx` y `Test8_RW_Answer_Explanations.docx`
(TEST 8 no tiene `ANS KEY.docx`), mapeada por módulo/nº de pregunta y comparada programáticamente
contra `correctAnswer` de las 98 preguntas publicadas.

- **Math (44):** 43/44 correctas. 1 discrepancia: **M2 #1** (publicado A, correcta B — ver A6 nota
  al pie; a diferencia de A6/A7 este es un error de **clave**, no de tipo — el contenido stem/opciones
  coincide exactamente con la fuente: "Angela buys 2 cookies and 3 brownies for $19..." con opción B
  = "2c + 3b = 19, 4c + b = 13", que la explicación confirma como correcta).
- **R&W (54):** 53/54 correctas. 1 discrepancia: **RW M2 #1** (ver B1).
- **Total: 96/98 correctas.** NUMERIC verificados incluyendo pipe/alternativas textuales
  ("7 or 13" en explicación de Math M2 #9, almacenado como `"7"` — consistente, NUMERIC de una sola
  respuesta válida, sin necesidad de formato pipe-delimited aquí ya que ambas raíces 7 y 13 son
  intercambiables y solo una se registró).

### Nota — Math M2 #1 vs M1 #1 / RW M1 #1 (prefijo antiguo, mismo patrón)
Las 4 preguntas "#1" de cada módulo (RW M1, RW M2, Math M1, Math M2) conservan un qid con prefijo
antiguo (`cmsjrnw…`), remanente de la promoción original incompleta (ver memoria "Test 8 completion
progress"). De esas 4, **2 tienen la clave correcta** (RW M1 #1 = C ✓, Math M1 #1 = A ✓) y **2 tienen
la clave incorrecta** (RW M2 #1, Math M2 #1 — ambas documentadas arriba). No es un patrón sistemático
por prefijo (2 de 4 están bien), pero vale la pena que cualquier repromoción futura verifique estas 4
preguntas específicamente ya que fueron las que quedaron del intento original.

### Verificación reforzada de las 2 claves (2026-09-22, agente principal) — CONFIRMADAS

Ambas discrepancias se re-verificaron abriendo directamente el DOCX de explicaciones con `python-docx`
(solo lectura) y localizando la línea "✓ Correct Answer" de cada pregunta. **Confirmadas las dos**:

- **Math M2B #1** (`cmsjrnw98011gqmt1zh6x8hem`) — cita textual del
  `Test8_Math_Answer_Explanations.docx`:
  > "✓ Correct Answer: **B** — 2c + 3b = 19 and 4c + b = 13 … Angela buys 2 cookies and 3 brownies for
  > $19: 2c + 3b = 19. Vicky buys 4 cookies and 1 brownie for $13: 4c + b = 13. **Choice B matches exactly.**"

  El publicado (`A` = `c+b=5; 6c+4b=32`) no corresponde a ningún dato del problema; la opción **B** es
  el sistema literal. Defecto **autoevidente** además de confirmado por la fuente.
  **Acción: `correctAnswer` → `B`.**

- **RW M2B #1** (`cmsjrnwkk0168qmt1r4m1sqcd`) — cita textual del
  `Test8_RW_Answer_Explanations.docx` (Module 2B, Question 1):
  > "✓ Correct Answer: **B — extensive** … This scope of coordinated international and national effort,
  > producing numerous legislative measures, is best described as 'extensive'. … C — contentious:
  > Contentious means causing disagreement. The passage does not suggest the conservation efforts are
  > disputed — it presents them as collaborative and substantial."

  El publicado (`C` = contentious) contradice el contexto ("agencies collaborating… numerous
  legislation"). **Acción: `correctAnswer` → `B`.**

Estas son las **únicas 2 claves incorrectas en TEST 1-8** (las otras 490 respuestas verificadas son
correctas) → máxima prioridad en la fase de fixes WAL-safe. Ambas son la **pregunta #1 del módulo 2B**
(RW y Math), consistente con el bug de los stragglers de la promoción original de TEST 8.

---

## Estado de la inspección — TEST 8 CERRADO ✔ (con hallazgos críticos de imagen)
- **Math (44):** inspección visual completa página por página (19 págs). ✔
- **R&W (54):** inspección visual completa página por página (37 págs). ✔
- **Conteo de preguntas:** 98/98 publicadas, sin huecos de módulo/secuencia — el estado
  "~unpromoted" de la memoria previa ya no aplica.
- **Claves de respuesta:** 96/98 correctas (2 discrepancias: RW M2 #1, Math M2 #1 — ambas
  documentadas en B1/A-key-note).
- **Hallazgo más grave:** 4 preguntas Math (`image_missing` crítico) son **irresolubles** tal como
  están publicadas porque el diagrama/gráfico necesario fue reemplazado por una captura redundante
  del panel de opciones del reproductor. Sumado a las 2 claves incorrectas y 1 `type_mismatch`,
  TEST 8 tiene el perfil de defectos más orientado a **imagen y clave** que los tests 1-5 (que eran
  mayormente de texto: brackets, UI leaks, stem bleed).
