# QA TEST 4 — inconsistencias publicado vs fuente

**Fecha:** 2026-09-22 · **Método:** inspección visual (Claude) de las 98 preguntas publicadas contra la
imagen de su página fuente + barrido automático por regex (`scripts/qa/scan-artifacts.mjs`) sobre las 98.
Solo lectura (no se modificó contenido oficial ni `dev.db`; `dev.db` abierto en modo `readonly`).

- **Fuente Math:** `files_to_load/MOCK EXAMS/TEST 4/MATHS/INNOVATOR TEST 4 Math MOD 1&2.pdf` (16 págs, capturas del reproductor).
- **Fuente R&W:** `files_to_load/MOCK EXAMS/TEST 4/READING AND WRITING/INNOVATOR TEST 4 RW MOD 1 &2 REV.pdf` (37 págs; ~2 preguntas por página en orden, 1 cuando el pasaje/imagen es largo).
- **Clave de respuestas:** `files_to_load/MOCK EXAMS/TEST 4/ TEST 4 ANS KEY.docx` (nombre con espacio inicial) —
  **una sola tabla**, 4 columnas (READING & WRITING MOD.1 / MOD.2, MATH MODULE 1, MATH MODULE 2 HARDER),
  extraída completa con python-docx (27+27+22+22 = 98 valores, incluye NUMERIC: 7, 2.5, 260, 1020, 111, 14, 11, 120, 2, 6, −21, 0.5).
  **No existe un doc de "R&W Answer Explanations" para TEST 4** (a diferencia de TEST 2) — se deja constancia;
  `Test4_Math_Answer_Explanations.docx` sí existe y se usó solo como cross-check de Math, no fue necesario para resolver discrepancias.
- **Alineación:** Math por número de página del candidato (`pageNumber`, fiable); R&W secuencial por `moduleSeq`, confirmada visualmente en todas las páginas.
- Preguntas publicadas: 98 (RW 27+27, Math 22+22). Todas `PUBLISHED`.

> Nota: las páginas fuente son **capturas del reproductor tipo College Board** (botones NEXT/PREV QUESTION,
> flag "COME BACK LATER", marcas ✗/☑). Ese *chrome* de UI, apilado junto a la pregunta en la misma página,
> es la causa de los defectos de parseo encontrados.

---

## Resumen de defectos

| Clase | Cantidad | Severidad | Dónde |
|---|---|---|---|
| `broken_question` — falta el enunciado real (prompt), reemplazado por texto de otro campo (stimulus truncado u opción) | **2** | **Crítica** | Math M1 #19; R&W M1 #25 |
| `stem_option_leak` — las 4 opciones (con marcas ☑/✗ del reproductor) se vuelcan duplicadas al final del stem, además de existir correctamente en la tabla de opciones | 3 | Media | R&W M1 #6, M1 #11; M2 #8 |
| `ui_leak` — texto de botón UI ("COMB BACK LATER") dentro de una opción | 1 | Media | Math M1 #19 opción D (mismo caso que el `broken_question` de arriba) |
| `escaped_underscore` — blank `\_\_\_\_\_` (se renderiza literal en vez de `_____`) | 1 | Baja | R&W M2 #24 |
| `stem_number_leak` — el número de pregunta ("6.", "22.") antepuesto al stem/dentro del stem | **59** (18 R&W + 41 Math) | Baja / cosmética | Ver detalle abajo |

Ninguno de los defectos altera la **letra/valor** de respuesta correcta: las 98 respuestas publicadas
coinciden con la clave oficial (ver sección de claves). Incluso en los 2 `broken_question`, la letra
correcta (C en ambos casos) es la correcta según la clave, aunque el contenido que ve el alumno esté roto.

---

## A. Defectos críticos — `broken_question` (2)

### A1. Math Module 1 #19 (`cmsjrnvad00rqqmt1dkutaaga`, pág. 7) — **Crítica**
- Fuente (pág. 7): gráfico de `p(x)` + texto "A polynomial function p(x) is graphed on the xy-plane. What
  is the equation for the function p(x)?" con opciones:
  A) `p(x) = -0.5(x+2)(x-1)(x-3)`　B) `p(x) = -0.5(x-2)(x+1)(x+3)`　C) `p(x) = 0.5(x+2)(x-1)(x-3)`　D) `p(x) = 0.5(x-2)(x+1)(x+3)`
- Publicado: **stem = `"19."`** (perdió el enunciado real y la imagen del gráfico solo queda como `imageUrl`
  adjunto, sin el texto). El texto real del enunciado ("A polynomial function p(x) is graphed...") quedó
  **metido en la opción A** (sin la letra "A" inicial), desplazando/perdiendo el contenido real de la opción
  A de la fuente (`-0.5(x+2)(x-1)(x-3)`), que **no aparece en ninguna parte** de la pregunta publicada.
  Las opciones B, C, D publicadas sí coinciden con B, C, D de la fuente.
  Opción D además tiene **`ui_leak`**: `"...+ 3)$ COMB BACK LATER"` (botón "COME BACK LATER" filtrado, con
  el mismo typo "COMB" visto en TEST 1).
- Respuesta publicada: **C** — coincide con la clave (`MATH MODULE 1` posición 19 = `C`).
- Impacto: la pregunta, tal como se muestra al alumno, no tiene enunciado (solo "19." y el gráfico) y la
  opción A es un fragmento del enunciado, no una respuesta matemática — la pregunta es efectivamente
  incontestable/confusa a pesar de que la clave interna sea correcta.
- Acción: restaurar el stem real ("A polynomial function p(x) is graphed on the xy-plane. What is the
  equation for the function p(x)?"), restaurar opción A = `p(x) = -0.5(x+2)(x-1)(x-3)`, y quitar
  "COMB BACK LATER" de la opción D.

### A2. R&W Module 1 #25 (`cmsjrnusr00lpqmt1m5c083u0`, pág. 17) — **Crítica**
- Fuente (pág. 17): notas del estudiante (5 viñetas sobre el peine Changzhou) como *stimulus*, y el
  **prompt real** en la columna derecha: "The student wants to emphasize the intricacies of producing
  Changzhou combs. Which choice most effectively uses relevant information from the notes to accomplish
  this goal?" — con 4 opciones A-D.
- Publicado: tanto `stem` como `stimulus` contienen **solo las notas** (y el `stem` está además truncado:
  le falta la 5ª viñeta, "A Changzhou comb produced in 1915..."). **El prompt real nunca fue capturado** —
  no aparece en ningún campo de la pregunta publicada.
- Las 4 opciones (A-D) sí coinciden textualmente con la fuente (el barrido automático marcó esto como
  `optDupStim` porque el texto de la opción A coincide con una viñeta de las notas — es un **falso positivo**
  de ese heurístico: en preguntas de tipo "notes", que la opción correcta reformule una nota es el
  comportamiento normal y esperado, no un defecto).
- Respuesta publicada: **C** — coincide con la clave (`READING & WRITING MOD.1` posición 25 = `C`).
- Impacto: el alumno ve las notas dos veces (como enunciado y como pasaje) pero nunca ve la pregunta real
  que debe responder.
- Acción: reemplazar el `stem` por el prompt real de la fuente; opcionalmente completar el `stimulus` con
  la viñeta faltante.

---

## B. `stem_option_leak` — opciones volcadas dentro del stem (3) — **Media**

Patrón nuevo (no visto en TEST 1/2 en R&W, sí en Math de TEST 2): el parser capturó la columna de opciones
del reproductor (con las marcas ☑/✗ de "no seleccionado") y la pegó, duplicada, al final del `stem`, además
de poblar correctamente la tabla `QuestionOption`. Las opciones reales están bien — el problema es la
duplicación visual dentro del enunciado.

- **R&W M1 #6** (`cmsjrnumh00jzqmt1g28ulhej`, pág. 4): stem termina en "...main purpose of the text?" y
  continúa con `☑ A To introduce and describe the house of Monsieur St. Aubert ☑ B To persuade... ☑ C To
  contrast... ☑ D To describe...`. Fuente: el stem termina limpio en "...main purpose of the text?".
  (Respuesta D, correcta.)
- **R&W M1 #11** (`cmsjrnup800klqmt1keigju8b`, pág. 9): mismo patrón — el stem incluye las 4 opciones sobre
  Júpiter/auroras después de "...most directly support the scientists' claim?". (Respuesta A, correcta.)
- **R&W M2 #8** (`cmsjrnumx00k8qmt1qcvbkuhl`, pág. 23): stem incluye `"8. Which choice best describes the
  overall structure of the text?\n\n✗ A The speaker defends...✗ B...✗ C...✗ D..."` (además tiene el
  `stem_number_leak` "8." — ver sección D). (Respuesta B, correcta.)

Acción: recortar el `stem` en el signo de interrogación real, eliminando el bloque de opciones ☑/✗ que le
sigue (las opciones ya existen correctamente en `QuestionOption`, no hace falta tocarlas).

---

## C. `escaped_underscore` — R&W Module 2 #24 (`cmsox4p4h0001d7ppk2bxq18m`, pág. 35) — **Baja**

- Stimulus publicado: `"...the higher the likelihood of it being enjoyed. \_\_\_\_\_ the influence of visual
  appeal..."` — se renderiza literal (`\_\_\_\_\_`) en vez del blank `_____`.
- Fuente: blank normal (`______`).
- Respuesta publicada: **C** ("However,") — coincide con la clave.
- Consistente con el mismo defecto ya documentado 1x en TEST 1 (y notado como presente también en TEST 4,
  7, 8 — confirmado aquí).
- Acción: reemplazar `\_` por `_` en ese stimulus.

---

## D. `stem_number_leak` — número de pregunta dentro del stem — **Baja / cosmética (59)**

Igual que en TEST 2: el número de la pregunta ("2.", "16.", "22.") quedó dentro del campo `stem` en vez de
vivir en una columna aparte del reproductor. Es **inconsistente** en R&W y **casi uniforme** en Math
(faltan Math M2 #2 y #16, que no calzan con el patrón `^\d{1,2}\.\s`, y Math M1 #19 tampoco lo tiene porque
su stem quedó reducido a `"19."` sin espacio final — ver A1).

- **R&W (18):** M1 #2, #4, #13, #16, #18, #20, #22, #24; M2 #2, #4, #6, #8, #17, #19, #21, #23, #25, #27.
- **Math (41):** M1 #1-18, #20-22 (21 de 22, falta #19 por el defecto A1); M2 #1, #3-15, #17-22 (20 de 22,
  faltan #2 y #16).
- Total: 59 preguntas afectadas, ninguna cambia de respuesta. Se reporta como una sola clase agregada
  (no se listan qids individuales por ser cosmético y de alto volumen, siguiendo el criterio de TEST 1/2).
- Acción (si se decide limpiar): quitar el prefijo `^\s*\d{1,2}\.\s*` del `stem` en las preguntas afectadas.

---

## E. Claves de respuesta — ✔ 98/98 correctas

Se extrajo la tabla única de `TEST 4 ANS KEY.docx` (4 columnas) con python-docx y se comparó programáticamente
contra `correctAnswer` de las 98 preguntas publicadas (mapeo por `section` + `moduleKey` + `moduleSeq`):

- **R&W Module 1 (27):** D B B B C D B A B D A C D B B D B C D A C A B D C C D
- **R&W Module 2 (27):** A C A D C A C B D D C C A C C B C A C D A C D C B A C
- **Math Module 1 (22):** D C A D B B C 7 B B D 2.5 C 260 C C A 1020 C D B 111
- **Math Module 2 Harder (22):** 14 A 11 D A C D B 120 C D D D 2 D B 6 A B −21 C 0.5

**Resultado: 0 discrepancias** (incluye NUMERIC verificados por comparación exacta de string: 7, 2.5, 260,
1020, 111, 14, 11, 120, 2, 6, −21, 0.5). No existe archivo de explicaciones R&W para TEST 4 con el que
hacer un segundo cross-check textual; `Test4_Math_Answer_Explanations.docx` confirma independientemente los
valores de Math usados arriba.

---

## Estado de la inspección — TEST 4 CERRADO ✔

- **Math (44):** inspección visual completa de las 16 páginas fuente (todas las preguntas M1 #1-22, M2 #1-22).
  Defecto: 1 `broken_question` (M1 #19, que incluye también el único `ui_leak` de Math). Resto fiel a la fuente
  en stem/opciones/imágenes/respuesta.
- **R&W (54):** inspección visual completa de las 37 páginas fuente (M1 #1-27, M2 #1-27) + barrido automático
  de artefactos (`bracket`, `ui`, `tbl`, `esc`, `stemNum`, `optLabelLeak`, `mcFewOpts`, `emptyStem`, `numAlpha`,
  `optDupStim`) sobre las 98. Defectos: 1 `broken_question` (M1 #25), 3 `stem_option_leak`, 1
  `escaped_underscore`. **0** casos de `stem_annotation_leak` (`[tema/respuesta]`) — a diferencia de TEST 1,
  este defecto no aparece en TEST 4. **0** `option_text_wrong`/`stimulus_bleed` tipo TEST 2 (sangrado
  secuencial entre preguntas vecinas) detectados en el muestreo visual completo.
- **Claves de respuesta:** ✔ **98/98 correctas**, 0 discrepancias contra `TEST 4 ANS KEY.docx` (única fuente
  de clave; no hay doc de explicaciones R&W para este test).

## Causa raíz de los defectos de TEST 4

A diferencia de TEST 1 (anotación `[tema/respuesta]` filtrada desde el doc de explicaciones) y TEST 2
(sangrado secuencial entre preguntas vecinas en la misma página), TEST 4 tiene un patrón dominante distinto
y de bajo volumen: **fallas puntuales de segmentación stem/opciones dentro de una misma pregunta** cuando el
layout del reproductor es más complejo (gráfico + opciones a la derecha en M1 #19; notas de investigación en
M1 #25; opciones con marcas ☑/✗ en M1 #6, #11, M2 #8). El volumen de defectos "de contenido" es mucho menor
que en TEST 1/2 (2 críticos + 4 menores + 1 cosmético masivo, vs. 8-9 defectos de contenido en los tests
anteriores), pero los 2 `broken_question` son igual de graves: la pregunta que ve el alumno carece de
enunciado real.
