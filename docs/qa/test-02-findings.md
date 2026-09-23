# QA TEST 2 — inconsistencias publicado vs fuente

**Fecha:** 2026-09-22 · **Método:** inspección visual (Claude) de cada pregunta publicada contra la
imagen de su página fuente + barridos automáticos por regex sobre las 98. Solo lectura (no se modificó
contenido oficial ni `dev.db`).

- **Fuente Math:** `files_to_load/MOCK EXAMS/TEST 2/MATH/Innov. Test 2 Math Mod 1, 2B REV.pdf` (20 págs, capturas del reproductor).
- **Fuente R&W:** `files_to_load/MOCK EXAMS/TEST 2/READING AND WRITING/INNOVATOR TEST 2 R&W MOD 1 REV.pdf` (36 págs; ~2 preguntas por página, o 1 cuando el pasaje es largo). Contiene **ambos** módulos (M1 y M2B) pese al nombre "MOD 1".
- **Claves de respuesta:** **NO hay doc ANS-KEY.** Se extrajeron de los docs de explicaciones con python-docx:
  `Test2 Math Answer Exp.docx` (tabla por pregunta, celda con ✓ para MC / celda "Solution" para NUMERIC) y
  `Test2 RW Answer Explanations.docx` ("Choice X is the best answer" por pregunta).
- **Alineación:** Math por número de página del candidato (fiable, `pageNumber`); R&W secuencial por `moduleSeq`, confirmada visualmente.
- Preguntas publicadas: 98 (RW 27+27, Math 22+22). Todas `PUBLISHED`.

> Nota: las páginas fuente son **capturas del reproductor tipo College Board** (botones NEXT/PREV QUESTION,
> flag "COME BACK LATER", marcas ✗). Ese *chrome* de UI y el orden secuencial de las preguntas en la misma
> página son la causa de casi todos los defectos: contenido de la pregunta siguiente que **sangra** dentro
> de la última opción o del stimulus de la actual.

---

## Resumen de defectos

| Clase | Cantidad | Severidad | Dónde |
|---|---|---|---|
| `broken_question` — falta el enunciado real y la opción A (respuesta correcta) contiene texto duplicado del stimulus/notas | **2** | **Crítica** | R&W M2 #10, M2 #27 |
| `option_text_wrong` — opción con sangrado (pasaje siguiente / cola del stimulus) en opción NO-respuesta | 6 | Alta | R&W M1 #5, #10, #15, #17; M2 #14, #15 |
| `stimulus_bleed` — texto de vecino prepend/append o falta de intro en el stimulus | 5 | Media | R&W M1 #3, #6, #8, #18; M2 #25 |
| `ui_leak` — chrome de UI ("COME/CUME BACK LATER", ✗) u opciones volcadas dentro del stem/stimulus | 5 | Media | R&W M1 #16; Math M1 #19, M2 #3, M2 #18, M2 #19 |
| `content_math_error` — LaTeX/símbolo mal parseado (no cambia la respuesta) | 3 | Baja | Math M1 #16, M2 #2, M2 #10 |
| `stem_annotation_leak` — sufijo `[tema / respuesta]` en el stem | 3 | Baja | R&W M1 #1, #2; M2 #14 |
| `stem_number_leak` — el nº de pregunta ("4.", "16.") antepuesto al stem | 17 (R&W) | Baja (cosmética) | R&W M1 #4,6,8,14,16,18,20,22,23; M2 #2,4,16,18,20,22,24,25 |

**No** se hallaron: `escaped_underscore`, `asset_placeholder_leak` (tbl-*.html), `option_label_leak` real
(el único positivo del barrido, R&W M2 #12 opción A "A glassmakers' guild…", es el artículo legítimo "A").

**Claves de respuesta: ✔ 98/98 correctas — 0 discrepancias.** La *letra* correcta coincide en las 98
(incluidos M2 #10 y M2 #27, cuya letra A sigue siendo correcta aunque el **texto** mostrado de la opción A
esté corrupto — ver abajo). NUMERIC verificados: M1 #4=8, #6=7, #10=8, #14=3; M2 #3=3, #5=15, #8=8, #13=−28, #15=40, #21=−37.

---

## A. READING & WRITING (54)

### A0. `broken_question` — parse colapsado (falta enunciado + opción A corrupta) — **Crítica**
Ambas son preguntas con imagen/notas donde el reproductor apila el prompt debajo; el parseo perdió el
enunciado real y metió el stimulus/última viñeta en la opción A. **La letra correcta (A) coincide con la
clave, pero el texto de la opción A que ve el alumno es basura y el texto real de la respuesta correcta NO
aparece** → pregunta efectivamente incontestable.

- **R&W M2 #10** (`cmsjrntzg00duqmt1t01beiay`, pág 25, STEMIMG). Fuente: prompt "Which choice most effectively
  uses data from the graph to illustrate the survey results?"; opción A = "the percentage of people who had
  listened to an audiobook more than doubled since 2011, growing from 11% to nearly 25%."
  Publicado: el `stem` es el **texto-a-completar** ("A major book retailer is investigating…"), falta el
  prompt real; la **opción A** = copia de ese mismo texto ("major book retailer is investigating… a
  significant increase in customer preference"). Opciones B/C/D correctas.
  Acción: restaurar prompt real + opción A de la fuente.

- **R&W M2 #27** (`cmsjrnu5300goqmt13nxbcs97`, pág 36). Fuente: prompt "The student wants to describe the
  differences between the work of the two Japanese porcelain artists. Which choice…"; opción A = "While
  Makuzu Kozan's artistry was displayed in his glazes that yielded deep colors and a translucent appearance,
  Yabu Meizan's porcelain was notable for its complicated decoration with innumerable images."
  Publicado: el `stem` son las **notas** (y truncadas: falta la última viñeta); falta el prompt real; la
  **opción A** = esa última viñeta ("single piece by Meizan might depict thousands of flowers or hundreds of
  people."). Opciones B/C/D correctas. Acción: restaurar prompt real + opción A de la fuente.

### A1. `option_text_wrong` — sangrado en una opción (respuesta NO afectada) — **Alta (6)**
En preguntas "completes the text", el pasaje de la pregunta **siguiente** (o la cola del stimulus propio) se
adjuntó al final de una opción, normalmente la D. La letra correcta no es esa opción, así que la clave no
cambia, pero el texto mostrado es incorrecto.

- **R&W M1 #5** (`cmsjrntxz00cvqmt18r89mibl`): opción D = "surrender to **The following text is from Charles
  Brockden Brown's 1798 novel *Wieland; or the Transformation*. …**" (777 chars). Debe ser "surrender to".
  El intro de Wieland pertenece al stimulus de #6. (Respuesta C.)
- **R&W M1 #10** (`cmsjrntz800dpqmt1kbv7yjkl`, STEMIMG): opción D = "The H' value at Site 1 was lower than the
  H' value at Site 8. **plant usage) and samples 3–8 were measures of the effluent… water quality continued
  to improve.**" — la **cola del stimulus** se adjuntó a la opción D. Debe terminar en "…H' value at Site 8."
  (El fragmento "plant usage)…" debe volver al stimulus.) (Respuesta C.)
- **R&W M1 #15** (`cmsjrnu0h00erqmt1tb2pjkov`): opción D = "caffeine. Researchers **CUME BACK LATER Northern
  New Zealand is home to some of the oldest forests on Earth. Forests filled with kauri…**" — UI leak
  ("CUME BACK LATER") + pasaje de #16. Debe ser "caffeine. Researchers". (Respuesta C.)
- **R&W M1 #17** (`cmsjrnu0v00fbqmt1i342d738`): opción D = "post-independence? Pointing **Wheat and rice are
  the most common cereal crops…**" — pasaje de #18. Debe ser "post-independence? Pointing". (Respuesta A.)
- **R&W M2 #14** (`cmsjrnu0d00emqmt1jsmipbfp`): opción A = "**Tale of Two Cities* is an 1859 novel by Charles
  Dickens. In the novel, Sydney Carton…**" = copia del stimulus. La opción A real debería ser una cita de la
  novela. (Respuesta C; además este stem tiene `[Sydney Carton / Stryver / indifference]` — ver A5.)
- **R&W M2 #15** (`cmsjrnu0k00ewqmt12oq2oyg0`): opción D = "to contain writings that he was unlikely to ever
  read. **In the field of biodiversity, the neutral model predicts…**" (706 chars) — pasaje de #16. Debe ser
  "to contain writings that he was unlikely to ever read." (Respuesta B.)

### A2. `stimulus_bleed` — texto de vecino en el stimulus — **Media (5)**
- **R&W M1 #3** (`cmsjrntxm00cjqmt10muq61eu`, pág 2): el stimulus incluye **dos** pasajes (Miss Civilization
  *y* Rachel: A Play in Three Acts). El pasaje de Rachel pertenece a **#4**; #3 solo debe llevar Miss
  Civilization. (Opciones y respuesta D correctas.)
- **R&W M1 #6** (`cmsjrnty700d5qmt13js7g42m`, pág 3): al stimulus le **falta** su intro "The following text is
  from Charles Brockden Brown's 1798 novel *Wieland; or the Transformation*." (que sangró a la opción D de #5).
- **R&W M1 #8** (`cmsjrntym00dhqmt1nan99z1j`): el stimulus arranca con "**Harcourt's worries are making her
  antisocial.**" (cola de la opción D de #7) antes del texto real de anteaters. Quitar ese prefijo.
- **R&W M1 #18** (`cmsjrnu1400fhqmt1pudev181`): el stimulus arranca con "**Pointing** Wheat and rice…" — la
  palabra "Pointing" sangró desde la opción A de #17. Debe empezar "Wheat and rice…".
- **R&W M2 #25** (`cmsjrnu4m00g8qmt1ln8xwuho`): el stimulus arranca con "**Moreover,** The practice known as
  biological control…" — "Moreover," sangró desde la opción D de #24. Quitar el prefijo. (Respuesta B.)

### A3. `ui_leak` — chrome de UI en el contenido — **Media (1 en R&W)**
- **R&W M1 #16** (`cmsjrnu0o00f1qmt1m68v5nd1`): el stimulus arranca "**Researchers CUME BACK LATER** Northern
  New Zealand is home to…". Quitar "Researchers CUME BACK LATER". (El "CUME BACK LATER" es typo OCR de "COME
  BACK LATER".) (El resto de UI-leaks son de Math — sección B.)

### A5. `stem_annotation_leak` — sufijo `[tema / respuesta]` en el stem — **Baja (3)**
Igual que en TEST 1 pero **aislado a 3 preguntas** (el resto se limpió bien).
- **R&W M1 #1** (`cmsjro67q05q2qmt10fxc3d8b`): "…logical and precise word or phrase? **[uncanny valley / unsettling]**"
- **R&W M1 #2** (`cmsjro67t05q3qmt1248twtaf`): "…what does the word "conceal" most nearly mean? **[James Fenimore Cooper / The Pilot]**"
- **R&W M2 #14** (`cmsjrnu0d00emqmt1jsmipbfp`): "…most effectively illustrates the claim? **[Sydney Carton / Stryver / indifference]**"
- Acción: eliminar el sufijo `\s*\[[^\]]*\]\s*$`.

### A6. `stem_number_leak` — nº de pregunta antepuesto al stem — **Baja / cosmética (17)**
El número de la pregunta quedó dentro del `stem` (p.ej. "4. As used in the text…", "16. Which choice…").
En la fuente el número está en una columna aparte del reproductor. Afecta de forma **inconsistente** a
R&W: M1 #4, #6, #8, #14, #16, #18, #20, #22, #23; M2 #2, #4, #16, #18, #20, #22, #24, #25 (17 preguntas).
Acción: quitar el prefijo `^\s*\d+\.\s*`. (Ver nota Math en B.)

---

## B. MATH (44)

### B1. `ui_leak` — opciones/UI volcadas dentro del stem — **Media (4)**
- **Math M2 #3** (`cmsjrnta4004eqmt1bd0xl02p`, pág 11, NUMERIC): stem termina en "…given equation? **➤ COME
  BACK LATER**". Quitar el flag. (Respuesta 3.)
- **Math M1 #19** (`cmsjrntgb006lqmt1k63h2kpd`, pág 9, STEMIMG): el stem, tras "…interpretation of the
  function h(x)+3?", **vuelca el texto de las 4 opciones** ("A The balloon is released at the same height…").
  Las opciones A-D existen aparte y son correctas; el stem debe cortarse en "…h(x)+3?". (Respuesta D.)
- **Math M2 #18** (`cmsjrntg7006kqmt10mtirx79`, pág 18, STEMIMG): el stem contiene "**DATA SET J DATA SET K**"
  + las 4 opciones con marcas "**✗ A … ✗ B … ✗ C … ✗ D …**". Cortar en "…Data Set J and Data Set K?".
  (Respuesta D.)
- **Math M2 #19** (`cmsjrntgh006qqmt1kcr9rxh8`, pág 18): el stem termina "…y² − 4y = 51? **✗ A 8π ✗ B 14.28π
  ✗ C 16π ✗ D 64π**". Cortar en "…= 51?". (Respuesta C.)

### B2. `content_math_error` — LaTeX/símbolo mal parseado (respuesta NO afectada) — **Baja (3)**
- **Math M2 #2** (`cmsjrnt4c0048qmt1eokpmvyk`, pág 11): publicado `\frac{4x^3 - 3}{2x + \sqrt{3}}`. Fuente y
  doc de explicaciones: numerador **4x² − 3** (no 4x³). El "cubo" es un error de parseo. (Respuesta B =
  2x − √3, coherente solo con 4x²−3.)
- **Math M2 #10** (`cmsjrntdv0058qmt1psaqqhpu`, pág 14): publicado "(8x - 20)**^+**". Fuente: "(8x − 20)**°**"
  (grados). El símbolo ° se parseó como "^+". (Respuesta D.)
- **Math M1 #16** (`cmsjrntfh0063qmt1of57u7xi`, pág 7): publicado `V(t) = 25(0.88)^{\frac{1}{3}}`. La fuente
  (PDF) muestra el exponente **t/3**; el parseo perdió la "t" (quedó 1/3). (El doc de explicaciones lo
  escribe como t/5 — discrepancia menor entre fuente y explicación; en ambos casos el exponente publicado es
  incorrecto.) No afecta la respuesta (D = "valor del equipo, en millones, cuando es nuevo").

### B3. `stem_number_leak` (Math) — informativo
Las 44 preguntas de Math llevan el número ("1.", "2.", …) dentro del `stem`. A diferencia de R&W es
**uniforme**, así que es consistente y de bajo impacto; se documenta pero no se lista por-pregunta.

Las demás preguntas de Math coinciden con la fuente (stem, opciones, imágenes, respuesta).

---

## Estado de la inspección — TEST 2

- **Math (44):** inspección visual página por página (20 págs) + barridos regex. Defectos: 4 `ui_leak`,
  3 `content_math_error` (ninguno altera la clave). Resto fiel a la fuente.
- **R&W (54):** inspección visual de las páginas clave (1-3, 25, 36) + muestreo + barrido automático de
  artefactos sobre las 54 (sangrados de opción/stimulus, `[x/y]`, UI, longitudes anómalas). Defectos: 2
  `broken_question` (críticos), 6 `option_text_wrong`, 5 `stimulus_bleed`, 1 `ui_leak`, 3 `stem_annotation_leak`,
  17 `stem_number_leak`.
- **Claves de respuesta: ✔ 98/98 correctas.** Extraídas de los dos docs de explicaciones (no hay ANS-KEY) y
  comparadas por sección+módulo+moduleSeq (R&W M2 usa Module 2B "HARDER"). 0 discrepancias de letra/valor.

## Causa raíz
El patrón dominante en TEST 2 **no** es el `[tema/respuesta]` de TEST 1 (aquí solo 3), sino el **sangrado
secuencial**: como en la fuente cada página del reproductor apila 1-2 preguntas en orden, el promotor tomó
la última opción de una pregunta y le pegó el intro/pasaje de la siguiente (o la cola del propio stimulus),
y en dos casos (M2 #10, #27) colapsó por completo el enunciado con imagen/notas, sustituyendo el texto de la
opción A por el stimulus. La corrección requiere recortar cada sangrado por el límite de pregunta y, en #10
y #27, reinyectar el prompt y la opción A desde la fuente.
